<?php

namespace App\Http\Controllers;

use App\Models\LogAcesso;
use App\Models\Motorista;
use App\Models\SolicitacaoSenha;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    // AUTH — login unificado (CPF/e-mail), esqueci senha e logout (Sanctum).

    // AUTH LOG — grava uma linha no log de acesso.
    private function registrar(Request $request, string $email, string $evento, bool $sucesso, ?int $userId = null, ?string $motivo = null): void
    {
        LogAcesso::create([
            'user_id'     => $userId,
            'email'       => mb_substr($email, 0, 255),
            'evento'      => $evento,
            'sucesso'     => $sucesso,
            'motivo'      => $motivo,
            'ip'          => $request->ip(),
            'dispositivo' => LogAcesso::resumirDispositivo($request->userAgent()),
        ]);
    }

    // AUTH LOGIN — admin por e-mail; motorista por CPF (identificador).
    public function login(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'login'    => ['nullable', 'string', 'max:255'],
            'email'    => ['nullable', 'string', 'max:255'],
            'cpf'      => ['nullable', 'string', 'max:20'],
            'password' => ['required', 'string'],
        ], [
            'password.required' => 'Informe a senha.',
            'required'          => 'Preencha o campo :attribute.',
        ]);

        $bruto = trim((string) ($dados['login'] ?? $dados['cpf'] ?? $dados['email'] ?? ''));
        if ($bruto === '') {
            return response()->json(['message' => 'Informe CPF (motorista) ou e-mail (administrador).'], 422);
        }

        $usuario = $this->resolverUsuarioLogin($dados);
        $rotulo  = $bruto;

        if (! $usuario || ! Hash::check($dados['password'], $usuario->password)) {
            $this->registrar(
                $request,
                $rotulo,
                'login',
                false,
                $usuario?->id,
                $usuario ? 'Senha incorreta' : 'Credencial não cadastrada'
            );

            return response()->json(['message' => 'CPF/e-mail ou senha inválidos.'], 401);
        }

        // Motorista autentica só por CPF; admin/gestor por e-mail.
        if (($usuario->perfil ?? 'admin') === 'motorista' && ! $this->loginFoiCpf($dados)) {
            $this->registrar($request, $usuario->email, 'login', false, $usuario->id, 'Motorista deve usar CPF');

            return response()->json([
                'message' => 'Motorista: entre com o CPF cadastrado e a senha.',
            ], 401);
        }

        if (($usuario->perfil ?? 'admin') === 'motorista') {
            $motorista = Motorista::find($usuario->motorista_id);

            if (! $motorista || ! $motorista->ativo) {
                $this->registrar($request, $usuario->email, 'login', false, $usuario->id, 'Motorista inativo');

                return response()->json(['message' => 'Seu acesso está desativado. Fale com o administrador.'], 403);
            }
        }

        $this->registrar($request, $usuario->email, 'login', true, $usuario->id);

        return response()->json([
            'token'   => $usuario->createToken('app-mobile')->plainTextToken,
            'usuario' => $this->payloadUsuario($usuario),
        ]);
    }

    // AUTH ESQUECI_SENHA — motorista informa CPF; resposta genérica; notifica o admin.
    public function esqueciSenha(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'cpf' => ['required', 'string', 'max:20'],
        ], [
            'cpf.required' => 'Informe o CPF.',
            'required'     => 'Preencha o campo :attribute.',
        ]);

        $mensagem = 'Se o CPF estiver cadastrado, o administrador receberá o pedido.';
        $digitos  = Motorista::cpfDigitos($dados['cpf']);

        if (strlen($digitos) === 11) {
            $cpf = Motorista::formatarCpf($digitos);
            $motorista = Motorista::query()
                ->where(function ($q) use ($cpf, $digitos) {
                    $q->where('cpf', $cpf)->orWhere('cpf', $digitos);
                })
                ->where('ativo', true)
                ->first();

            $temAcesso = $motorista && User::where('motorista_id', $motorista->id)
                ->where('perfil', 'motorista')
                ->exists();

            if ($temAcesso) {
                $pendente = SolicitacaoSenha::pendentes()
                    ->where('motorista_id', $motorista->id)
                    ->first();

                if ($pendente) {
                    $pendente->touch();
                } else {
                    SolicitacaoSenha::create([
                        'motorista_id' => $motorista->id,
                        'cpf'          => $motorista->cpf,
                        'nome'         => $motorista->nome,
                        'status'       => SolicitacaoSenha::PENDENTE,
                    ]);
                }

                $this->registrar($request, $motorista->cpf, 'esqueci_senha', true, null, 'Pedido registrado');
            }
        }

        return response()->json(['message' => $mensagem]);
    }

    // AUTH LOGOUT — apaga o token da requisição (encerra a sessão naquele aparelho).
    public function logout(Request $request): JsonResponse
    {
        $usuario = $request->user();
        $this->registrar($request, $usuario->email, 'logout', true, $usuario->id);

        $usuario->currentAccessToken()->delete();

        return response()->json(['message' => 'Sessão encerrada.']);
    }

    private function resolverUsuarioLogin(array $dados): ?User
    {
        $bruto = trim((string) ($dados['login'] ?? $dados['cpf'] ?? $dados['email'] ?? ''));
        if ($bruto === '') {
            return null;
        }

        $digitos = Motorista::cpfDigitos($bruto);
        if (strlen($digitos) === 11) {
            $cpfMascarado = Motorista::formatarCpf($digitos);

            $motorista = Motorista::query()
                ->where(function ($q) use ($cpfMascarado, $digitos) {
                    $q->where('cpf', $cpfMascarado)->orWhere('cpf', $digitos);
                })
                ->first();

            if (! $motorista) {
                return null;
            }

            return User::query()
                ->where('motorista_id', $motorista->id)
                ->where('perfil', 'motorista')
                ->first();
        }

        return User::where('email', strtolower($bruto))->first();
    }

    private function loginFoiCpf(array $dados): bool
    {
        $bruto = trim((string) ($dados['login'] ?? $dados['cpf'] ?? ''));

        return strlen(Motorista::cpfDigitos($bruto)) === 11;
    }

    private function payloadUsuario(User $usuario): array
    {
        return [
            'id'     => $usuario->id,
            'nome'   => $usuario->name,
            'email'  => $usuario->email,
            'perfil' => $usuario->perfil ?? 'admin',
        ];
    }
}
