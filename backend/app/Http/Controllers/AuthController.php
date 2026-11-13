<?php

namespace App\Http\Controllers;

use App\Models\LogAcesso;
use App\Models\Motorista;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

class AuthController extends Controller
{
    // Bloqueio contra quem tenta adivinhar senhas:
    // depois de 5 erros seguidos para o mesmo login (no mesmo IP), o login fica bloqueado por 15 minutos.
    private const MAX_TENTATIVAS = 5;
    private const MINUTOS_BLOQUEIO = 15;

    // Grava uma linha no log de acesso ("login" = e-mail do admin ou CPF do motorista).
    private function registrar(Request $request, string $login, string $evento, bool $sucesso, ?int $userId = null, ?string $motivo = null): void
    {
        LogAcesso::create([
            'user_id'     => $userId,
            'email'       => mb_substr($login, 0, 255),
            'evento'      => $evento,
            'sucesso'     => $sucesso,
            'motivo'      => $motivo,
            'ip'          => $request->ip(),
            'dispositivo' => LogAcesso::resumirDispositivo($request->userAgent()),
        ]);
    }

    // Como o usuário se identifica: o admin pelo e-mail, o motorista pelo CPF.
    private function identificacao(User $usuario): string
    {
        if ($usuario->perfil === 'motorista') {
            return (string) Motorista::whereKey($usuario->motorista_id)->value('cpf');
        }

        return (string) $usuario->email;
    }

    // Encontra o usuário pelo que foi digitado:
    //  - com "@"  -> e-mail (só administrador);
    //  - 11 números -> CPF de um motorista com acesso liberado.
    private function buscarUsuario(string $login): ?User
    {
        if (str_contains($login, '@')) {
            return User::where('email', $login)
                ->where(fn ($q) => $q->whereNull('perfil')->orWhere('perfil', '!=', 'motorista'))
                ->first();
        }

        $d = preg_replace('/\D/', '', $login);
        if (strlen($d) !== 11) {
            return null;
        }

        // O CPF fica gravado no formato 000.000.000-00.
        $cpf       = substr($d, 0, 3) . '.' . substr($d, 3, 3) . '.' . substr($d, 6, 3) . '-' . substr($d, 9, 2);
        $motorista = Motorista::where('cpf', $cpf)->first();

        return $motorista
            ? User::where('motorista_id', $motorista->id)->where('perfil', 'motorista')->first()
            : null;
    }

    // Recebe login (e-mail ou CPF) e senha; se estiverem certos, devolve um token de acesso.
    public function login(Request $request): JsonResponse
    {
        // Aceita o campo "login" (novo) ou "email" (versões antigas do app).
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
        $loginNormalizado = str_contains($dados['login'], '@')
            ? mb_strtolower($dados['login'])
            : preg_replace('/\D/', '', $dados['login']);
        $chave = 'login|' . $loginNormalizado . '|' . $request->ip();

        if (RateLimiter::tooManyAttempts($chave, self::MAX_TENTATIVAS)) {
            $minutos = (int) ceil(RateLimiter::availableIn($chave) / 60);
            $this->registrar($request, $dados['login'], 'login', false, null, 'Bloqueado por excesso de tentativas');

            return response()->json([
                'message' => "Muitas tentativas erradas. Login bloqueado por {$minutos} minuto(s).",
            ], 429);
        }

        $usuario = $this->buscarUsuario($dados['login']);

        // A mesma mensagem para login errado ou senha errada, para não revelar quem está cadastrado.
        // O motivo exato fica só no log (que só o admin consegue ver).
        if (! $usuario || ! Hash::check($dados['password'], $usuario->password)) {
            RateLimiter::hit($chave, self::MINUTOS_BLOQUEIO * 60);
            $this->registrar($request, $dados['login'], 'login', false, $usuario?->id,
                $usuario ? 'Senha incorreta' : 'Login não cadastrado');

            return response()->json(['message' => 'Login ou senha inválidos.'], 401);
        }

        // Motorista com cadastro inativo não entra.
        if ($usuario->perfil === 'motorista') {
            $motorista = Motorista::find($usuario->motorista_id);

            if (! $motorista || ! $motorista->ativo) {
                $this->registrar($request, $dados['login'], 'login', false, $usuario->id, 'Motorista inativo');

                return response()->json(['message' => 'Seu acesso está desativado. Fale com o administrador.'], 403);
            }
        }

        // Acertou: zera o contador de erros.
        RateLimiter::clear($chave);

        $this->registrar($request, $this->identificacao($usuario), 'login', true, $usuario->id);

        return response()->json([
            'token'   => $usuario->createToken('app-mobile')->plainTextToken,
            'usuario' => [
                'id'     => $usuario->id,
                'nome'   => $usuario->name,
                'email'  => $usuario->email,
                'login'  => $this->identificacao($usuario),
                'perfil' => $usuario->perfil ?? 'admin',
            ],
        ]);
    }

    // Apaga o token usado na requisição, encerrando a sessão daquele aparelho.
    public function logout(Request $request): JsonResponse
    {
        $usuario = $request->user();
        $this->registrar($request, $this->identificacao($usuario), 'logout', true, $usuario->id);

        $usuario->currentAccessToken()->delete();

        return response()->json(['message' => 'Sessão encerrada.']);
    }
}