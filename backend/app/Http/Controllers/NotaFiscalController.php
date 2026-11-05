<?php

namespace App\Http\Controllers;

use App\Models\Abastecimento;
use App\Models\Caminhao;
use App\Models\NotaFiscal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

// Todas as notas fiscais num lugar só:
//  - "compra": notas cadastradas nas entradas de combustível (e manutenções), tabela notas_fiscais;
//  - "posto":  notas dos abastecimentos fora da base já aprovados (nº da nota guardado no abastecimento).
class NotaFiscalController extends Controller
{
    // Categorias das notas lançadas direto nesta tela (as de combustível e manutenção vêm das outras telas).
    public const CATEGORIAS = ['Compra de veículo', 'Peças', 'Pneus', 'Serviços', 'Outros'];

    // GET /api/notas-fiscais?dias=0|7|30|90&origem=todas|compra|posto&busca=&pagina=1
    public function index(Request $request): JsonResponse
    {
        $dias   = (int) $request->query('dias', 30);
        $inicio = in_array($dias, [7, 30, 90], true) ? now()->subDays($dias)->toDateString() : null;
        $origem = in_array($request->query('origem'), ['compra', 'posto'], true) ? $request->query('origem') : 'todas';
        $busca  = trim((string) $request->query('busca', ''));

        $notas  = collect();
        $placas = Caminhao::pluck('placa', 'id');

        if ($origem !== 'posto') {
            NotaFiscal::with(['entradas.tanque:id,nome', 'manutencoes:id,nota_fiscal_id,tipo'])
                ->when($inicio, fn ($q) => $q->where('data_emissao', '>=', $inicio))
                ->when($busca !== '', fn ($q) => $q->where(fn ($q) => $q
                    ->where('numero', 'like', "%{$busca}%")->orWhere('fornecedor', 'like', "%{$busca}%")))
                ->get()
                ->each(function ($n) use ($notas, $placas) {
                    $entrada    = $n->entradas->first();
                    $manutencao = $n->manutencoes->first();
                    $placa      = $n->caminhao_id ? ($placas[$n->caminhao_id] ?? null) : null;

                    if ($entrada) {
                        $categoria = 'Combustível';
                        $descricao = 'Combustível · ' . ($entrada->tanque?->nome ?? 'tanque') . ' · ' . self::litros($entrada->litros) . ' L';
                    } elseif ($manutencao) {
                        $categoria = 'Manutenção';
                        $descricao = 'Manutenção · ' . $manutencao->tipo . ($placa ? ' · ' . $placa : '');
                    } else {
                        $categoria = $n->categoria ?: 'Outros';
                        $descricao = implode(' · ', array_filter([$categoria, $n->descricao, $placa]));
                    }

                    $notas->push([
                        'chave'      => 'nf-' . $n->id,
                        'origem'     => 'compra',
                        'numero'     => $n->numero,
                        'fornecedor' => $n->fornecedor,
                        'data'       => Carbon::parse($n->data_emissao)->toDateString(),
                        'valor'      => (float) $n->valor_total,
                        'categoria'  => $categoria,
                        'descricao'  => $descricao,
                        'chave_acesso' => $n->chave_acesso,
                        'foto_url'   => null,
                        // Nota de combustível ou manutenção se exclui pela tela de origem.
                        'id'         => $n->id,
                        'pode_excluir' => ! $entrada && ! $manutencao,
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
                        'categoria'  => 'Combustível (posto)',
                        'descricao'  => 'Abastecimento fora da base · ' . ($a->caminhao?->placa ?? '') . ' · ' . self::litros($a->litros) . ' L',
                        'chave_acesso' => null,
                        'foto_url'   => $a->fotoUrl(),
                        'id'         => $a->id,
                        'pode_excluir' => false,
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

    // POST /api/notas-fiscais — nota de outra despesa (compra de veículo, peças, pneus, serviços...).
    public function store(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'categoria'    => ['required', Rule::in(self::CATEGORIAS)],
            'numero'       => ['required', 'string', 'max:20'],
            'fornecedor'   => ['required', 'string', 'max:255'],
            'data_emissao' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'valor_total'  => ['required', 'numeric', 'min:0.01', 'max:99999999'],
            'descricao'    => ['nullable', 'string', 'max:255'],
            'chave_acesso' => ['nullable', 'digits:44', 'unique:notas_fiscais,chave_acesso'],
            'caminhao_id'  => ['nullable', 'integer', 'exists:caminhoes,id'],
        ], [
            'required'                  => 'Preencha o campo :attribute.',
            'data_emissao.before_or_equal' => 'A data não pode ser futura.',
            'chave_acesso.digits'       => 'A chave de acesso deve ter 44 números.',
            'chave_acesso.unique'       => 'Esta nota fiscal já foi cadastrada.',
        ], [
            'numero'       => 'número',
            'data_emissao' => 'data de emissão',
            'valor_total'  => 'valor',
        ]);

        NotaFiscal::forceCreate($dados);

        return response()->json(['message' => 'Nota fiscal cadastrada.'], 201);
    }

    // DELETE /api/notas-fiscais/{id} — só notas lançadas nesta tela.
    public function destroy(int $id): JsonResponse
    {
        $nota = NotaFiscal::findOrFail($id);

        if ($nota->entradas()->exists() || $nota->manutencoes()->exists()) {
            return response()->json([
                'message' => 'Esta nota pertence a uma entrada de combustível ou manutenção. Exclua por lá.',
            ], 409);
        }

        $nota->delete();

        return response()->json(['message' => 'Nota fiscal excluída.']);
    }

    private static function litros($v): string
    {
        return rtrim(rtrim(number_format((float) $v, 2, ',', '.'), '0'), ',');
    }
}