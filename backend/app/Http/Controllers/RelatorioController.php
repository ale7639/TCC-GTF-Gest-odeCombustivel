<?php

namespace App\Http\Controllers;

use App\Models\Abastecimento;
use App\Models\Caminhao;
use App\Models\Lavagem;
use App\Models\Manutencao;
use App\Models\Motorista;
use App\Models\NotaFiscal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\StreamedResponse;

class RelatorioController extends Controller
{
    // RELATORIO — consumo, ranking, históricos e exportação CSV.

    // RELATORIO ABASTECIMENTOS — consumo por caminhão e litros por tanque (dias=0 = tudo).
    public function abastecimentos(Request $request): JsonResponse
    {
        $dias = $this->dias($request);
        $abastecimentos = $this->abastecimentosPeriodo($dias);

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
        $totalLitros = round((float) $abastecimentos->sum('litros'), 2);

        // Litros por dia (para o gráfico de barras do Relatórios).
        $porDia = $abastecimentos
            ->groupBy(fn ($a) => substr((string) $a->data, 0, 10))
            ->map(fn ($itens, $dia) => [
                'dia'    => $dia,
                'litros' => round((float) $itens->sum('litros'), 2),
                'qtd'    => $itens->count(),
            ])
            ->sortKeys()
            ->values();

        $diasComDados = max(1, $porDia->count());
        $mediaDiaria = round($totalLitros / $diasComDados, 1);

        return response()->json([
            'dias' => $dias,
            'resumo' => [
                'total_litros'        => $totalLitros,
                'abastecimentos'      => $abastecimentos->count(),
                'caminhoes_atendidos' => $porCaminhao->count(),
                'consumo_medio_km_l'  => $mediaFrota !== null ? round($mediaFrota, 2) : null,
                'media_diaria'        => $mediaDiaria,
            ],
            'por_dia'      => $porDia,
            'por_caminhao' => $porCaminhao,
            'por_tanque'   => $porTanque,
        ]);
    }

    // RELATORIO EXPORTAR — CSV do relatório de combustível.
    public function exportarAbastecimentos(Request $request): StreamedResponse
    {
        $dias = $this->dias($request);
        $abastecimentos = $this->abastecimentosPeriodo($dias);

        $linhas = [
            ['Data', 'Placa', 'Modelo', 'Motorista', 'Tanque', 'Origem', 'Posto', 'Litros', 'Km', 'Valor (R$)', 'Status'],
        ];

        foreach ($abastecimentos as $a) {
            $linhas[] = [
                Carbon::parse($a->data)->format('d/m/Y'),
                $a->caminhao?->placa ?? '',
                $a->caminhao?->modelo ?? '',
                $a->motorista?->nome ?? '',
                $a->tanque?->nome ?? '',
                $a->origem === 'externo' ? 'Posto' : 'Base',
                $a->posto ?? '',
                number_format((float) $a->litros, 2, ',', '.'),
                (string) $a->km,
                number_format((float) ($a->valor_total ?? $a->custo_total ?? 0), 2, ',', '.'),
                $a->status,
            ];
        }

        return $this->csv('relatorio-abastecimentos.csv', $linhas);
    }

    // RELATORIO EXPORTAR_NF — CSV de NFs + gastos do período.
    public function exportarNotasFiscais(Request $request): StreamedResponse
    {
        $dias   = $this->dias($request);
        $inicio = $dias > 0 ? now()->subDays($dias)->toDateString() : null;
        $origem = in_array($request->query('origem'), ['compra', 'posto'], true) ? $request->query('origem') : 'todas';
        $busca  = trim((string) $request->query('busca', ''));
        $fornecedorFiltro = trim((string) $request->query('fornecedor', ''));

        $notas  = collect();
        $placas = Caminhao::pluck('placa', 'id');

        if ($origem !== 'posto') {
            NotaFiscal::with(['entradas.tanque:id,nome', 'manutencoes:id,nota_fiscal_id,tipo'])
                ->when($inicio, fn ($q) => $q->where('data_emissao', '>=', $inicio))
                ->when($fornecedorFiltro !== '', fn ($q) => $q->where('fornecedor', $fornecedorFiltro))
                ->when($busca !== '', fn ($q) => $q->where(fn ($q) => $q
                    ->where('numero', 'like', "%{$busca}%")->orWhere('fornecedor', 'like', "%{$busca}%")))
                ->orderByDesc('data_emissao')
                ->get()
                ->each(function ($n) use ($notas, $placas) {
                    $entrada    = $n->entradas->first();
                    $manutencao = $n->manutencoes->first();
                    $placa      = $n->caminhao_id ? ($placas[$n->caminhao_id] ?? null) : null;

                    if ($entrada) {
                        $categoria = 'Combustível';
                        $descricao = 'Combustível · ' . ($entrada->tanque?->nome ?? 'tanque');
                    } elseif ($manutencao) {
                        $categoria = 'Manutenção';
                        $descricao = 'Manutenção · ' . $manutencao->tipo . ($placa ? ' · ' . $placa : '');
                    } else {
                        $categoria = $n->categoria ?: 'Outros';
                        $descricao = implode(' · ', array_filter([$categoria, $n->descricao, $placa]));
                    }

                    $notas->push([
                        Carbon::parse($n->data_emissao)->format('d/m/Y'),
                        $n->numero,
                        $n->fornecedor,
                        'Empresa',
                        $categoria,
                        $descricao,
                        number_format((float) $n->valor_total, 2, ',', '.'),
                    ]);
                });
        }

        if ($origem !== 'compra') {
            Abastecimento::with('caminhao:id,placa')
                ->where('status', 'aprovado')->where('origem', 'externo')
                ->when($inicio, fn ($q) => $q->where('data', '>=', $inicio))
                ->when($fornecedorFiltro !== '', fn ($q) => $q->where('posto', $fornecedorFiltro))
                ->when($busca !== '', fn ($q) => $q->where(fn ($q) => $q
                    ->where('nota_numero', 'like', "%{$busca}%")->orWhere('posto', 'like', "%{$busca}%")))
                ->orderByDesc('data')
                ->get()
                ->each(function ($a) use ($notas) {
                    $notas->push([
                        Carbon::parse($a->data)->format('d/m/Y'),
                        $a->nota_numero ?: 'sem número',
                        $a->posto ?: 'Posto não informado',
                        'Posto',
                        'Combustível (posto)',
                        'Abastecimento fora da base · ' . ($a->caminhao?->placa ?? ''),
                        number_format((float) $a->valor_total, 2, ',', '.'),
                    ]);
                });
        }

        $linhas = array_merge(
            [['Data', 'Número', 'Fornecedor/Posto', 'Origem', 'Categoria', 'Descrição', 'Valor (R$)']],
            $notas->all()
        );

        return $this->csv('relatorio-notas-fiscais.csv', $linhas);
    }

    // RELATORIO MOTORISTAS — abastecimentos, litros, km, consumo, lavagens e manutenções.
    public function motoristas(Request $request): JsonResponse
    {
        $dias = $this->dias($request);
        $inicio = $dias > 0 ? now()->subDays($dias)->toDateString() : null;

        $abastecimentos = Abastecimento::where('status', 'aprovado')
            ->with('caminhao:id,placa')
            ->when($inicio, fn ($q) => $q->where('data', '>=', $inicio))
            ->orderBy('data')->orderBy('id')
            ->get()
            ->groupBy('motorista_id');

        // Lavagens: só filtra por data se a coluna "data" existir na tabela.
        $filtraLavagem = $inicio && Schema::hasColumn('lavagens', 'data');
        $lavagens = Lavagem::query()
            ->when(Schema::hasColumn('lavagens', 'status'), fn ($q) => $q->where('status', 'aprovado'))
            ->when($filtraLavagem, fn ($q) => $q->where('data', '>=', $inicio))
            ->get()->groupBy('motorista_id');

        $manutencoes = Manutencao::query()
            ->when(Schema::hasColumn('manutencoes', 'status'), fn ($q) => $q->where('status', 'aprovado'))
            ->when($inicio, fn ($q) => $q->where('data', '>=', $inicio))
            ->get()->groupBy('motorista_id');

        $lista = Motorista::orderBy('nome')->get()->map(function ($motorista) use ($abastecimentos, $lavagens, $manutencoes) {
            $itens = $abastecimentos->get($motorista->id, collect());

            // Consumo: para cada caminhão que ele dirigiu, km rodados entre o primeiro e o último
            // abastecimento ÷ litros (sem contar o primeiro, que repõe o que foi gasto antes do período).
            $km = 0;
            $litrosConsumo = 0.0;
            foreach ($itens->groupBy('caminhao_id') as $doCaminhao) {
                if ($doCaminhao->count() < 2) {
                    continue;
                }
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

    // RELATORIO HISTORICO_MOTORISTA — ações do motorista no período.
    public function motoristaHistorico(Request $request, Motorista $motorista): JsonResponse
    {
        $dias = $this->dias($request);
        $acoes = $this->acoesMotorista($motorista->id, $dias);

        return response()->json([
            'dias' => $dias,
            'motorista' => [
                'id'   => $motorista->id,
                'nome' => $motorista->nome,
                'cpf'  => $motorista->cpf,
            ],
            'resumo' => [
                'acoes'          => $acoes->count(),
                'abastecimentos' => $acoes->where('tipo', 'abastecimento')->count(),
                'lavagens'       => $acoes->where('tipo', 'lavagem')->count(),
                'manutencoes'    => $acoes->where('tipo', 'manutencao')->count(),
                'total_litros'   => round((float) $acoes->where('tipo', 'abastecimento')->sum('litros'), 2),
                'gasto_total'    => round((float) $acoes->sum('valor'), 2),
            ],
            'acoes' => $acoes->values(),
        ]);
    }

    // RELATORIO EXPORTAR_MOTORISTA — CSV do histórico.
    public function exportarMotorista(Request $request, Motorista $motorista): StreamedResponse
    {
        $dias = $this->dias($request);
        $acoes = $this->acoesMotorista($motorista->id, $dias);
        $slug = preg_replace('/[^a-z0-9]+/i', '-', mb_strtolower($motorista->nome));

        $linhas = [
            ['Data', 'Tipo', 'Placa', 'Detalhe', 'Litros', 'Km', 'Valor (R$)', 'Status'],
        ];

        foreach ($acoes as $a) {
            $linhas[] = [
                $a['data_br'],
                $a['tipo_rotulo'],
                $a['placa'] ?? '',
                $a['detalhe'] ?? '',
                $a['litros'] !== null ? number_format((float) $a['litros'], 2, ',', '.') : '',
                $a['km'] !== null ? (string) $a['km'] : '',
                $a['valor'] !== null ? number_format((float) $a['valor'], 2, ',', '.') : '',
                $a['status'] ?? '',
            ];
        }

        return $this->csv("relatorio-motorista-{$slug}.csv", $linhas);
    }

    // RELATORIO HISTORICO_CAMINHAO — ações do caminhão no período.
    public function caminhaoHistorico(Request $request, Caminhao $caminhao): JsonResponse
    {
        $dias = $this->dias($request);
        $acoes = $this->acoesCaminhao($caminhao->id, $dias);

        return response()->json([
            'dias' => $dias,
            'caminhao' => [
                'id'     => $caminhao->id,
                'placa'  => $caminhao->placa,
                'modelo' => $caminhao->modelo,
            ],
            'resumo' => [
                'acoes'          => $acoes->count(),
                'abastecimentos' => $acoes->where('tipo', 'abastecimento')->count(),
                'lavagens'       => $acoes->where('tipo', 'lavagem')->count(),
                'manutencoes'    => $acoes->where('tipo', 'manutencao')->count(),
                'total_litros'   => round((float) $acoes->where('tipo', 'abastecimento')->sum('litros'), 2),
                'gasto_total'    => round((float) $acoes->sum('valor'), 2),
            ],
            'acoes' => $acoes->values(),
        ]);
    }

    // RELATORIO EXPORTAR_CAMINHAO — CSV do histórico.
    public function exportarCaminhao(Request $request, Caminhao $caminhao): StreamedResponse
    {
        $dias = $this->dias($request);
        $acoes = $this->acoesCaminhao($caminhao->id, $dias);
        $slug = preg_replace('/[^a-z0-9]+/i', '-', mb_strtolower($caminhao->placa));

        $linhas = [
            ['Data', 'Tipo', 'Motorista', 'Detalhe', 'Litros', 'Km', 'Valor (R$)', 'Status'],
        ];

        foreach ($acoes as $a) {
            $linhas[] = [
                $a['data_br'],
                $a['tipo_rotulo'],
                $a['motorista'] ?? '',
                $a['detalhe'] ?? '',
                $a['litros'] !== null ? number_format((float) $a['litros'], 2, ',', '.') : '',
                $a['km'] !== null ? (string) $a['km'] : '',
                $a['valor'] !== null ? number_format((float) $a['valor'], 2, ',', '.') : '',
                $a['status'] ?? '',
            ];
        }

        return $this->csv("relatorio-caminhao-{$slug}.csv", $linhas);
    }

    private function dias(Request $request): int
    {
        $dias = (int) $request->query('dias', 30);

        return in_array($dias, [0, 7, 30, 90], true) ? $dias : 30;
    }

    private function abastecimentosPeriodo(int $dias)
    {
        return Abastecimento::where('status', 'aprovado')
            ->with(['caminhao:id,placa,modelo', 'tanque:id,nome', 'motorista:id,nome'])
            ->when($dias > 0, fn ($q) => $q->where('data', '>=', now()->subDays($dias)->toDateString()))
            ->orderBy('data')
            ->orderBy('id')
            ->get();
    }

    private function acoesMotorista(int $motoristaId, int $dias)
    {
        return $this->acoesHistorico(['motorista_id' => $motoristaId], $dias, incluirPlaca: true);
    }

    private function acoesCaminhao(int $caminhaoId, int $dias)
    {
        return $this->acoesHistorico(['caminhao_id' => $caminhaoId], $dias, incluirMotorista: true);
    }

    private function acoesHistorico(array $filtro, int $dias, bool $incluirPlaca = false, bool $incluirMotorista = false)
    {
        $inicio = $dias > 0 ? now()->subDays($dias)->toDateString() : null;
        $acoes = collect();
        $withAb = array_filter([
            $incluirPlaca ? 'caminhao:id,placa' : null,
            $incluirMotorista ? 'motorista:id,nome' : null,
            'tanque:id,nome',
        ]);
        $withOutros = array_filter([
            $incluirPlaca ? 'caminhao:id,placa' : null,
            $incluirMotorista ? 'motorista:id,nome' : null,
        ]);

        Abastecimento::with($withAb ?: ['tanque:id,nome'])
            ->where($filtro)
            ->when($inicio, fn ($q) => $q->where('data', '>=', $inicio))
            ->orderByDesc('data')->orderByDesc('id')
            ->get()
            ->each(function ($a) use ($acoes, $incluirPlaca, $incluirMotorista) {
                $origem = $a->origem === 'externo' ? 'Posto' : 'Base';
                $acoes->push([
                    'id'          => 'ab-' . $a->id,
                    'tipo'        => 'abastecimento',
                    'tipo_rotulo' => 'Abastecimento',
                    'data'        => Carbon::parse($a->data)->toDateString(),
                    'data_br'     => Carbon::parse($a->data)->format('d/m/Y'),
                    'placa'       => $incluirPlaca ? $a->caminhao?->placa : null,
                    'motorista'   => $incluirMotorista ? $a->motorista?->nome : null,
                    'detalhe'     => trim($origem . ' · ' . ($a->tanque?->nome ?: ($a->posto ?: ''))),
                    'litros'      => (float) $a->litros,
                    'km'          => $a->km,
                    'valor'       => (float) ($a->valor_total ?? $a->custo_total ?? 0),
                    'status'      => $a->status,
                ]);
            });

        Lavagem::with($withOutros ?: [])
            ->where($filtro)
            ->when($inicio && Schema::hasColumn('lavagens', 'data'), fn ($q) => $q->where('data', '>=', $inicio))
            ->orderByDesc(Schema::hasColumn('lavagens', 'data') ? 'data' : 'id')
            ->get()
            ->each(function ($l) use ($acoes, $incluirPlaca, $incluirMotorista) {
                $data = Schema::hasColumn('lavagens', 'data') && $l->data
                    ? Carbon::parse($l->data)
                    : Carbon::parse($l->created_at);
                $acoes->push([
                    'id'          => 'lv-' . $l->id,
                    'tipo'        => 'lavagem',
                    'tipo_rotulo' => 'Lavagem',
                    'data'        => $data->toDateString(),
                    'data_br'     => $data->format('d/m/Y'),
                    'placa'       => $incluirPlaca ? $l->caminhao?->placa : null,
                    'motorista'   => $incluirMotorista ? $l->motorista?->nome : null,
                    'detalhe'     => $l->observacao ?: 'Lavagem',
                    'litros'      => null,
                    'km'          => null,
                    'valor'       => (float) ($l->valor ?? 0),
                    'status'      => $l->status ?? 'aprovado',
                ]);
            });

        Manutencao::with($withOutros ?: [])
            ->where($filtro)
            ->when($inicio, fn ($q) => $q->where('data', '>=', $inicio))
            ->orderByDesc('data')->orderByDesc('id')
            ->get()
            ->each(function ($m) use ($acoes, $incluirPlaca, $incluirMotorista) {
                $acoes->push([
                    'id'          => 'mt-' . $m->id,
                    'tipo'        => 'manutencao',
                    'tipo_rotulo' => 'Manutenção',
                    'data'        => Carbon::parse($m->data)->toDateString(),
                    'data_br'     => Carbon::parse($m->data)->format('d/m/Y'),
                    'placa'       => $incluirPlaca ? $m->caminhao?->placa : null,
                    'motorista'   => $incluirMotorista ? $m->motorista?->nome : null,
                    'detalhe'     => trim(($m->tipo ?? '') . ($m->descricao ? ' · ' . $m->descricao : '')),
                    'litros'      => null,
                    'km'          => $m->km,
                    'valor'       => (float) ($m->valor ?? 0),
                    'status'      => $m->status ?? 'aprovado',
                ]);
            });

        return $acoes->sortByDesc(fn ($a) => [$a['data'], $a['id']])->values();
    }

    private function csv(string $nome, array $linhas): StreamedResponse
    {
        return response()->streamDownload(function () use ($linhas) {
            $out = fopen('php://output', 'w');
            // BOM para o Excel abrir acentuação corretamente.
            fwrite($out, "\xEF\xBB\xBF");
            foreach ($linhas as $linha) {
                fputcsv($out, $linha, ';');
            }
            fclose($out);
        }, $nome, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
