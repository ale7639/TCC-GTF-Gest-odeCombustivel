<?php

namespace App\Http\Controllers;

use App\Models\Caminhao;
use App\Support\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ManutencaoController extends Controller
{
    public function index(Caminhao $caminhao): JsonResponse
    {
        $this->authorize('view', $caminhao);

        return response()->json(
            $caminhao->manutencoes()->with(['motorista:id,nome', 'notaFiscal'])->orderByDesc('data')->limit(20)->get()
        );
    }

    public function store(Request $request, Caminhao $caminhao): JsonResponse
    {
        $this->authorize('operar', $caminhao);
        abort_unless($request->user()->isGestao(), 403, 'Acesso não autorizado para o seu perfil.');

        $dados = $request->validate([
            'data' => ['required', 'date', 'before_or_equal:today'],
            'tipo' => ['required', 'string', 'max:120'],
            'descricao' => ['nullable', 'string'],
            'valor' => ['required', 'numeric', 'min:0'],
            'km' => ['required', 'integer', 'min:0'],
        ]);

        $motoristaId = $caminhao->motorista_id;
        if (! $motoristaId) {
            return response()->json(['message' => 'Vincule um motorista ao caminhão antes de registrar a manutenção.'], 422);
        }

        $manutencao = $caminhao->manutencoes()->create([
            'motorista_id' => $motoristaId,
            'data' => $dados['data'],
            'tipo' => $dados['tipo'],
            'descricao' => $dados['descricao'] ?? null,
            'valor' => $dados['valor'],
            'km' => $dados['km'],
        ]);

        if ($dados['km'] > $caminhao->km_atual) {
            $caminhao->update(['km_atual' => $dados['km']]);
        }

        Auditoria::registrar('manutencao.criar', $manutencao, ['placa' => $caminhao->placa]);

        return response()->json($manutencao->load('motorista:id,nome'), 201);
    }
}
