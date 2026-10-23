<?php

namespace App\Http\Controllers;

use App\Models\Abastecimento;
use App\Models\AuditLog;
use App\Models\Caminhao;
use App\Models\EntradaCombustivel;
use App\Models\Lavagem;
use App\Models\Manutencao;
use App\Models\NotaFiscal;
use App\Support\Consumo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RelatorioController extends Controller
{
    public function consumo(Request $request): JsonResponse
    {
        [$de, $ate] = $this->periodo($request);
        $query = Abastecimento::with(['caminhao:id,placa,modelo,meta_km_l', 'motorista:id,nome'])
            ->whereDate('data', '>=', $de)
            ->whereDate('data', '<=', $ate);

        if ($caminhaoId = $request->integer('caminhao_id')) {
            $query->where('caminhao_id', $caminhaoId);
        }

        $lista = $query->orderBy('data')->get();
        $dias = $lista->groupBy(fn ($a) => $a->data->toDateString())
            ->map(fn ($grupo, $dia) => [
                'data' => $dia,
                'litros' => round((float) $grupo->sum('litros'), 2),
                'quantidade' => $grupo->count(),
            ])
            ->values();

        $anomalias = [];
        $ranking = $lista->groupBy('caminhao_id')->map(function ($grupo) use (&$anomalias) {
            $caminhao = $grupo->first()->caminhao;
            $media = $caminhao ? Consumo::mediaCaminhao($caminhao) : null;
            $meta = $caminhao?->meta_km_l !== null ? (float) $caminhao->meta_km_l : null;
            $desvioMeta = ($media !== null && $meta) ? round($media - $meta, 2) : null;

            $trechos = $caminhao
                ? Consumo::trechos($caminhao->abastecimentos()->orderBy('km')->orderBy('data')->orderBy('id')->get())
                : collect();
            $ultimo = $trechos->last();
            $anomalo = $media && $ultimo && $ultimo['km_l'] < ($media * 0.75);
            if ($anomalo && $caminhao) {
                $anomalias[] = [
                    'caminhao_id' => $caminhao->id,
                    'placa' => $caminhao->placa,
                    'ultimo_km_l' => $ultimo['km_l'],
                    'media_km_l' => $media,
                ];
            }

            return [
                'caminhao_id' => $grupo->first()->caminhao_id,
                'placa' => $caminhao?->placa,
                'modelo' => $caminhao?->modelo,
                'litros' => round((float) $grupo->sum('litros'), 2),
                'quantidade' => $grupo->count(),
                'media_km_l' => $media,
                'meta_km_l' => $meta,
                'desvio_meta' => $desvioMeta,
                'consumo_anomalo' => $anomalo,
            ];
        })->sortByDesc('litros')->values();

        $totalLitros = (float) $lista->sum('litros');
        $nDias = max(1, (int) (new \DateTime($de))->diff(new \DateTime($ate))->days + 1);

        return response()->json([
            'de' => $de,
            'ate' => $ate,
            'total_litros' => round($totalLitros, 2),
            'media_diaria' => round($totalLitros / $nDias, 2),
            'quantidade' => $lista->count(),
            'serie' => $dias,
            'ranking' => $ranking,
            'anomalias' => $anomalias,
        ]);
    }

    public function rankingMotoristas(Request $request): JsonResponse
    {
        [$de, $ate] = $this->periodo($request);
        $lista = Abastecimento::with('motorista:id,nome')
            ->whereDate('data', '>=', $de)
            ->whereDate('data', '<=', $ate)
            ->whereNotNull('motorista_id')
            ->get();

        $ranking = $lista->groupBy('motorista_id')->map(function ($grupo) {
            $motorista = $grupo->first()->motorista;
            $porCaminhao = $grupo->groupBy('caminhao_id');
            $medias = [];
            foreach ($porCaminhao as $caminhaoId => $abs) {
                $caminhao = Caminhao::find($caminhaoId);
                if ($caminhao) {
                    $m = Consumo::mediaCaminhao($caminhao);
                    if ($m !== null) {
                        $medias[] = $m;
                    }
                }
            }

            return [
                'motorista_id' => $grupo->first()->motorista_id,
                'nome' => $motorista?->nome,
                'litros' => round((float) $grupo->sum('litros'), 2),
                'quantidade' => $grupo->count(),
                'media_km_l' => $medias ? round(array_sum($medias) / count($medias), 2) : null,
            ];
        })->sortByDesc(fn ($r) => $r['media_km_l'] ?? 0)->values();

        return response()->json([
            'de' => $de,
            'ate' => $ate,
            'ranking' => $ranking,
        ]);
    }

    public function cpk(Request $request): JsonResponse
    {
        [$de, $ate] = $this->periodo($request);

        $precoMedio = $this->precoMedioLitro($de, $ate);
        $abastecimentos = Abastecimento::with('caminhao:id,placa,modelo')
            ->whereDate('data', '>=', $de)
            ->whereDate('data', '<=', $ate)
            ->get();

        $custoCombustivel = round((float) $abastecimentos->sum('litros') * $precoMedio, 2);
        $custoManutencao = (float) Manutencao::whereDate('data', '>=', $de)
            ->whereDate('data', '<=', $ate)
            ->sum('valor');
        $custoLavagem = (float) Lavagem::whereDate('data', '>=', $de)
            ->whereDate('data', '<=', $ate)
            ->sum('valor');
        $custoTotal = round($custoCombustivel + $custoManutencao + $custoLavagem, 2);

        $porCaminhao = [];
        foreach (Caminhao::where('status', '!=', 'inativo')->orderBy('placa')->get() as $c) {
            $abs = $abastecimentos->where('caminhao_id', $c->id)->sortBy('km');
            $kmPeriodo = 0;
            if ($abs->count() >= 2) {
                $kmPeriodo = max(0, (int) $abs->last()->km - (int) $abs->first()->km);
            } elseif ($abs->count() === 1) {
                $kmPeriodo = max(0, (int) $c->km_atual - (int) $abs->first()->km);
            }

            $litros = (float) $abs->sum('litros');
            $manut = (float) Manutencao::where('caminhao_id', $c->id)
                ->whereDate('data', '>=', $de)->whereDate('data', '<=', $ate)->sum('valor');
            $lav = (float) Lavagem::where('caminhao_id', $c->id)
                ->whereDate('data', '>=', $de)->whereDate('data', '<=', $ate)->sum('valor');
            $custo = round(($litros * $precoMedio) + $manut + $lav, 2);

            $porCaminhao[] = [
                'caminhao_id' => $c->id,
                'placa' => $c->placa,
                'modelo' => $c->modelo,
                'km_periodo' => $kmPeriodo,
                'litros' => round($litros, 2),
                'custo_combustivel' => round($litros * $precoMedio, 2),
                'custo_manutencao' => round($manut, 2),
                'custo_lavagem' => round($lav, 2),
                'custo_total' => $custo,
                'cpk' => $kmPeriodo > 0 ? round($custo / $kmPeriodo, 4) : null,
            ];
        }

        $kmTotal = array_sum(array_column($porCaminhao, 'km_periodo'));

        return response()->json([
            'de' => $de,
            'ate' => $ate,
            'preco_medio_litro' => $precoMedio,
            'custo_combustivel' => $custoCombustivel,
            'custo_manutencao' => round($custoManutencao, 2),
            'custo_lavagem' => round($custoLavagem, 2),
            'custo_total' => $custoTotal,
            'km_total' => $kmTotal,
            'cpk' => $kmTotal > 0 ? round($custoTotal / $kmTotal, 4) : null,
            'por_caminhao' => $porCaminhao,
        ]);
    }

    public function disponibilidade(Request $request): JsonResponse
    {
        [$de, $ate] = $this->periodo($request);
        $diasMes = max(1, (int) (new \DateTime($de))->diff(new \DateTime($ate))->days + 1);

        $itens = Caminhao::where('status', '!=', 'inativo')->orderBy('placa')->get()->map(function (Caminhao $c) use ($de, $ate, $diasMes) {
            // MVP: dias em manutenção = dias com OS aberta/em andamento sobrepondo o mês,
            // ou status atual manutencao conta o mês inteiro se não houver datas.
            $os = Manutencao::where('caminhao_id', $c->id)
                ->whereIn('status', ['aberto', 'em_andamento', 'agendada'])
                ->where(function ($q) use ($de, $ate) {
                    $q->whereBetween('data_prevista', [$de, $ate])
                        ->orWhereBetween('data', [$de, $ate]);
                })
                ->get();

            $diasManut = min($diasMes, $os->count() > 0 ? $os->count() : ($c->status === 'manutencao' ? $diasMes : 0));
            $diasAtivo = max(0, $diasMes - $diasManut);
            $pct = round(($diasAtivo / $diasMes) * 100, 1);

            return [
                'caminhao_id' => $c->id,
                'placa' => $c->placa,
                'modelo' => $c->modelo,
                'status' => $c->status,
                'dias_mes' => $diasMes,
                'dias_ativo' => $diasAtivo,
                'dias_manutencao' => $diasManut,
                'disponibilidade_pct' => $pct,
            ];
        });

        $media = $itens->count() ? round($itens->avg('disponibilidade_pct'), 1) : null;

        return response()->json([
            'de' => $de,
            'ate' => $ate,
            'media_frota_pct' => $media,
            'caminhoes' => $itens->values(),
        ]);
    }

    public function abastecimentos(Request $request): JsonResponse
    {
        [$de, $ate] = $this->periodo($request);
        $query = Abastecimento::with([
            'caminhao:id,placa',
            'motorista:id,nome',
            'tanque:id,nome',
            'usuario:id,name',
        ])
            ->whereDate('data', '>=', $de)
            ->whereDate('data', '<=', $ate)
            ->orderByDesc('data')
            ->orderByDesc('id');

        if ($origem = $request->string('origem')->toString()) {
            $query->where('origem', $origem);
        }
        if ($caminhaoId = $request->integer('caminhao_id')) {
            $query->where('caminhao_id', $caminhaoId);
        }

        return response()->json($query->limit(300)->get());
    }

    public function quilometragem(): JsonResponse
    {
        $caminhoes = Caminhao::with('motorista:id,nome')
            ->orderBy('placa')
            ->get()
            ->map(function (Caminhao $c) {
                $ultimo = $c->abastecimentos()->orderByDesc('km')->orderByDesc('id')->first();
                $media = $c->media_km_l;
                $meta = $c->meta_km_l !== null ? (float) $c->meta_km_l : null;

                return [
                    'id' => $c->id,
                    'placa' => $c->placa,
                    'modelo' => $c->modelo,
                    'km_atual' => $c->km_atual,
                    'status' => $c->status,
                    'motorista' => $c->motorista?->nome,
                    'media_km_l' => $media,
                    'meta_km_l' => $meta,
                    'desvio_meta' => ($media !== null && $meta) ? round($media - $meta, 2) : null,
                    'ultimo_abastecimento_km' => $ultimo?->km,
                    'ultimo_abastecimento_data' => $ultimo?->data?->toDateString(),
                ];
            });

        return response()->json($caminhoes);
    }

    public function auditoria(Request $request): JsonResponse
    {
        $query = AuditLog::with('user:id,name,email,role')
            ->orderByDesc('id');

        if ($acao = $request->string('action')->toString()) {
            $query->where('action', 'like', $acao.'%');
        }

        return response()->json($query->limit(200)->get());
    }

    public function notas(Request $request): JsonResponse
    {
        $notas = NotaFiscal::with(['entradas.tanque:id,nome,tipo_combustivel'])
            ->orderByDesc('data_emissao')
            ->orderByDesc('id')
            ->limit((int) $request->integer('limit') ?: 30)
            ->get();

        return response()->json($notas);
    }

    private function periodo(Request $request): array
    {
        $mes = (int) ($request->integer('mes') ?: now()->month);
        $ano = (int) ($request->integer('ano') ?: now()->year);
        $de = $request->string('de')->toString() ?: sprintf('%04d-%02d-01', $ano, $mes);
        $ate = $request->string('ate')->toString() ?: date('Y-m-t', strtotime($de));

        return [$de, $ate];
    }

    private function precoMedioLitro(string $de, string $ate): float
    {
        $entradas = EntradaCombustivel::whereDate('data', '>=', $de)
            ->whereDate('data', '<=', $ate)
            ->where('litros', '>', 0)
            ->get();

        if ($entradas->isEmpty()) {
            $entradas = EntradaCombustivel::where('litros', '>', 0)->orderByDesc('data')->limit(5)->get();
        }

        if ($entradas->isEmpty()) {
            return 5.89;
        }

        $totalL = (float) $entradas->sum('litros');
        $totalV = (float) $entradas->sum('valor_total');

        return $totalL > 0 ? round($totalV / $totalL, 4) : 5.89;
    }
}
