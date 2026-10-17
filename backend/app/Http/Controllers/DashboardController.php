<?php

namespace App\Http\Controllers;

use App\Models\Abastecimento;
use App\Models\Caminhao;
use App\Models\Manutencao;
use App\Models\Tanque;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function index(): JsonResponse
    {
        // Data de 30 dias atrás: base para os totais do período.
        $inicio = now()->subDays(30)->toDateString();

        // Para cada tanque, calcula o percentual cheio e marca alerta se estiver abaixo de 20%.
        $tanques = Tanque::all()->map(function ($tanque) {
            $percentual = $tanque->capacidade > 0
                ? ($tanque->nivel_atual / $tanque->capacidade) * 100
                : 0;

            return [
                'id'               => $tanque->id,
                'nome'             => $tanque->nome,
                'tipo_combustivel' => $tanque->tipo_combustivel,
                'capacidade'       => (float) $tanque->capacidade,
                'nivel_atual'      => (float) $tanque->nivel_atual,
                'percentual'       => round($percentual, 1),
                'alerta'           => $percentual < 20,
            ];
        });

        // Os 5 abastecimentos mais recentes. O with() já traz caminhão, motorista e tanque
        // numa consulta só, evitando uma consulta por linha.
        $ultimos = Abastecimento::with(['caminhao:id,placa', 'motorista:id,nome', 'tanque:id,nome'])
            ->orderByDesc('data')
            ->orderByDesc('id')
            ->limit(5)
            ->get()
            ->map(fn ($a) => [
                'id'        => $a->id,
                'data'      => $a->data->toDateString(),
                'litros'    => (float) $a->litros,
                'placa'     => $a->caminhao->placa,
                'motorista' => $a->motorista->nome,
                'tanque'    => $a->tanque->nome,
            ]);

        return response()->json([
            'caminhoes' => [
                'total'         => Caminhao::count(),
                'ativos'        => Caminhao::where('status', 'ativo')->count(),
                'em_manutencao' => Caminhao::where('status', 'manutencao')->count(),
            ],
            'litros_abastecidos_30_dias' => (float) Abastecimento::where('data', '>=', $inicio)->sum('litros'),
            'gasto_manutencao_30_dias'   => (float) Manutencao::where('data', '>=', $inicio)->sum('valor'),
            'tanques'                    => $tanques,
            'ultimos_abastecimentos'     => $ultimos,
        ]);
    }
}