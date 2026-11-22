<?php

// =====================================================================================
// AuthController — LOGIN e LOGOUT do sistema (admin e motorista).
//
// Rotas (routes/api.php):
//   POST /api/login   -> login()   PÚBLICA (ainda não tem token), com limite de requisições (throttle)
//   POST /api/logout  -> logout()  exige token (auth:sanctum)
//
// Como funciona o login:
//   1) o app envia "login" (e-mail do admin ou CPF do motorista) e "password";
//   2) se errou 5 vezes seguidas, fica bloqueado por 15 minutos (RateLimiter);
//   3) encontra o usuário e confere a senha com Hash::check (a senha no banco é um hash);
//   4) se acertar, cria um TOKEN do Laravel Sanctum e devolve para o app;
//   5) toda tentativa (certa ou errada) vai para o log de acesso (tabela logs_acesso).
// O app guarda o token e manda em toda requisição: "Authorization: Bearer <token>".
// =====================================================================================

namespace App\Http\Controllers;

use App\Models\LogAcesso;                  // tabela logs_acesso (auditoria)
use App\Models\Motorista;
use App\Models\User;                       // tabela users (logins)
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;       // compara a senha digitada com o hash guardado
use Illuminate\Support\Facades\RateLimiter; // conta as tentativas erradas e bloqueia

class AuthController extends Controller
{
    // Bloqueio contra quem tenta adivinhar senhas:
    // depois de 5 erros seguidos para o mesmo login (no mesmo IP), o login fica bloqueado por 15 minutos.
    // "const" = valor fixo da classe; fica num lugar só para ser fácil de mudar.
    private const MAX_TENTATIVAS = 5;
    private const MINUTOS_BLOQUEIO = 15;

    // Grava uma linha no log de acesso ("login" = e-mail do admin ou CPF do motorista).
    // $userId é null quando o login digitado não existe; $motivo explica a falha ("Senha incorreta"...).
    private function registrar(Request $request, string $login, string $evento, bool $sucesso, ?int $userId = null, ?string $motivo = null): void
    {
        LogAcesso::create([
            'user_id'     => $userId,
            'email'       => mb_substr($login, 0, 255),   // corta em 255 caracteres (tamanho da coluna)
            'evento'      => $evento,                     // 'login' ou 'logout'
            'sucesso'     => $sucesso,
            'motivo'      => $motivo,
            'ip'          => $request->ip(),              // de onde veio a tentativa
            // Transforma o "user agent" (texto enorme do navegador) em algo curto, ex.: "Chrome · Windows".
            'dispositivo' => LogAcesso::resumirDispositivo($request->userAgent()),
        ]);
    }

    // Como o usuário se identifica: o admin pelo e-mail, o motorista pelo CPF.
    // (O CPF fica na tabela motoristas, por isso busca pelo motorista_id do usuário.)
    private function identificacao(User $usuario): string
    {
        if ($usuario->perfil === 'motorista') {
            // whereKey(id) = where id = ...; value('cpf') = devolve só essa coluna.
            return (string) Motorista::whereKey($usuario->motorista_id)->value('cpf');
        }

        return (string) $usuario->email;
    }

    // Encontra o usuário pelo que foi digitado:
    //  - com "@"  -> e-mail (só administrador);
    //  - 11 números -> CPF de um motorista com acesso liberado.
    // "?User" = pode devolver um User ou null (não encontrado).
    private function buscarUsuario(string $login): ?User
    {
        if (str_contains($login, '@')) {
            // Por e-mail só entra quem NÃO é motorista (motorista entra só pelo CPF).
            // where(fn ...) agrupa: (perfil IS NULL OR perfil != 'motorista').
            return User::where('email', $login)
                ->where(fn ($q) => $q->whereNull('perfil')->orWhere('perfil', '!=', 'motorista'))
                ->first();
        }

        // Tira tudo que não é número (\D): "096.668.979-89" vira "09666897989".
        $d = preg_replace('/\D/', '', $login);
        if (strlen($d) !== 11) {
            return null; // não tem cara de CPF
        }

        // O CPF fica gravado no formato 000.000.000-00.
        // substr(texto, início, quantidade) recorta os pedaços para montar a máscara.
        $cpf       = substr($d, 0, 3) . '.' . substr($d, 3, 3) . '.' . substr($d, 6, 3) . '-' . substr($d, 9, 2);
        $motorista = Motorista::where('cpf', $cpf)->first();

        // Achou o motorista? Então procura o LOGIN dele (users.motorista_id), com perfil motorista.
        return $motorista
            ? User::where('motorista_id', $motorista->id)->where('perfil', 'motorista')->first()
            : null;
    }

    // Recebe login (e-mail ou CPF) e senha; se estiverem certos, devolve um token de acesso.
    public function login(Request $request): JsonResponse
    {
        // Aceita o campo "login" (novo) ou "email" (versões antigas do app).
        // merge = troca o valor dentro da requisição; trim = tira espaços das pontas.
        $request->merge(['login' => trim((string) $request->input('login', $request->input('email', '')))]);

        $dados = $request->validate([
            'login'    => ['required', 'string', 'max:255'],
            'password' => ['required'],
        ], [
            'login.required'    => 'Informe o e-mail ou o CPF.',
            'password.required' => 'Informe a senha.',
        ]);

        // Contador de erros por login + IP. O CPF conta só pelos números
        // (assim "096.668.979-89" e "09666897989" são o mesmo login e não escapam do bloqueio).
        // E-mail em minúsculas: "Admin@x.com" e "admin@x.com" contam juntos.
        $loginNormalizado = str_contains($dados['login'], '@')
            ? mb_strtolower($dados['login'])
            : preg_replace('/\D/', '', $dados['login']);
        // A "chave" identifica o contador no cache. Ex.: "login|09666897989|127.0.0.1".
        $chave = 'login|' . $loginNormalizado . '|' . $request->ip();

        // Já errou 5 vezes? Recusa sem nem conferir a senha.
        if (RateLimiter::tooManyAttempts($chave, self::MAX_TENTATIVAS)) {
            // availableIn = segundos que faltam para liberar; ceil arredonda para cima em minutos.
            $minutos = (int) ceil(RateLimiter::availableIn($chave) / 60);
            $this->registrar($request, $dados['login'], 'login', false, null, 'Bloqueado por excesso de tentativas');

            // 429 = código HTTP "muitas requisições".
            return response()->json([
                'message' => "Muitas tentativas erradas. Login bloqueado por {$minutos} minuto(s).",
            ], 429);
        }

        $usuario = $this->buscarUsuario($dados['login']);

        // A mesma mensagem para login errado ou senha errada, para não revelar quem está cadastrado.
        // O motivo exato fica só no log (que só o admin consegue ver).
        // Hash::check(senhaDigitada, hashDoBanco) = true se a senha bate.
        if (! $usuario || ! Hash::check($dados['password'], $usuario->password)) {
            // hit = soma 1 erro no contador; o contador "vence" em 15 minutos (15 * 60 segundos).
            RateLimiter::hit($chave, self::MINUTOS_BLOQUEIO * 60);
            // "$usuario?->id" = se $usuario for null, passa null sem dar erro.
            $this->registrar($request, $dados['login'], 'login', false, $usuario?->id,
                $usuario ? 'Senha incorreta' : 'Login não cadastrado');

            // 401 = código HTTP "não autenticado".
            return response()->json(['message' => 'Login ou senha inválidos.'], 401);
        }

        // Motorista com cadastro inativo não entra.
        if ($usuario->perfil === 'motorista') {
            $motorista = Motorista::find($usuario->motorista_id);

            if (! $motorista || ! $motorista->ativo) {
                $this->registrar($request, $dados['login'], 'login', false, $usuario->id, 'Motorista inativo');

                // 403 = código HTTP "proibido" (sabemos quem é, mas não pode entrar).
                return response()->json(['message' => 'Seu acesso está desativado. Fale com o administrador.'], 403);
            }
        }

        // Acertou: zera o contador de erros.
        RateLimiter::clear($chave);

        $this->registrar($request, $this->identificacao($usuario), 'login', true, $usuario->id);

        return response()->json([
            // createToken cria uma linha em personal_access_tokens (guardada como hash)
            // e plainTextToken é o token "legível", que só é mostrado AGORA, para o app guardar.
            'token'   => $usuario->createToken('app-mobile')->plainTextToken,
            // Dados que o app usa para saber quem entrou e qual menu mostrar (admin ou motorista).
            'usuario' => [
                'id'     => $usuario->id,
                'nome'   => $usuario->name,
                'email'  => $usuario->email,
                'login'  => $this->identificacao($usuario),
                'perfil' => $usuario->perfil ?? 'admin',   // "??" = se for null, considera admin
            ],
        ]);
    }

    // Apaga o token usado na requisição, encerrando a sessão daquele aparelho.
    // (Os tokens de outros aparelhos do mesmo usuário continuam valendo.)
    public function logout(Request $request): JsonResponse
    {
        // $request->user() = o usuário dono do token (o middleware auth:sanctum já encontrou).
        $usuario = $request->user();
        $this->registrar($request, $this->identificacao($usuario), 'logout', true, $usuario->id);

        // currentAccessToken() = o token desta requisição; delete() apaga a linha do banco.
        $usuario->currentAccessToken()->delete();

        return response()->json(['message' => 'Sessão encerrada.']);
    }
}