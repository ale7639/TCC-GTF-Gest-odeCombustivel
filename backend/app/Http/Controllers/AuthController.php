<?php

namespace App\Http\Controllers;

use App\Models\LogAcesso;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    // Grava uma linha no log de acesso.
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

    // Recebe e-mail e senha; se estiverem certos, devolve um token de acesso.
    public function login(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required'],
        ]);

        $usuario = User::where('email', $dados['email'])->first();

        // A mesma mensagem para e-mail errado ou senha errada, para não revelar quais e-mails existem.
        // O motivo exato fica só no log (que só quem está logado consegue ver).
        if (! $usuario || ! Hash::check($dados['password'], $usuario->password)) {
            $this->registrar($request, $dados['email'], 'login', false, $usuario?->id,
                $usuario ? 'Senha incorreta' : 'E-mail não cadastrado');

            return response()->json(['message' => 'E-mail ou senha inválidos.'], 401);
        }

        $this->registrar($request, $usuario->email, 'login', true, $usuario->id);

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
        $usuario = $request->user();
        $this->registrar($request, $usuario->email, 'logout', true, $usuario->id);

        $usuario->currentAccessToken()->delete();

        return response()->json(['message' => 'Sessão encerrada.']);
    }
}