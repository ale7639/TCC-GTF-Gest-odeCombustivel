<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

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
        $usuario = $request->user()->load('motorista:id,nome,telefone');

        return response()->json($usuario->toPublicArray() + [
            'motorista' => $usuario->motorista,
        ]);
    }
}
