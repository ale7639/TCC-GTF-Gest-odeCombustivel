<?php

namespace App\Http\Controllers;

use App\Models\Abastecimento;
use App\Models\Caminhao;
use App\Models\Manutencao;
use App\Models\Tanque;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $usuario = $request->user();
        $inicio = now()->subDays(30)->toDateString();
        $hoje = now()->toDateString();

        $caminhoes = Caminhao::query();
        $abastecimentos = Abastecimento::query();
        if ($usuario->isMotorista()) {
            $caminhoes->where('motorista_id', $usuario->motorista_id);
            $abastecimentos->where('motorista_id', $usuario->motorista_id);
        }

        $tanques = Tanque::orderBy('nome')->get()->map(function ($tanque) {
            $percentual = $tanque->capacidade > 0
                ? ($tanque->nivel_atual / $tanque->capacidade) * 100
                : 0;

            return [
                'id' => $tanque->id,
                'nome' => $tanque->nome,
                'tipo_combustivel' => $tanque->tipo_combustivel,
                'capacidade' => (float) $tanque->capacidade,
                'nivel_atual' => (float) $tanque->nivel_atual,
                'percentual' => round($percentual, 1),
                'alerta' => $percentual < 20,
            ];
        });

        $ultimos = (clone $abastecimentos)
            ->with(['caminhao:id,placa', 'motorista:id,nome', 'tanque:id,nome'])
            ->orderByDesc('data')
            ->orderByDesc('id')
            ->limit(5)
            ->get()
            ->map(fn ($a) => [
                'id' => $a->id,
                'data' => $a->data->toDateString(),
                'litros' => (float) $a->litros,
                'origem' => $a->origem,
                'placa' => $a->caminhao?->placa,
                'motorista' => $a->motorista?->nome,
                'tanque' => $a->tanque?->nome,
                'comprovante_url' => $a->comprovante_url,
            ]);

        $hojeQuery = (clone $abastecimentos)->whereDate('data', $hoje);
        $totalFrota = (clone $caminhoes)->where('status', '!=', 'inativo')->count();
        $ativos = (clone $caminhoes)->where('status', 'ativo')->count();
        $emManut = (clone $caminhoes)->where('status', 'manutencao')->count();

        return response()->json([
            'caminhoes' => [
                'total' => (clone $caminhoes)->count(),
                'ativos' => $ativos,
                'em_manutencao' => $emManut,
                'disponibilidade_pct' => $totalFrota > 0 ? round(($ativos / $totalFrota) * 100, 1) : null,
            ],
            'litros_abastecidos_30_dias' => (float) (clone $abastecimentos)->where('data', '>=', $inicio)->sum('litros'),
            'abastecimentos_hoje' => (clone $hojeQuery)->count(),
            'litros_hoje' => (float) (clone $hojeQuery)->sum('litros'),
            'gasto_manutencao_30_dias' => $usuario->isMotorista()
                ? null
                : (float) Manutencao::where('data', '>=', $inicio)->sum('valor'),
            'tanques' => $tanques,
            'ultimos_abastecimentos' => $ultimos,
            // Alertas operacionais vivem no sino (/api/notificacoes), não no painel.
            'alertas' => [],
        ]);
    }
}
