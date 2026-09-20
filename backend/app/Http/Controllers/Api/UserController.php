<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Support\PasswordRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        $users = User::query()->orderBy('name')->get(['id', 'name', 'email', 'role', 'is_active', 'created_at']);

        return response()->json(['data' => $users]);
    }

    public function updateRole(Request $request, User $user): JsonResponse
    {
        $request->validate([
            'role' => ['required', 'in:administrador,supervisor,motorista'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if ($user->id === $request->user()->id && $request->input('role') !== User::ROLE_ADMIN) {
            return response()->json(['message' => 'Você não pode remover o próprio perfil de administrador.'], 422);
        }

        $user->update($request->only(['role', 'is_active']));

        AuditLog::record($request->user(), 'usuario.perfil', User::class, $user->id, $request->only(['role', 'is_active']), $request->ip());

        return response()->json(['data' => $user]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'regex:'.PasswordRules::regex()],
            'role' => ['required', 'in:administrador,supervisor,motorista'],
        ], [
            'email.unique' => 'E-mail já cadastrado — Use outro e-mail ou faça login na sua conta.',
            'password.regex' => PasswordRules::message(),
        ]);

        $user = User::query()->create($data);

        return response()->json(['data' => $user], 201);
    }
}
