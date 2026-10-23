<?php

namespace App\Http\Controllers;

use App\Models\Tanque;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TanqueController extends Controller
{
    // GET /api/tanques — lista os tanques da empresa com o nível atual.
    public function index(): JsonResponse
    {
        return response()->json(Tanque::orderBy('nome')->get());
    }

    // POST /api/tanques — cadastra um tanque novo, com o nível inicial informado (ou zero).
    public function store(Request $request): JsonResponse
    {
        $dados = $this->validar($request);
        $nivel = (float) ($dados['nivel_atual'] ?? 0);

        if ($nivel > (float) $dados['capacidade']) {
            throw ValidationException::withMessages([
                'nivel_atual' => 'O nível inicial não pode passar da capacidade.',
            ]);
        }

        $tanque = Tanque::create([
            'nome'             => $dados['nome'],
            'tipo_combustivel' => $dados['tipo_combustivel'],
            'capacidade'       => $dados['capacidade'],
            'nivel_atual'      => $nivel,
        ]);

        return response()->json($tanque, 201);
    }

    // GET /api/tanques/{id} — um tanque só.
    public function show(Tanque $tanque): JsonResponse
    {
        return response()->json($tanque);
    }

    // PUT /api/tanques/{id} — altera nome, tipo e capacidade.
    // O nível NÃO é alterado aqui: ele muda com as entradas de combustível e os abastecimentos.
    public function update(Request $request, Tanque $tanque): JsonResponse
    {
        $dados = $this->validar($request, $tanque);

        if ((float) $dados['capacidade'] < (float) $tanque->nivel_atual) {
            throw ValidationException::withMessages([
                'capacidade' => 'A capacidade não pode ser menor que o nível atual (' . (float) $tanque->nivel_atual . ' L).',
            ]);
        }

        $tanque->update(Arr::only($dados, ['nome', 'tipo_combustivel', 'capacidade']));

        return response()->json($tanque->refresh());
    }

    // DELETE /api/tanques/{id} — exclui, mas só se nunca foi usado.
    public function destroy(Tanque $tanque): JsonResponse
    {
        if ($tanque->abastecimentos()->exists() || $tanque->entradas()->exists()) {
            return response()->json([
                'message' => 'Este tanque tem histórico de abastecimentos ou entradas de combustível e não pode ser excluído.',
            ], 409);
        }

        $tanque->delete();

        return response()->json(['message' => 'Tanque excluído.']);
    }

    // Regras de validação, iguais para cadastrar e para alterar.
    private function validar(Request $request, ?Tanque $tanque = null): array
    {
        return $request->validate([
            'nome' => [
                'required', 'string', 'max:255',
                Rule::unique('tanques', 'nome')->ignore($tanque?->id),
            ],
            'tipo_combustivel' => ['required', 'string', 'max:255'],
            'capacidade'       => ['required', 'numeric', 'min:1', 'max:99999999'],
            'nivel_atual'      => ['nullable', 'numeric', 'min:0', 'max:99999999'],
        ], [
            'nome.unique' => 'Já existe um tanque com este nome.',
            'required'    => 'Preencha o campo :attribute.',
        ], [
            'tipo_combustivel' => 'tipo de combustível',
            'nivel_atual'      => 'nível inicial',
        ]);
    }
}