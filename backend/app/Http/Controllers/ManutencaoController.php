<?php

namespace App\Http\Controllers;

use App\Models\Caminhao;
use App\Models\Manutencao;
use App\Models\Motorista;
use App\Models\NotaFiscal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

// Manutenções dos caminhões. Tela do ADMIN.
class ManutencaoController extends Controller
{
    // GET /api/manutencoes?busca=&dias=0|7|30|90&pagina=1
    public function index(Request $request): JsonResponse
    {
        $consulta = Manutencao::query()->where('status', 'aprovado');
        LavagemController::filtrar($consulta, $request);

        $totalValor = (float) (clone $consulta)->sum('valor'); // de tudo o que passa pelo filtro

        $pagina = $consulta->orderByDesc('data')->orderByDesc('id')
            ->paginate(20, ['*'], 'pagina', max(1, (int) $request->query('pagina', 1)));

        $placas = Caminhao::pluck('placa', 'id');
        $nomes  = Motorista::pluck('nome', 'id');
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
            'valor'       => ['required', 'numeric', 'min:0', 'max:9999999'],
            'km'          => ['required', 'integer', 'min:0'],
            // Nota fiscal da oficina (opcional).
            'nf_numero'       => ['nullable', 'required_with:nf_chave_acesso', 'string', 'max:20'],
            'nf_fornecedor'   => ['nullable', 'required_with:nf_numero', 'string', 'max:255'],
            'nf_chave_acesso' => ['nullable', 'digits:44', 'unique:notas_fiscais,chave_acesso'],
        ], [
            'required'                    => 'Preencha o campo :attribute.',
            'data.before_or_equal'        => 'A data não pode ser futura.',
            'nf_numero.required_with'     => 'Informe o número da nota fiscal.',
            'nf_fornecedor.required_with' => 'Informe a oficina/fornecedor da nota fiscal.',
            'nf_chave_acesso.digits'      => 'A chave de acesso deve ter 44 números.',
            'nf_chave_acesso.unique'      => 'Esta nota fiscal já foi cadastrada.',
        ], ['caminhao_id' => 'caminhão', 'descricao' => 'descrição', 'km' => 'quilometragem']);

        DB::transaction(function () use ($dados) {
            $caminhao = Caminhao::lockForUpdate()->findOrFail($dados['caminhao_id']);
            if (! $caminhao->motorista_id) {
                throw ValidationException::withMessages(['caminhao_id' => 'Este caminhão não tem motorista responsável.']);
            }

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

            // O caminhão nunca "volta" no km.
            $caminhao->update(['km_atual' => max((int) $caminhao->km_atual, (int) $dados['km'])]);
        });

        return response()->json(['message' => 'Manutenção registrada.'], 201);
    }

    // DELETE /api/manutencoes/{id} — a quilometragem do caminhão não volta atrás.
    public function destroy(int $id): JsonResponse
    {
        DB::transaction(function () use ($id) {
            $manutencao = Manutencao::findOrFail($id);
            $notaId     = $manutencao->nota_fiscal_id;
            $manutencao->delete();

            // A nota que era só desta manutenção sai junto.
            if ($notaId && ! Manutencao::where('nota_fiscal_id', $notaId)->exists()) {
                NotaFiscal::whereKey($notaId)->whereDoesntHave('entradas')->delete();
            }
        });

        return response()->json(['message' => 'Manutenção excluída.']);
    }
}