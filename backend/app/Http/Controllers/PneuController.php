<?php

namespace App\Http\Controllers;

use App\Models\Caminhao;
use App\Models\Pneu;
use App\Support\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PneuController extends Controller
{
    public const POSICOES = [
        'DE', 'DD', 'TE', 'TD', 'EE1', 'ED1', 'EE2', 'ED2', 'estepe',
    ];

    public function index(Caminhao $caminhao): JsonResponse
    {
        $this->authorize('view', $caminhao);
        $lista = $caminhao->pneus()->with('caminhao:id,km_atual')->orderBy('posicao')->get();

        return response()->json($lista);
    }

    public function store(Request $request, Caminhao $caminhao): JsonResponse
    {
        $this->authorize('operar', $caminhao);
        abort_unless($request->user()->isGestao(), 403);

        $dados = $request->validate([
            'posicao' => ['required', 'string', 'max:40'],
            'data_troca' => ['nullable', 'date'],
            'km_troca' => ['nullable', 'integer', 'min:0'],
            'intervalo_km' => ['nullable', 'integer', 'min:5000', 'max:200000'],
            'observacao' => ['nullable', 'string', 'max:500'],
        ]);

        $pneu = Pneu::updateOrCreate(
            ['caminhao_id' => $caminhao->id, 'posicao' => $dados['posicao']],
            [
                'data_troca' => $dados['data_troca'] ?? null,
                'km_troca' => $dados['km_troca'] ?? $caminhao->km_atual,
                'intervalo_km' => $dados['intervalo_km'] ?? 60000,
                'observacao' => $dados['observacao'] ?? null,
            ]
        );

        Auditoria::registrar('pneu.salvar', $pneu, [
            'placa' => $caminhao->placa,
            'posicao' => $pneu->posicao,
        ]);

        return response()->json($pneu->load('caminhao:id,km_atual'), 201);
    }

    public function destroy(Request $request, Caminhao $caminhao, Pneu $pneu): JsonResponse
    {
        $this->authorize('operar', $caminhao);
        abort_unless($request->user()->isGestao(), 403);
        abort_unless($pneu->caminhao_id === $caminhao->id, 404);

        $pneu->delete();

        return response()->json(['message' => 'Pneu removido.']);
    }
}
