<?php

namespace App\Http\Controllers;

use App\Models\Abastecimento;
use App\Models\Lavagem;
use App\Models\Manutencao;
use App\Models\Motorista;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

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

        $abastecimentos = Abastecimento::where('status', 'aprovado')
            ->with(['caminhao:id,placa,modelo', 'tanque:id,nome'])
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
        $porTanque = $abastecimentos->whereNotNull('tanque_id')->groupBy('tanque_id')->map(fn ($itens) => [
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

    // GET /api/relatorios/motoristas?dias=7|30|90|0 — o que cada motorista fez no período:
    // abastecimentos, litros, km, consumo, lavagens e manutenções.
    public function motoristas(Request $request): JsonResponse
    {
        $dias = (int) $request->query('dias', 30);
        if (! in_array($dias, [0, 7, 30, 90], true)) {
            $dias = 30;
        }
        $inicio = $dias > 0 ? now()->subDays($dias)->toDateString() : null;

        $abastecimentos = Abastecimento::where('status', 'aprovado')
            ->with('caminhao:id,placa')
            ->when($inicio, fn ($q) => $q->where('data', '>=', $inicio))
            ->orderBy('data')->orderBy('id')
            ->get()
            ->groupBy('motorista_id');

        // Lavagens: só filtra por data se a coluna "data" existir na tabela.
        $filtraLavagem = $inicio && Schema::hasColumn('lavagens', 'data');
        $lavagens = Lavagem::query()->where('status', 'aprovado')
            ->when($filtraLavagem, fn ($q) => $q->where('data', '>=', $inicio))
            ->get()->groupBy('motorista_id');

        $manutencoes = Manutencao::query()->where('status', 'aprovado')
            ->when($inicio, fn ($q) => $q->where('data', '>=', $inicio))
            ->get()->groupBy('motorista_id');

        $lista = Motorista::orderBy('nome')->get()->map(function ($motorista) use ($abastecimentos, $lavagens, $manutencoes) {
            $itens = $abastecimentos->get($motorista->id, collect());

            // Consumo: para cada caminhão que ele dirigiu, km rodados entre o primeiro e o último
            // abastecimento ÷ litros (sem contar o primeiro, que repõe o que foi gasto antes do período).
            $km = 0;
            $litrosConsumo = 0.0;
            foreach ($itens->groupBy('caminhao_id') as $doCaminhao) {
                if ($doCaminhao->count() < 2) continue;
                $km += $doCaminhao->max('km') - $doCaminhao->min('km');
                $litrosConsumo += (float) $doCaminhao->sum('litros') - (float) $doCaminhao->first()->litros;
            }

            $manut = $manutencoes->get($motorista->id, collect());

            return [
                'motorista_id'   => $motorista->id,
                'nome'           => $motorista->nome,
                'placas'         => $itens->pluck('caminhao.placa')->unique()->values(),
                'abastecimentos' => $itens->count(),
                'litros'         => round((float) $itens->sum('litros'), 2),
                'km_rodados'     => $km,
                'consumo_km_l'   => ($litrosConsumo > 0 && $km > 0) ? round($km / $litrosConsumo, 2) : null,
                'lavagens'       => $lavagens->get($motorista->id, collect())->count(),
                'manutencoes'    => $manut->count(),
                'gasto_manutencao' => round((float) $manut->sum('valor'), 2),
            ];
        });

        // Quem tem atividade vem primeiro (mais litros no topo); os sem atividade ficam no fim.
        $lista = $lista->sortByDesc(fn ($m) => [$m['litros'], $m['lavagens'] + $m['manutencoes']])->values();

        return response()->json([
            'dias'      => $dias,
            'resumo'    => [
                'motoristas'     => $lista->count(),
                'com_atividade'  => $lista->filter(fn ($m) => $m['abastecimentos'] + $m['lavagens'] + $m['manutencoes'] > 0)->count(),
                'total_litros'   => round((float) $lista->sum('litros'), 2),
            ],
            'motoristas' => $lista,
        ]);
    }
}