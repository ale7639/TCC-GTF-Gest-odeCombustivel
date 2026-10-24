<?php

namespace App\Http\Controllers;

use App\Models\Abastecimento;
use App\Models\EntradaCombustivel;
use App\Models\Manutencao;
use App\Models\NotaFiscal;
use App\Models\Tanque;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    // GET /api/dashboard?dias=7|30|90 — números do painel inicial no período escolhido.
    public function index(Request $request): JsonResponse
    {
        // Só aceita os períodos oferecidos na tela; qualquer outro valor vira 30 dias.
        $dias = (int) $request->query('dias', 30);
        if (! in_array($dias, [7, 30, 90], true)) {
            $dias = 30;
        }
        $inicio = now()->subDays($dias)->toDateString();

        // Todos os tanques, com percentual e alerta de nível baixo (menos de 20%).
        $tanques = Tanque::orderBy('nome')->get()->map(function ($tanque) {
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
                'principal'        => (bool) $tanque->principal,
            ];
        });

        // O principal é o que foi marcado como tal; se nenhum foi, vale o de maior capacidade.
        $principal = $tanques->firstWhere('principal', true)
            ?? $tanques->sortByDesc('capacidade')->first();

        $outros = $principal
            ? $tanques->where('id', '!=', $principal['id'])->values()
            : $tanques->values();

        // Os 5 abastecimentos mais recentes. O with() traz caminhão, motorista e tanque numa consulta só.
        $ultimosAbastecimentos = Abastecimento::with(['caminhao:id,placa', 'motorista:id,nome', 'tanque:id,nome'])
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

        // As 5 notas fiscais mais recentes, com o que cada uma comprou.
        $ultimasNotas = NotaFiscal::with(['entradas.tanque:id,nome', 'manutencoes:id,nota_fiscal_id,tipo'])
            ->orderByDesc('data_emissao')
            ->orderByDesc('id')
            ->limit(5)
            ->get()
            ->map(function ($nota) {
                $entrada    = $nota->entradas->first();
                $manutencao = $nota->manutencoes->first();

                if ($entrada) {
                    $descricao = 'Combustível · ' . $entrada->tanque->nome . ' · ' . (float) $entrada->litros . ' L';
                } elseif ($manutencao) {
                    $descricao = 'Manutenção · ' . $manutencao->tipo;
                } else {
                    $descricao = 'Sem vínculo';
                }

                return [
                    'id'           => $nota->id,
                    'numero'       => $nota->numero,
                    'fornecedor'   => $nota->fornecedor,
                    'data_emissao' => $nota->data_emissao->toDateString(),
                    'valor_total'  => (float) $nota->valor_total,
                    'descricao'    => $descricao,
                ];
            });

        return response()->json([
            'dias' => $dias,

            // Totais do período escolhido.
            'litros_abastecidos'  => (float) Abastecimento::where('data', '>=', $inicio)->sum('litros'),
            'litros_comprados'    => (float) EntradaCombustivel::where('data', '>=', $inicio)->sum('litros'),
            'gasto_combustivel'   => (float) EntradaCombustivel::where('data', '>=', $inicio)->sum('valor_total'),
            'gasto_manutencao'    => (float) Manutencao::where('data', '>=', $inicio)->sum('valor'),

            'tanque_principal'       => $principal,
            'outros_tanques'         => $outros,
            'ultimos_abastecimentos' => $ultimosAbastecimentos,
            'ultimas_notas_fiscais'  => $ultimasNotas,
        ]);
    }
}