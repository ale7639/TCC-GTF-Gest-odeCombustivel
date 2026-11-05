<?php

namespace App\Http\Controllers;

use App\Models\Caminhao;
use App\Models\Motorista;
use App\Models\NotificacaoLeitura;
use App\Models\SolicitacaoSenha;
use App\Models\User;
use App\Support\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $dados = $request->validate([
            // login unificado (e-mail ou CPF) — preferido.
            'login' => ['nullable', 'string', 'max:255'],
            // Compat: clientes antigos ainda enviam e-mail.
            'email' => ['nullable', 'string', 'max:255'],
            'cpf' => ['nullable', 'string', 'max:20'],
            'password' => ['required', 'string'],
        ]);

        $usuario = $this->resolverUsuarioLogin($dados);

        if (! $usuario || ! $usuario->is_active || ! Hash::check($dados['password'], $usuario->password)) {
            return response()->json(['message' => 'Credenciais inválidas.'], 401);
        }

        // Motorista autentica por CPF; admin/supervisor por e-mail.
        if ($usuario->isMotorista() && ! $this->loginFoiCpf($dados)) {
            return response()->json([
                'message' => 'Motorista: entre com o CPF cadastrado e a senha.',
            ], 401);
        }

        $usuario->tokens()->delete();
        $token = $usuario->createToken('gfc', ['*'], now()->addHours(24))->plainTextToken;

        Auditoria::registrar('auth.login', $usuario);

        $publico = $usuario->toPublicArray();

        return response()->json([
            'token' => $token,
            'token_type' => 'Bearer',
            'expires_in' => 86400,
            'user' => $publico,
            'usuario' => [
                'id' => $usuario->id,
                'nome' => $usuario->name,
                'email' => $usuario->email,
                'role' => $usuario->role,
            ],
        ]);
    }

    /**
     * Pedido de troca de senha (motorista informa CPF).
     * Sempre responde genericamente; se existir, notifica o administrador no sino.
     */
    public function esqueciSenha(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'cpf' => ['required', 'string', 'max:20'],
        ]);

        $mensagem = 'Se o CPF estiver cadastrado, o administrador receberá o pedido.';
        $digitos = Motorista::cpfDigitos($dados['cpf']);

        if (strlen($digitos) === 11) {
            $cpf = Motorista::formatarCpf($digitos);
            $motorista = Motorista::query()
                ->where(function ($q) use ($cpf, $digitos) {
                    $q->where('cpf', $cpf)->orWhere('cpf', $digitos);
                })
                ->where('ativo', true)
                ->first();

            $temAcesso = $motorista && User::where('motorista_id', $motorista->id)
                ->where('role', User::MOTORISTA)
                ->where('is_active', true)
                ->exists();

            if ($temAcesso) {
                // Sempre gera pedido “novo” no sino: encerra pendente antiga e cria outra
                // (chave senha:{id} inédita → aparece como não lida para o ADM).
                $antigas = SolicitacaoSenha::pendentes()
                    ->where('motorista_id', $motorista->id)
                    ->get();
                foreach ($antigas as $antiga) {
                    NotificacaoLeitura::where('chave', 'senha:'.$antiga->id)->delete();
                    $antiga->update([
                        'status' => SolicitacaoSenha::ATENDIDA,
                        'atendida_em' => now(),
                    ]);
                }

                $nova = SolicitacaoSenha::create([
                    'motorista_id' => $motorista->id,
                    'cpf' => $motorista->cpf,
                    'nome' => $motorista->nome,
                    'status' => SolicitacaoSenha::PENDENTE,
                ]);

                // Garante que nenhum admin tenha essa chave marcada como lida.
                NotificacaoLeitura::where('chave', 'senha:'.$nova->id)->delete();

                Auditoria::registrar('auth.esqueci_senha', $motorista, [
                    'cpf' => $motorista->cpf,
                    'solicitacao_id' => $nova->id,
                ]);
            }
        }

        return response()->json(['message' => $mensagem]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Sessão encerrada.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($this->perfilCompleto($request->user()));
    }

    public function atualizarPerfil(Request $request): JsonResponse
    {
        $usuario = $request->user();
        $dados = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'telefone' => ['nullable', 'string', 'max:32'],
        ]);

        $usuario->update([
            'name' => $dados['name'],
            'telefone' => $dados['telefone'] ?: null,
        ]);

        Auditoria::registrar('perfil.editar', $usuario);

        return response()->json($this->perfilCompleto($usuario->fresh()));
    }

    public function alterarSenha(Request $request): JsonResponse
    {
        $usuario = $request->user();
        $dados = $request->validate([
            'senha_atual' => ['required', 'string'],
            'password' => ['required', 'confirmed', Password::min(8)],
        ]);

        if (! Hash::check($dados['senha_atual'], $usuario->password)) {
            return response()->json(['message' => 'Senha atual incorreta.'], 422);
        }

        $usuario->update(['password' => $dados['password']]);
        Auditoria::registrar('perfil.senha', $usuario);

        return response()->json(['message' => 'Senha atualizada.']);
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
                ->where('role', User::MOTORISTA)
                ->first();
        }

        return User::where('email', strtolower($bruto))->first();
    }

    private function loginFoiCpf(array $dados): bool
    {
        $bruto = trim((string) ($dados['login'] ?? $dados['cpf'] ?? ''));

        return strlen(Motorista::cpfDigitos($bruto)) === 11;
    }

    private function perfilCompleto(User $usuario): array
    {
        $usuario->load('motorista:id,nome,telefone,cnh,cnh_validade,cpf,ativo');

        $caminhao = null;
        if ($usuario->motorista_id) {
            $c = Caminhao::where('motorista_id', $usuario->motorista_id)->first();
            if ($c) {
                $caminhao = [
                    'id' => $c->id,
                    'placa' => $c->placa,
                    'modelo' => $c->modelo,
                    'status' => $c->status,
                    'km_atual' => $c->km_atual,
                ];
            }
        }

        $telefone = $usuario->telefone ?: $usuario->motorista?->telefone;

        return $usuario->toPublicArray() + [
            'telefone_exibicao' => $telefone,
            'motorista' => $usuario->motorista ? [
                'id' => $usuario->motorista->id,
                'nome' => $usuario->motorista->nome,
                'telefone' => $usuario->motorista->telefone,
                'cnh' => $usuario->motorista->cnh,
                'cnh_validade' => $usuario->motorista->cnh_validade?->toDateString(),
                'cpf' => $usuario->motorista->cpf,
                'ativo' => (bool) $usuario->motorista->ativo,
            ] : null,
            'caminhao' => $caminhao,
        ];
    }
}
