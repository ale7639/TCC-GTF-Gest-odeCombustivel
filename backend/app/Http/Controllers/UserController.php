<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            User::with('motorista:id,nome,telefone')->orderBy('name')->get()->map->toPublicArray()->values()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', Rule::in([User::ADMIN, User::SUPERVISOR, User::MOTORISTA])],
            'motorista_id' => ['nullable', 'integer', 'exists:motoristas,id', 'unique:users,motorista_id'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $usuario = User::create($dados);
        Auditoria::registrar('usuario.criar', $usuario, ['email' => $usuario->email, 'role' => $usuario->role]);

        return response()->json($usuario->toPublicArray(), 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $dados = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'role' => ['sometimes', Rule::in([User::ADMIN, User::SUPERVISOR, User::MOTORISTA])],
            'is_active' => ['sometimes', 'boolean'],
            'motorista_id' => ['nullable', 'integer', 'exists:motoristas,id', Rule::unique('users', 'motorista_id')->ignore($user->id)],
        ]);

        if ($request->user()->id === $user->id && isset($dados['role']) && $dados['role'] !== User::ADMIN) {
            return response()->json(['message' => 'Você não pode rebaixar o próprio perfil.'], 422);
        }

        $user->update($dados);
        Auditoria::registrar('usuario.editar', $user, ['role' => $user->role]);

        return response()->json($user->fresh()->toPublicArray());
    }
}
