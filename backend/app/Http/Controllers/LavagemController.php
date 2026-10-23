<?php

namespace App\Http\Controllers;

use App\Models\Caminhao;
use App\Support\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LavagemController extends Controller
{
    public function index(Caminhao $caminhao): JsonResponse
    {
        $this->authorize('view', $caminhao);

        return response()->json(
            $caminhao->lavagens()->with('motorista:id,nome')->orderByDesc('data')->limit(20)->get()
        );
    }

    public function store(Request $request, Caminhao $caminhao): JsonResponse
    {
        $this->authorize('operar', $caminhao);

        $dados = $request->validate([
            'data' => ['required', 'date', 'before_or_equal:today'],
            'valor' => ['nullable', 'numeric', 'min:0'],
            'observacao' => ['nullable', 'string', 'max:255'],
        ]);

        $motoristaId = $caminhao->motorista_id ?? $request->user()->motorista_id;
        if (! $motoristaId) {
            return response()->json(['message' => 'Vincule um motorista ao caminhão antes de registrar a lavagem.'], 422);
        }

        $lavagem = $caminhao->lavagens()->create([
            'motorista_id' => $motoristaId,
            'data' => $dados['data'],
            'valor' => $dados['valor'] ?? 0,
            'observacao' => $dados['observacao'] ?? null,
        ]);

        Auditoria::registrar('lavagem.criar', $lavagem, ['placa' => $caminhao->placa]);

        return response()->json($lavagem->load('motorista:id,nome'), 201);
    }
}
