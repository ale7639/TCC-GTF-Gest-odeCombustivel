<?php

namespace App\Http\Controllers;

use App\Models\Abastecimento;
use App\Models\NotaFiscal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

// Todas as notas fiscais num lugar só:
//  - "compra": notas cadastradas nas entradas de combustível (e manutenções), tabela notas_fiscais;
//  - "posto":  notas dos abastecimentos fora da base já aprovados (nº da nota guardado no abastecimento).
class NotaFiscalController extends Controller
{
    // GET /api/notas-fiscais?dias=0|7|30|90&origem=todas|compra|posto&busca=&pagina=1
    public function index(Request $request): JsonResponse
    {
        $dias   = (int) $request->query('dias', 30);
        $inicio = in_array($dias, [7, 30, 90], true) ? now()->subDays($dias)->toDateString() : null;
        $origem = in_array($request->query('origem'), ['compra', 'posto'], true) ? $request->query('origem') : 'todas';
        $busca  = trim((string) $request->query('busca', ''));

        $notas = collect();

        if ($origem !== 'posto') {
            NotaFiscal::with(['entradas.tanque:id,nome', 'manutencoes:id,nota_fiscal_id,tipo'])
                ->when($inicio, fn ($q) => $q->where('data_emissao', '>=', $inicio))
                ->when($busca !== '', fn ($q) => $q->where(fn ($q) => $q
                    ->where('numero', 'like', "%{$busca}%")->orWhere('fornecedor', 'like', "%{$busca}%")))
                ->get()
                ->each(function ($n) use ($notas) {
                    $entrada    = $n->entradas->first();
                    $manutencao = $n->manutencoes->first();

                    $notas->push([
                        'chave'      => 'nf-' . $n->id,
                        'origem'     => 'compra',
                        'numero'     => $n->numero,
                        'fornecedor' => $n->fornecedor,
                        'data'       => Carbon::parse($n->data_emissao)->toDateString(),
                        'valor'      => (float) $n->valor_total,
                        'descricao'  => $entrada
                            ? 'Combustível · ' . ($entrada->tanque?->nome ?? 'tanque') . ' · ' . self::litros($entrada->litros) . ' L'
                            : ($manutencao ? 'Manutenção · ' . $manutencao->tipo : 'Sem vínculo'),
                        'chave_acesso' => $n->chave_acesso,
                        'foto_url'   => null,
                    ]);
                });
        }

        if ($origem !== 'compra') {
            Abastecimento::with('caminhao:id,placa')
                ->where('status', 'aprovado')->where('origem', 'externo')
                ->when($inicio, fn ($q) => $q->where('data', '>=', $inicio))
                ->when($busca !== '', fn ($q) => $q->where(fn ($q) => $q
                    ->where('nota_numero', 'like', "%{$busca}%")->orWhere('posto', 'like', "%{$busca}%")))
                ->get()
                ->each(function ($a) use ($notas) {
                    $notas->push([
                        'chave'      => 'ab-' . $a->id,
                        'origem'     => 'posto',
                        'numero'     => $a->nota_numero ?: 'sem número',
                        'fornecedor' => $a->posto ?: 'Posto não informado',
                        'data'       => $a->data->toDateString(),
                        'valor'      => (float) $a->valor_total,
                        'descricao'  => 'Abastecimento fora da base · ' . ($a->caminhao?->placa ?? '') . ' · ' . self::litros($a->litros) . ' L',
                        'chave_acesso' => null,
                        'foto_url'   => $a->fotoUrl(),
                    ]);
                });
        }

        $notas = $notas->sortByDesc('data')->values();

        // Resumo do período: total, quantidade e quanto foi gasto com cada fornecedor.
        $porFornecedor = $notas->groupBy('fornecedor')->map(fn ($itens, $nome) => [
            'fornecedor' => $nome,
            'notas'      => $itens->count(),
            'valor'      => round($itens->sum('valor'), 2),
        ])->sortByDesc('valor')->values()->take(6);

        // Paginação da lista (20 por página).
        $porPagina = 20;
        $pagina    = max(1, (int) $request->query('pagina', 1));
        $ultima    = max(1, (int) ceil($notas->count() / $porPagina));

        return response()->json([
            'dados'          => $notas->forPage($pagina, $porPagina)->map(fn ($n) => $n + [
                'data_br' => Carbon::parse($n['data'])->format('d/m/Y'),
            ])->values(),
            'pagina'         => $pagina,
            'ultima_pagina'  => $ultima,
            'total'          => $notas->count(),
            'valor_total'    => round($notas->sum('valor'), 2),
            'compras'        => round($notas->where('origem', 'compra')->sum('valor'), 2),
            'postos'         => round($notas->where('origem', 'posto')->sum('valor'), 2),
            'por_fornecedor' => $porFornecedor,
        ]);
    }

    private static function litros($v): string
    {
        return rtrim(rtrim(number_format((float) $v, 2, ',', '.'), '0'), ',');
    }
}