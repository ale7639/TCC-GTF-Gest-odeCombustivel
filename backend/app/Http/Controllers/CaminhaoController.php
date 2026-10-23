<?php

namespace App\Http\Controllers;

use App\Models\Caminhao;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CaminhaoController extends Controller
{
    // GET /api/caminhoes — lista todos, com o nome do motorista responsável.
    public function index(): JsonResponse
    {
        $caminhoes = Caminhao::with('motorista:id,nome')->orderBy('placa')->get();

        return response()->json($caminhoes);
    }

    // POST /api/caminhoes — cadastra um caminhão novo.
    public function store(Request $request): JsonResponse
    {
        $caminhao = Caminhao::create($this->validar($request));

        return response()->json($caminhao->load('motorista:id,nome'), 201);
    }

    // GET /api/caminhoes/{id} — um caminhão só.
    public function show(Caminhao $caminhao): JsonResponse
    {
        return response()->json($caminhao->load('motorista:id,nome'));
    }

    // PUT /api/caminhoes/{id} — altera os dados de um caminhão.
    public function update(Request $request, Caminhao $caminhao): JsonResponse
    {
        $caminhao->update($this->validar($request, $caminhao));

        return response()->json($caminhao->load('motorista:id,nome'));
    }

    // DELETE /api/caminhoes/{id} — exclui, mas só se não houver histórico.
    public function destroy(Caminhao $caminhao): JsonResponse
    {
        $temHistorico = $caminhao->abastecimentos()->exists()
            || $caminhao->lavagens()->exists()
            || $caminhao->manutencoes()->exists();

        if ($temHistorico) {
            return response()->json([
                'message' => 'Este caminhão tem histórico de abastecimentos, lavagens ou manutenções. Mude o status para "inativo" em vez de excluir.',
            ], 409);
        }

        $caminhao->delete();

        return response()->json(['message' => 'Caminhão excluído.']);
    }

    // Regras de validação, iguais para cadastrar e para alterar.
    private function validar(Request $request, ?Caminhao $caminhao = null): array
    {
        // Padroniza a placa: maiúsculas e sem traço ou espaço (ABC-1D23 vira ABC1D23).
        if ($request->filled('placa')) {
            $request->merge([
                'placa' => strtoupper(str_replace(['-', ' '], '', $request->input('placa'))),
            ]);
        }

        return $request->validate([
            'placa' => [
                'required', 'string', 'max:8',
                Rule::unique('caminhoes', 'placa')->ignore($caminhao?->id),
            ],
            'modelo'            => ['required', 'string', 'max:255'],
            'ano'               => ['required', 'integer', 'between:1980,' . (date('Y') + 1)],
            'capacidade_tanque' => ['required', 'numeric', 'min:1', 'max:99999'],
            'km_atual'          => ['required', 'integer', 'min:0'],
            'status'            => ['required', Rule::in(['ativo', 'manutencao', 'inativo'])],
            'motorista_id'      => [
                'nullable', 'integer', 'exists:motoristas,id',
                Rule::unique('caminhoes', 'motorista_id')->ignore($caminhao?->id),
            ],
        ], [
            'placa.unique'        => 'Já existe um caminhão com esta placa.',
            'motorista_id.unique' => 'Este motorista já é responsável por outro caminhão.',
            'motorista_id.exists' => 'Motorista não encontrado.',
            'required'            => 'Preencha o campo :attribute.',
        ]);
    }
}