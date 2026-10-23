<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    // Recebe e-mail e senha; se estiverem certos, devolve um token de acesso.
    public function login(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required'],
        ]);

        $usuario = User::where('email', $dados['email'])->first();

        // A mesma mensagem para e-mail errado ou senha errada, para não revelar quais e-mails existem.
        if (! $usuario || ! Hash::check($dados['password'], $usuario->password)) {
            return response()->json(['message' => 'E-mail ou senha inválidos.'], 401);
        }

        return response()->json([
            'token'   => $usuario->createToken('app-mobile')->plainTextToken,
            'usuario' => [
                'id'    => $usuario->id,
                'nome'  => $usuario->name,
                'email' => $usuario->email,
            ],
        ]);
    }

    // Apaga o token usado na requisição, encerrando a sessão daquele aparelho.
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Sessão encerrada.']);
    }
}