<?php

// =====================================================================================
// ManutencaoController — CRUD de manutenções (tela "Lavagens e manutenções" do ADMIN).
//
// Rotas (routes/api.php, dentro do grupo do admin):
//   GET    /api/manutencoes        -> index()   lista (com busca, período, páginas e total gasto)
//   POST   /api/manutencoes        -> store()   registra (com nota fiscal opcional)
//   PUT    /api/manutencoes/{id}   -> update()  altera
//   DELETE /api/manutencoes/{id}   -> destroy() exclui (e a nota fiscal dela, se for só dela)
//
// Valor 0 é permitido (regra 'min:0'): serviço em garantia, feito pela própria equipe etc.
// O motorista também registra manutenções, mas pelo MeuController (rota /api/meu/manutencoes).
// =====================================================================================

namespace App\Http\Controllers;

use App\Models\Caminhao;
use App\Models\Manutencao;
use App\Models\Motorista;
use App\Models\NotaFiscal;
use App\Support\Quilometragem;                       // regra do km (não diminui, salto máximo)
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;                   // para as transações
use Illuminate\Validation\ValidationException;

// Manutenções dos caminhões. Tela do ADMIN.
class ManutencaoController extends Controller
{
    // GET /api/manutencoes?busca=&dias=0|7|30|90&pagina=1
    public function index(Request $request): JsonResponse
    {
        $consulta = Manutencao::query()->where('status', 'aprovado');
        // Reaproveita os filtros (busca por placa/motorista e período) do LavagemController.
        LavagemController::filtrar($consulta, $request);

        // clone = cópia da consulta, para somar SEM estragar a consulta original (que ainda vai paginar).
        $totalValor = (float) (clone $consulta)->sum('valor'); // de tudo o que passa pelo filtro

        $pagina = $consulta->orderByDesc('data')->orderByDesc('id')
            ->paginate(20, ['*'], 'pagina', max(1, (int) $request->query('pagina', 1)));

        // Dicionários [id => valor] buscados uma vez só (evita o problema N+1).
        $placas = Caminhao::pluck('placa', 'id');
        $nomes  = Motorista::pluck('nome', 'id');
        // Só os números das notas das manutenções desta página. filter() tira os null.
        $notas  = NotaFiscal::whereIn('id', $pagina->getCollection()->pluck('nota_fiscal_id')->filter())
            ->pluck('numero', 'id');

        return response()->json([
            'dados' => $pagina->getCollection()->map(fn ($m) => [
                'id'        => $m->id,
                'data'      => Carbon::parse($m->data)->format('d/m/Y'),
                'placa'     => $placas[$m->caminhao_id] ?? '—',
                'motorista' => $nomes[$m->motorista_id] ?? '—',
                'tipo'      => $m->tipo,
                'descricao' => $m->descricao,
                // (float) e (int) garantem que vão como número no JSON, não como texto.
                'valor'     => (float) $m->valor,
                'km'        => (int) $m->km,
                'nota'      => $m->nota_fiscal_id ? ($notas[$m->nota_fiscal_id] ?? null) : null,
            ])->values(),
            'pagina'        => $pagina->currentPage(),
            'ultima_pagina' => $pagina->lastPage(),
            'total'         => $pagina->total(),
            'total_valor'   => round($totalValor, 2),
        ]);
    }

    // POST /api/manutencoes
    public function store(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'caminhao_id' => ['required', 'integer', 'exists:caminhoes,id'],
            'data'        => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'tipo'        => ['required', 'string', 'max:255'],
            'descricao'   => ['nullable', 'string', 'max:1000'],
            // min:0 = aceita zero (manutenção sem custo), mas não valor negativo.
            'valor'       => ['required', 'numeric', 'min:0', 'max:9999999'],
            'km'          => ['required', 'integer', 'min:0'],
            // Nota fiscal da oficina (opcional).
            // required_with:X = "obrigatório SE o campo X vier preenchido".
            'nf_numero'       => ['nullable', 'required_with:nf_chave_acesso', 'string', 'max:20'],
            'nf_fornecedor'   => ['nullable', 'required_with:nf_numero', 'string', 'max:255'],
            // digits:44 = exatamente 44 números. unique = a mesma nota não pode ser cadastrada duas vezes.
            'nf_chave_acesso' => ['nullable', 'digits:44', 'unique:notas_fiscais,chave_acesso'],
        ], [
            'required'                    => 'Preencha o campo :attribute.',
            'data.before_or_equal'        => 'A data não pode ser futura.',
            'nf_numero.required_with'     => 'Informe o número da nota fiscal.',
            'nf_fornecedor.required_with' => 'Informe a oficina/fornecedor da nota fiscal.',
            'nf_chave_acesso.digits'      => 'A chave de acesso deve ter 44 números.',
            'nf_chave_acesso.unique'      => 'Esta nota fiscal já foi cadastrada.',
        ], ['caminhao_id' => 'caminhão', 'descricao' => 'descrição', 'km' => 'quilometragem']);

        // Transação: grava a nota, a manutenção e o km do caminhão JUNTOS.
        // Se qualquer passo der erro, nada fica gravado pela metade.
        DB::transaction(function () use ($dados) {
            // lockForUpdate = trava a linha do caminhão até o fim da transação
            // (se duas pessoas registrarem ao mesmo tempo, uma espera a outra; o km não se perde).
            $caminhao = Caminhao::lockForUpdate()->findOrFail($dados['caminhao_id']);
            if (! $caminhao->motorista_id) {
                throw ValidationException::withMessages(['caminhao_id' => 'Este caminhão não tem motorista responsável.']);
            }

            // Mesma regra do abastecimento: o km não pode ser menor que o atual do caminhão
            // nem pular mais que o limite. Se der erro, a transação desfaz tudo.
            Quilometragem::validar((int) $dados['km'], (int) $caminhao->km_atual);

            // Se veio nota fiscal, ela é criada e ligada à manutenção.
            $notaId = null;
            if (! empty($dados['nf_numero'])) {
                $notaId = NotaFiscal::forceCreate([
                    'numero'       => $dados['nf_numero'],
                    'fornecedor'   => $dados['nf_fornecedor'],
                    'data_emissao' => $dados['data'],
                    'valor_total'  => $dados['valor'],
                    'chave_acesso' => $dados['nf_chave_acesso'] ?? null,
                    'categoria'    => 'Manutenção',
                    'caminhao_id'  => $caminhao->id,
                ])->id;
            }

            Manutencao::forceCreate([
                'caminhao_id'  => $caminhao->id,
                'motorista_id' => $caminhao->motorista_id,
                'data'         => $dados['data'],
                'tipo'         => $dados['tipo'],
                'descricao'    => $dados['descricao'] ?? null,
                'valor'        => $dados['valor'],
                'km'           => $dados['km'],
                'nota_fiscal_id' => $notaId,
                'status'       => 'aprovado',
            ]);

            // O caminhão nunca "volta" no km: max() fica com o maior entre o atual e o informado.
            $caminhao->update(['km_atual' => max((int) $caminhao->km_atual, (int) $dados['km'])]);
        });

        return response()->json(['message' => 'Manutenção registrada.'], 201);
    }

    // PUT /api/manutencoes/{id} — altera data, tipo, descrição, valor e km de uma manutenção.
    // O caminhão e a nota fiscal (número, fornecedor) NÃO mudam aqui: se estiverem errados,
    // o certo é excluir e registrar de novo.
    public function update(Request $request, int $id): JsonResponse
    {
        // Mesmas regras do cadastro (store). Valor 0 é aceito (ex.: serviço feito na garantia).
        $dados = $request->validate([
            'data'      => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'tipo'      => ['required', 'string', 'max:255'],
            'descricao' => ['nullable', 'string', 'max:1000'],
            'valor'     => ['required', 'numeric', 'min:0', 'max:9999999'],
            'km'        => ['required', 'integer', 'min:0'],
        ], [
            'required'             => 'Preencha o campo :attribute.',
            'data.before_or_equal' => 'A data não pode ser futura.',
        ], ['descricao' => 'descrição', 'km' => 'quilometragem']);

        // Transação: ou grava tudo (manutenção, nota e km do caminhão) ou não grava nada.
        DB::transaction(function () use ($id, $dados) {
            // findOrFail: se o id não existir, responde 404 sozinho.
            $manutencao = Manutencao::findOrFail($id);
            // Trava o caminhão até o fim da transação (ninguém muda o km dele no meio).
            $caminhao = Caminhao::lockForUpdate()->find($manutencao->caminhao_id);

            // Só confere o km se ele foi ALTERADO. Assim dá para corrigir a descrição ou o valor
            // de uma manutenção antiga, cujo km já ficou para trás porque o caminhão rodou depois.
            // Se mudou, vale a mesma regra do cadastro: não pode ser menor que o km atual do
            // caminhão nem pular mais que o limite (App\Support\Quilometragem).
            if ($caminhao && (int) $dados['km'] !== (int) $manutencao->km) {
                Quilometragem::validar((int) $dados['km'], (int) $caminhao->km_atual);
            }

            // forceFill + save = altera os campos sem depender do "fillable".
            $manutencao->forceFill([
                'data'      => $dados['data'],
                'tipo'      => $dados['tipo'],
                'descricao' => $dados['descricao'] ?? null,
                'valor'     => $dados['valor'],
                'km'        => $dados['km'],
            ])->save();

            // Se a manutenção tem nota fiscal, a nota acompanha o novo valor e a nova data
            // (no cadastro ela foi criada com esses mesmos dados).
            if ($manutencao->nota_fiscal_id) {
                NotaFiscal::whereKey($manutencao->nota_fiscal_id)->update([
                    'valor_total'  => $dados['valor'],
                    'data_emissao' => $dados['data'],
                ]);
            }

            // Igual ao cadastro: o km do caminhão só sobe, nunca "volta".
            if ($caminhao) {
                $caminhao->update(['km_atual' => max((int) $caminhao->km_atual, (int) $dados['km'])]);
            }
        });

        return response()->json(['message' => 'Manutenção alterada.']);
    }

    // DELETE /api/manutencoes/{id} — a quilometragem do caminhão não volta atrás.
    public function destroy(int $id): JsonResponse
    {
        DB::transaction(function () use ($id) {
            $manutencao = Manutencao::findOrFail($id);
            $notaId     = $manutencao->nota_fiscal_id; // guarda antes de apagar
            $manutencao->delete();

            // A nota que era só desta manutenção sai junto.
            // whereDoesntHave('entradas') = só apaga se a nota também não estiver ligada
            // a uma compra de combustível (proteção extra).
            if ($notaId && ! Manutencao::where('nota_fiscal_id', $notaId)->exists()) {
                NotaFiscal::whereKey($notaId)->whereDoesntHave('entradas')->delete();
            }
        });

        return response()->json(['message' => 'Manutenção excluída.']);
    }
}