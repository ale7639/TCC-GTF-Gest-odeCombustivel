<?php

namespace App\Http\Controllers;

use App\Models\Abastecimento;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RelatorioController extends Controller
{
    // GET /api/relatorios/abastecimentos?dias=7|30|90|0 — consumo por caminhão e litros por tanque.
    // dias=0 significa "todo o período".
    public function abastecimentos(Request $request): JsonResponse
    {
        $dias = (int) $request->query('dias', 30);
        if (! in_array($dias, [0, 7, 30, 90], true)) {
            $dias = 30;
        }

        $abastecimentos = Abastecimento::with(['caminhao:id,placa,modelo', 'tanque:id,nome'])
            ->when($dias > 0, fn ($q) => $q->where('data', '>=', now()->subDays($dias)->toDateString()))
            ->orderBy('data')
            ->orderBy('id')
            ->get();

        // Por caminhão: litros, quilômetros rodados e consumo médio no período.
        $porCaminhao = $abastecimentos->groupBy('caminhao_id')->map(function ($itens) {
            $primeiro  = $itens->first();
            $litros    = (float) $itens->sum('litros');
            $kmRodados = $itens->max('km') - $itens->min('km');

            // O primeiro abastecimento só repõe o que foi gasto ANTES do período,
            // então não entra na conta do consumo (por isso são precisos pelo menos dois).
            $litrosDoConsumo = $litros - (float) $primeiro->litros;

            return [
                'caminhao_id'    => $primeiro->caminhao_id,
                'placa'          => $primeiro->caminhao->placa,
                'modelo'         => $primeiro->caminhao->modelo,
                'abastecimentos' => $itens->count(),
                'litros'         => round($litros, 2),
                'km_rodados'     => $kmRodados,
                'consumo_km_l'   => ($itens->count() > 1 && $litrosDoConsumo > 0 && $kmRodados > 0)
                    ? round($kmRodados / $litrosDoConsumo, 2)
                    : null,
            ];
        })->sortByDesc('litros')->values();

        // Por tanque: quanto saiu de cada um.
        $porTanque = $abastecimentos->groupBy('tanque_id')->map(fn ($itens) => [
            'tanque_id'      => $itens->first()->tanque_id,
            'nome'           => $itens->first()->tanque->nome,
            'abastecimentos' => $itens->count(),
            'litros'         => round((float) $itens->sum('litros'), 2),
        ])->sortByDesc('litros')->values();

        $mediaFrota = $porCaminhao->whereNotNull('consumo_km_l')->avg('consumo_km_l');

        return response()->json([
            'dias' => $dias,
            'resumo' => [
                'total_litros'        => round((float) $abastecimentos->sum('litros'), 2),
                'abastecimentos'      => $abastecimentos->count(),
                'caminhoes_atendidos' => $porCaminhao->count(),
                'consumo_medio_km_l'  => $mediaFrota !== null ? round($mediaFrota, 2) : null,
            ],
            'por_caminhao' => $porCaminhao,
            'por_tanque'   => $porTanque,
        ]);
    }
}