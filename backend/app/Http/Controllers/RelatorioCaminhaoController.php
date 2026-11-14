<?php

namespace App\Http\Controllers;

use App\Models\Abastecimento;
use App\Models\Caminhao;
use App\Models\Lavagem;
use App\Models\Manutencao;
use App\Models\Motorista;
use App\Models\NotaFiscal;
use App\Models\Tanque;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

// Relatório de UM caminhão: tudo o que foi feito nele no período
// (abastecimentos, manutenções, lavagens e outras notas fiscais), com um resumo de gastos.
class RelatorioCaminhaoController extends Controller
{
    // GET /api/relatorios/caminhoes/{caminhao}?dias=7|30|90|0   (0 = todo o período)
    public function show(Request $request, Caminhao $caminhao): JsonResponse
    {
        $dias = (int) $request->query('dias', 30);
        if (! in_array($dias, [0, 7, 30, 90], true)) {
            $dias = 30;
        }
        $inicio = $dias > 0 ? now()->subDays($dias)->toDateString() : null;

        // Nomes buscados uma vez só (em vez de uma consulta por item).
        $motoristas = Motorista::pluck('nome', 'id');
        $tanques    = Tanque::pluck('nome', 'id');

        // ---- Abastecimentos aprovados (os pendentes ainda não "aconteceram") ----
        $abastecimentos = Abastecimento::where('caminhao_id', $caminhao->id)
            ->where('status', 'aprovado')
            ->when($inicio, fn ($q) => $q->where('data', '>=', $inicio))
            ->orderBy('data')->orderBy('id')
            ->get();

        // ---- Manutenções e lavagens aprovadas ----
        $manutencoes = Manutencao::where('caminhao_id', $caminhao->id)
            ->where('status', 'aprovado')
            ->when($inicio, fn ($q) => $q->where('data', '>=', $inicio))
            ->get();

        $lavagens = Lavagem::where('caminhao_id', $caminhao->id)
            ->where('status', 'aprovado')
            ->when($inicio, fn ($q) => $q->where('data', '>=', $inicio))
            ->get();

        // ---- Outras notas fiscais do caminhão (peças, pneus, compra do veículo...) ----
        // As notas de manutenção ficam de fora daqui para o valor não ser contado duas vezes.
        $notas = NotaFiscal::where('caminhao_id', $caminhao->id)
            ->whereDoesntHave('manutencoes')
            ->when($inicio, fn ($q) => $q->where('data_emissao', '>=', $inicio))
            ->get();

        // ---- Consumo: mesma regra dos outros relatórios ----
        // km rodados entre o primeiro e o último abastecimento ÷ litros (sem o primeiro, que repõe o
        // que foi gasto antes do período). Precisa de pelo menos 2 abastecimentos.
        $kmRodados       = $abastecimentos->count() > 1 ? $abastecimentos->max('km') - $abastecimentos->min('km') : 0;
        $litrosDoConsumo = $abastecimentos->count() > 1
            ? (float) $abastecimentos->sum('litros') - (float) $abastecimentos->first()->litros
            : 0;

        $gastoCombustivel = (float) $abastecimentos->sum('custo_total');
        $gastoManutencao  = (float) $manutencoes->sum('valor');
        $gastoNotas       = (float) $notas->sum('valor_total');

        // ---- Linha do tempo: tudo junto, no mesmo formato ----
        $historico = collect();

        foreach ($abastecimentos as $a) {
            $historico->push($this->item('abastecimento', $a->id, $a->data,
                'Abastecimento · ' . self::litros($a->litros) . ' L',
                [
                    $a->origem === 'externo'
                        ? 'Fora da base · ' . ($a->posto ?: 'posto')
                        : 'Na base · ' . ($tanques[$a->tanque_id] ?? 'tanque'),
                    number_format((int) $a->km, 0, ',', '.') . ' km',
                    $motoristas[$a->motorista_id] ?? null,
                ],
                $a->custo_total !== null ? (float) $a->custo_total : null));
        }

        foreach ($manutencoes as $m) {
            $historico->push($this->item('manutencao', $m->id, $m->data,
                'Manutenção · ' . $m->tipo,
                [$m->descricao, $m->km ? number_format((int) $m->km, 0, ',', '.') . ' km' : null, $motoristas[$m->motorista_id] ?? null],
                (float) $m->valor));
        }

        foreach ($lavagens as $l) {
            $historico->push($this->item('lavagem', $l->id, $l->data,
                'Lavagem',
                [$l->observacao, $motoristas[$l->motorista_id] ?? null],
                $l->valor > 0 ? (float) $l->valor : null));
        }

        foreach ($notas as $n) {
            $historico->push($this->item('nota', $n->id, $n->data_emissao,
                ($n->categoria ?: 'Nota fiscal') . ' · NF ' . $n->numero,
                [$n->fornecedor, $n->descricao],
                (float) $n->valor_total));
        }

        return response()->json([
            'dias'     => $dias,
            'caminhao' => [
                'id'                => $caminhao->id,
                'placa'             => $caminhao->placa,
                'modelo'            => $caminhao->modelo,
                'ano'               => $caminhao->ano,
                'km_atual'          => (int) $caminhao->km_atual,
                'capacidade_tanque' => (float) $caminhao->capacidade_tanque,
                'status'            => $caminhao->status,
                'motorista'         => $motoristas[$caminhao->motorista_id] ?? null,
            ],
            'resumo' => [
                'abastecimentos'    => $abastecimentos->count(),
                'litros'            => round((float) $abastecimentos->sum('litros'), 2),
                'km_rodados'        => $kmRodados,
                'consumo_km_l'      => ($litrosDoConsumo > 0 && $kmRodados > 0) ? round($kmRodados / $litrosDoConsumo, 2) : null,
                'gasto_combustivel' => round($gastoCombustivel, 2),
                'manutencoes'       => $manutencoes->count(),
                'gasto_manutencao'  => round($gastoManutencao, 2),
                'lavagens'          => $lavagens->count(),
                'notas'             => $notas->count(),
                'gasto_notas'       => round($gastoNotas, 2),
                'gasto_total'       => round($gastoCombustivel + $gastoManutencao + $gastoNotas, 2),
            ],
            // Mais recente primeiro.
            'historico' => $historico->sortByDesc(fn ($i) => [$i['data'], $i['id']])->values(),
        ]);
    }

    // Um item da linha do tempo (mesmo formato para todos os tipos).
    private function item(string $tipo, int $id, $data, string $titulo, array $linhas, ?float $valor): array
    {
        $d = Carbon::parse($data);

        return [
            'tipo'    => $tipo,
            'id'      => $id,
            'data'    => $d->toDateString(),
            'data_br' => $d->format('d/m/Y'),
            'titulo'  => $titulo,
            'linhas'  => array_values(array_filter($linhas)), // tira os vazios
            'valor'   => $valor !== null ? round($valor, 2) : null,
        ];
    }

    private static function litros($v): string
    {
        return rtrim(rtrim(number_format((float) $v, 2, ',', '.'), '0'), ',');
    }
}