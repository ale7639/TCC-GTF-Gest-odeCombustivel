<?php

namespace App\Http\Controllers;

use App\Models\Abastecimento;
use App\Models\Caminhao;
use App\Models\Tanque;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AbastecimentoController extends Controller
{
    // Dados de outras tabelas que acompanham cada abastecimento na resposta.
    private const RELACOES = ['caminhao:id,placa', 'motorista:id,nome', 'tanque:id,nome'];

    // GET /api/abastecimentos — lista com filtros e paginação (20 por página).
    // Filtros opcionais: busca (placa ou motorista), tanque_id, dias (7, 30 ou 90) e pagina.
    public function index(Request $request): JsonResponse
    {
        $query = Abastecimento::query();

        $busca = trim((string) $request->query('busca', ''));
        if ($busca !== '') {
            $query->where(function ($q) use ($busca) {
                $q->whereHas('caminhao', fn ($c) => $c->where('placa', 'like', '%' . $busca . '%'))
                  ->orWhereHas('motorista', fn ($m) => $m->where('nome', 'like', '%' . $busca . '%'));
            });
        }

        if ($tanqueId = (int) $request->query('tanque_id')) {
            $query->where('tanque_id', $tanqueId);
        }

        $dias = (int) $request->query('dias', 0);
        if (in_array($dias, [7, 30, 90], true)) {
            $query->where('data', '>=', now()->subDays($dias)->toDateString());
        }

        // Total de litros de TUDO o que passa pelo filtro (não só da página atual).
        $totalLitros = (float) (clone $query)->sum('litros');

        $pagina = $query->with(self::RELACOES)
            ->orderByDesc('data')
            ->orderByDesc('id')
            ->paginate(20, ['*'], 'pagina', max(1, (int) $request->query('pagina', 1)));

        $itens = $pagina->getCollection()->map(function ($a) {
            $data = $a->data->toDateString();

            // Quilometragem do abastecimento anterior do mesmo caminhão (base do cálculo de consumo).
            $kmAnterior = Abastecimento::where('caminhao_id', $a->caminhao_id)
                ->where(function ($q) use ($a, $data) {
                    $q->where('data', '<', $data)
                      ->orWhere(fn ($q2) => $q2->where('data', $data)->where('id', '<', $a->id));
                })
                ->orderByDesc('data')
                ->orderByDesc('id')
                ->value('km');

            // Consumo estimado: km rodados desde o abastecimento anterior ÷ litros colocados agora
            // (considera que cada abastecimento completa o tanque do caminhão).
            $kmRodados = ($kmAnterior !== null && $a->km > $kmAnterior) ? $a->km - $kmAnterior : null;
            $litros    = (float) $a->litros;

            return [
                'id'           => $a->id,
                'data'         => $data,
                'litros'       => $litros,
                'km'           => $a->km,
                'km_rodados'   => $kmRodados,
                'consumo_km_l' => ($kmRodados && $litros > 0) ? round($kmRodados / $litros, 2) : null,
                'caminhao'     => $a->caminhao,
                'motorista'    => $a->motorista,
                'tanque'       => $a->tanque,
            ];
        });

        return response()->json([
            'dados'         => $itens->values(),
            'pagina'        => $pagina->currentPage(),
            'ultima_pagina' => $pagina->lastPage(),
            'total'         => $pagina->total(),
            'total_litros'  => $totalLitros,
        ]);
    }

    // POST /api/abastecimentos — registra a saída de combustível do tanque para um caminhão.
    public function store(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'caminhao_id' => ['required', 'integer', 'exists:caminhoes,id'],
            'tanque_id'   => ['required', 'integer', 'exists:tanques,id'],
            'data'        => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'litros'      => ['required', 'numeric', 'min:1', 'max:99999'],
            'km'          => ['required', 'integer', 'min:0'],
        ], [
            'required'                  => 'Preencha o campo :attribute.',
            'data.date_format'          => 'Data inválida.',
            'data.before_or_equal'      => 'A data não pode ser futura.',
            'litros.min'                => 'Informe pelo menos 1 litro.',
            'caminhao_id.exists'        => 'Caminhão não encontrado.',
            'tanque_id.exists'          => 'Tanque não encontrado.',
        ], [
            'caminhao_id' => 'caminhão',
            'tanque_id'   => 'tanque',
            'litros'      => 'litros',
            'km'          => 'quilometragem',
            'data'        => 'data',
        ]);

        // Tudo ou nada: se qualquer passo falhar, nenhuma alteração é salva.
        $abastecimento = DB::transaction(function () use ($dados) {
            // lockForUpdate trava as linhas até o fim da transaction. Assim, dois abastecimentos
            // simultâneos não conseguem "gastar" o mesmo combustível duas vezes.
            $caminhao = Caminhao::lockForUpdate()->findOrFail($dados['caminhao_id']);
            $tanque   = Tanque::lockForUpdate()->findOrFail($dados['tanque_id']);

            $litros = (float) $dados['litros'];
            $km     = (int) $dados['km'];

            if ($caminhao->status !== 'ativo') {
                throw ValidationException::withMessages(['caminhao_id' => 'Este caminhão não está ativo.']);
            }

            if (! $caminhao->motorista_id) {
                throw ValidationException::withMessages(['caminhao_id' => 'Este caminhão não tem motorista responsável.']);
            }

            if ($litros > (float) $caminhao->capacidade_tanque) {
                throw ValidationException::withMessages([
                    'litros' => 'O tanque do caminhão comporta no máximo ' . (float) $caminhao->capacidade_tanque . ' L.',
                ]);
            }

            if ($litros > (float) $tanque->nivel_atual) {
                throw ValidationException::withMessages([
                    'litros' => 'O ' . $tanque->nome . ' tem apenas ' . (float) $tanque->nivel_atual . ' L.',
                ]);
            }

            if ($km < $caminhao->km_atual) {
                throw ValidationException::withMessages([
                    'km' => 'A quilometragem não pode ser menor que a atual (' . $caminhao->km_atual . ' km).',
                ]);
            }

            $abastecimento = Abastecimento::create([
                'caminhao_id'  => $caminhao->id,
                'motorista_id' => $caminhao->motorista_id, // o responsável do caminhão no momento
                'tanque_id'    => $tanque->id,
                'data'         => $dados['data'],
                'litros'       => $litros,
                'km'           => $km,
            ]);

            $tanque->decrement('nivel_atual', $litros);   // sai do tanque
            $caminhao->update(['km_atual' => $km]);       // o caminhão anda até ali

            return $abastecimento;
        });

        return response()->json($abastecimento->load(self::RELACOES), 201);
    }

    // DELETE /api/abastecimentos/{id} — corrige um lançamento errado, devolvendo os litros ao tanque.
    // A quilometragem do caminhão não volta atrás; se precisar, ajuste na tela de Caminhões.
    public function destroy(Abastecimento $abastecimento): JsonResponse
    {
        DB::transaction(function () use ($abastecimento) {
            $tanque = Tanque::lockForUpdate()->findOrFail($abastecimento->tanque_id);

            // Nunca passa da capacidade do tanque (ele pode ter sido reabastecido depois).
            $novoNivel = min(
                (float) $tanque->capacidade,
                (float) $tanque->nivel_atual + (float) $abastecimento->litros
            );

            $tanque->update(['nivel_atual' => $novoNivel]);
            $abastecimento->delete();
        });

        return response()->json(['message' => 'Abastecimento excluído e litros devolvidos ao tanque.']);
    }
}