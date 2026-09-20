<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Models\AuditLog;
use App\Models\User;
use App\Support\PasswordRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::query()->where('email', $request->string('email')->lower())->first();

        if ($user && $user->isLocked()) {
            $minutes = now()->diffInMinutes($user->locked_until, false);

            return response()->json([
                'message' => 'Conta bloqueada por excesso de tentativas. Tente novamente em '.$minutes.' minuto(s).',
                'locked_until' => $user->locked_until->toIso8601String(),
            ], 423);
        }

        if (! $user || ! Hash::check($request->input('password'), $user->password) || ! $user->is_active) {
            if ($user && $user->is_active) {
                $user->increment('failed_login_attempts');
                $user->refresh();

                if ($user->failed_login_attempts >= 5) {
                    $user->locked_until = now()->addMinutes(15);
                    $user->failed_login_attempts = 0;
                    $user->save();

                    return response()->json([
                        'message' => 'Conta bloqueada por 15 minutos após 5 tentativas incorretas.',
                        'locked_until' => $user->locked_until->toIso8601String(),
                    ], 423);
                }
            }

            return response()->json([
                'message' => 'E-mail ou senha inválidos. Verifique seus dados e tente novamente.',
            ], 401);
        }

        $user->forceFill([
            'failed_login_attempts' => 0,
            'locked_until' => null,
        ])->save();

        $user->tokens()->delete();
        $token = $user->createToken('gfc', ['*'], now()->addHours(24))->plainTextToken;

        AuditLog::record($user, 'auth.login', User::class, $user->id, [], $request->ip());

        return response()->json([
            'token' => $token,
            'token_type' => 'Bearer',
            'expires_in' => 86400,
            'user' => $this->userPayload($user),
        ]);
    }

    public function register(RegisterRequest $request): JsonResponse
    {
        $user = User::query()->create([
            'name' => $request->string('name')->trim(),
            'email' => $request->string('email')->lower(),
            'password' => $request->input('password'),
            'role' => User::ROLE_MOTORISTA,
            'is_active' => true,
        ]);

        AuditLog::record($user, 'auth.register', User::class, $user->id, [], $request->ip());

        return response()->json([
            'message' => 'Conta criada com sucesso. Faça login para continuar.',
            'user' => $this->userPayload($user),
        ], 201);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        Password::sendResetLink($request->only('email'));

        return response()->json([
            'message' => 'Se o e-mail estiver cadastrado, enviaremos um link de recuperação. Verifique sua caixa de entrada.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'confirmed', 'regex:'.PasswordRules::regex()],
        ], [
            'password.confirmed' => 'As senhas não coincidem.',
            'password.regex' => PasswordRules::message(),
        ]);

        $user = User::query()->where('email', $request->string('email')->lower())->first();

        if ($user && Hash::check($request->input('password'), $user->password)) {
            throw ValidationException::withMessages([
                'password' => 'A nova senha não pode ser igual à senha anterior.',
            ]);
        }

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                    'failed_login_attempts' => 0,
                    'locked_until' => null,
                ])->save();

                $user->tokens()->delete();
            }
        );

        if ($status === Password::INVALID_TOKEN) {
            return response()->json([
                'message' => 'Este link expirou. Solicite um novo link de recuperação.',
            ], 422);
        }

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json([
                'message' => 'Este link expirou. Solicite um novo link de recuperação.',
            ], 422);
        }

        return response()->json([
            'message' => 'Senha atualizada com sucesso. Faça login com a nova senha.',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $this->userPayload($request->user())]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'confirmed', 'regex:'.PasswordRules::regex()],
        ], [
            'password.confirmed' => 'As senhas não coincidem.',
            'password.regex' => PasswordRules::message(),
        ]);

        $user = $request->user();

        if (! Hash::check($request->input('current_password'), $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => 'A senha atual não confere.',
            ]);
        }

        if (Hash::check($request->input('password'), $user->password)) {
            throw ValidationException::withMessages([
                'password' => 'A nova senha não pode ser igual à senha anterior.',
            ]);
        }

        $user->forceFill(['password' => $request->input('password')])->save();
        $user->tokens()->where('id', '!=', $user->currentAccessToken()?->id)->delete();

        AuditLog::record($user, 'auth.senha', User::class, $user->id, [], $request->ip());

        return response()->json(['message' => 'Senha atualizada com sucesso.']);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Sessão encerrada.']);
    }

    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
        ];
    }
}
