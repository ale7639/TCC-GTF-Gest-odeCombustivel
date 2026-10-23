<?php

namespace App\Http\Controllers;

use App\Models\Caminhao;
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
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        $usuario = User::where('email', $dados['email'])->first();

        if (! $usuario || ! $usuario->is_active || ! Hash::check($dados['password'], $usuario->password)) {
            return response()->json(['message' => 'E-mail ou senha inválidos.'], 401);
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
