<?php

// =====================================================================================
// LavagemController — CRUD de lavagens (tela "Lavagens e manutenções" do ADMIN).
//
// Rotas (routes/api.php, dentro do grupo do admin):
//   GET    /api/lavagens        -> index()   lista (com busca, período e páginas)
//   POST   /api/lavagens        -> store()   registra
//   PUT    /api/lavagens/{id}   -> update()  altera
//   DELETE /api/lavagens/{id}   -> destroy() exclui
//
// Regra de negócio: a lavagem é feita na própria empresa, então NÃO tem custo (valor = null).
// Guarda só o caminhão, o motorista responsável, a data e uma observação opcional.
// O motorista também registra lavagens, mas pelo MeuController (rota /api/meu/lavagens).
// =====================================================================================

namespace App\Http\Controllers;

use App\Models\Caminhao;
use App\Models\Lavagem;
use App\Models\Motorista;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;                       // biblioteca de datas do Laravel
use Illuminate\Validation\ValidationException;       // para devolver erro 422 com mensagem própria

// Lavagens (feitas na própria empresa: sem custo, só a data). Tela do ADMIN.
class LavagemController extends Controller
{
    // GET /api/lavagens?busca=&dias=0|7|30|90&pagina=1
    public function index(Request $request): JsonResponse
    {
        // Só as aprovadas (lavagens são sempre aprovadas na hora, mas o filtro deixa a regra clara).
        $consulta = Lavagem::query()->where('status', 'aprovado');
        // Aplica a busca (placa ou motorista) e o período. A função fica no fim deste arquivo.
        $this->filtrar($consulta, $request);

        // paginate(20, ...) = devolve 20 por vez. 'pagina' é o nome do parâmetro na URL.
        // max(1, ...) garante que a página nunca seja 0 ou negativa.
        $pagina = $consulta->orderByDesc('data')->orderByDesc('id')
            ->paginate(15, ['*'], 'pagina', max(1, (int) $request->query('pagina', 1)));

        // pluck('placa', 'id') = "dicionário" [id => placa]. Assim buscamos as placas e os nomes
        // UMA vez só, em vez de uma consulta por lavagem (evita o problema N+1).
        $placas = Caminhao::pluck('placa', 'id');
        $nomes  = Motorista::pluck('nome', 'id');

        return response()->json([
            // map(...) transforma cada lavagem no formato que a tela precisa.
            'dados' => $pagina->getCollection()->map(fn ($l) => [
                'id'         => $l->id,
                // A tela mostra (e edita) a data como dd/mm/aaaa.
                'data'       => Carbon::parse($l->data)->format('d/m/Y'),
                // "?? '—'" = se o caminhão/motorista não for encontrado, mostra um traço.
                'placa'      => $placas[$l->caminhao_id] ?? '—',
                'motorista'  => $nomes[$l->motorista_id] ?? '—',
                'observacao' => $l->observacao,
            ])->values(),
            'pagina'        => $pagina->currentPage(),
            'ultima_pagina' => $pagina->lastPage(),
            'total'         => $pagina->total(),
        ]);
    }

    // POST /api/lavagens — o admin registra uma lavagem (o motorista é o responsável atual do caminhão).
    public function store(Request $request): JsonResponse
    {
        $dados = $request->validate([
            // exists = o caminhão precisa existir na tabela caminhoes.
            'caminhao_id' => ['required', 'integer', 'exists:caminhoes,id'],
            // date_format:Y-m-d = a tela envia aaaa-mm-dd. before_or_equal:today = não aceita data futura.
            'data'        => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'observacao'  => ['nullable', 'string', 'max:255'],
        ], [
            'required'             => 'Preencha o campo :attribute.',
            'data.before_or_equal' => 'A data não pode ser futura.',
        ], ['caminhao_id' => 'caminhão']);

        $caminhao = Caminhao::findOrFail($dados['caminhao_id']);
        // A lavagem fica no nome do motorista do caminhão; sem motorista, não dá para registrar.
        if (! $caminhao->motorista_id) {
            throw ValidationException::withMessages(['caminhao_id' => 'Este caminhão não tem motorista responsável.']);
        }

        // forceCreate grava todos os campos informados, sem depender da lista "fillable" do model
        // (o campo "status" não está no fillable de propósito: a tela nunca escolhe o status).
        Lavagem::forceCreate([
            'caminhao_id'  => $caminhao->id,
            'motorista_id' => $caminhao->motorista_id,
            'data'         => $dados['data'],
            'valor'        => null, // lavagem não tem custo
            'observacao'   => $dados['observacao'] ?? null,
            'status'       => 'aprovado',
        ]);

        // 201 = código HTTP "criado".
        return response()->json(['message' => 'Lavagem registrada.'], 201);
    }

    // PUT /api/lavagens/{id} — altera a data e a observação de uma lavagem.
    // O caminhão NÃO muda: se a lavagem foi lançada no caminhão errado, o certo é excluir
    // e registrar de novo (assim o motorista responsável também fica certo).
    public function update(Request $request, int $id): JsonResponse
    {
        // findOrFail: se o id não existir, responde 404 sozinho.
        $lavagem = Lavagem::findOrFail($id);

        // Mesmas regras do cadastro (store) para os campos que podem ser alterados.
        $dados = $request->validate([
            'data'       => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'observacao' => ['nullable', 'string', 'max:255'],
        ], [
            'required'             => 'Preencha o campo :attribute.',
            'data.before_or_equal' => 'A data não pode ser futura.',
        ]);

        // forceFill + save = altera os campos sem depender do "fillable" (igual ao forceCreate).
        $lavagem->forceFill([
            'data'       => $dados['data'],
            'observacao' => $dados['observacao'] ?? null,
        ])->save();

        return response()->json(['message' => 'Lavagem alterada.']);
    }

    // DELETE /api/lavagens/{id}
    // "int $id" + whereNumber('id') na rota = só aceita número na URL.
    public function destroy(int $id): JsonResponse
    {
        Lavagem::findOrFail($id)->delete();

        return response()->json(['message' => 'Lavagem excluída.']);
    }

    // Filtros usados também nas manutenções: busca por placa ou motorista, e período.
    // "public static" = pode ser chamada de fora sem criar o controller
    // (o ManutencaoController usa: LavagemController::filtrar(...)), evitando código repetido.
    public static function filtrar($consulta, Request $request): void
    {
        $caminhaoId = (int) $request->query('caminhao_id', 0);
        if ($caminhaoId > 0) {
            $consulta->where('caminhao_id', $caminhaoId);
        }

        $busca = trim((string) $request->query('busca', ''));
        if ($busca !== '') {
            // Ids dos caminhões cuja placa contém o texto, e dos motoristas cujo nome contém o texto.
            // like '%texto%' = "contém".
            $caminhoes  = Caminhao::where('placa', 'like', "%{$busca}%")->pluck('id');
            $motoristas = Motorista::where('nome', 'like', "%{$busca}%")->pluck('id');
            // where(fn...) agrupa entre parênteses: (caminhao_id IN ... OR motorista_id IN ...).
            $consulta->where(fn ($q) => $q->whereIn('caminhao_id', $caminhoes)->orWhereIn('motorista_id', $motoristas));
        }

        // Período: só aceita 7, 30 ou 90 dias; qualquer outro valor (ex.: 0) = tudo.
        $dias = (int) $request->query('dias', 0);
        if (in_array($dias, [7, 30, 90], true)) {
            $consulta->where('data', '>=', now()->subDays($dias)->toDateString());
        }
    }
}