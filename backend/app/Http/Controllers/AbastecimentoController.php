<?php

// =====================================================================================
// AbastecimentoController — abastecimentos lançados pelo ADMIN (saída de combustível do tanque).
//
// Rotas (routes/api.php, grupo do admin):
//   GET    /api/abastecimentos        -> index()   lista com filtros, páginas e consumo de cada um
//   POST   /api/abastecimentos        -> store()   registra (já aprovado, sai do tanque na hora)
//   DELETE /api/abastecimentos/{id}   -> destroy() exclui e devolve os litros ao tanque
// Não tem "alterar": mexe no estoque e no custo médio; para corrigir, exclui e lança de novo.
//
// O motorista lança abastecimentos pelo MeuController (ficam pendentes) e o admin aprova
// pelo AprovacaoController.
//
// CUSTO MÉDIO na saída: custo por litro = valor_estoque ÷ nivel_atual do tanque.
//   O abastecimento leva litros × custo médio; o que sobra no tanque continua com o mesmo custo.
// =====================================================================================

namespace App\Http\Controllers;

use App\Models\Abastecimento;
use App\Models\Caminhao;
use App\Models\Tanque;
use App\Support\Quilometragem;               // regra do km: não diminui e não salta mais de 5.000 km
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;           // transações
use Illuminate\Support\Facades\Storage;      // arquivos (apagar a foto da nota)
use Illuminate\Validation\ValidationException;

class AbastecimentoController extends Controller
{
    // Dados de outras tabelas que acompanham cada abastecimento na resposta.
    // "caminhao:id,placa" = relação caminhao, só as colunas id e placa (resposta mais leve).
    private const RELACOES = ['caminhao:id,placa', 'motorista:id,nome', 'tanque:id,nome'];

    // ABASTECIMENTO LISTA — filtros + paginação (20/página): busca, tanque_id, dias, pagina.
    public function index(Request $request): JsonResponse
    {
        // A lista do admin mostra só o que já foi aprovado (os pendentes ficam em Aprovações).
        // query() começa uma consulta que vai recebendo filtros antes de ser executada.
        $query = Abastecimento::query()->where('status', 'aprovado');

        $busca = trim((string) $request->query('busca', ''));
        if ($busca !== '') {
            // whereHas('caminhao', ...) = abastecimentos cujo CAMINHÃO tem placa parecida;
            // orWhereHas('motorista', ...) = OU cujo MOTORISTA tem nome parecido.
            // like '%texto%' = "contém o texto".
            $query->where(function ($q) use ($busca) {
                $q->whereHas('caminhao', fn ($c) => $c->where('placa', 'like', '%' . $busca . '%'))
                  ->orWhereHas('motorista', fn ($m) => $m->where('nome', 'like', '%' . $busca . '%'));
            });
        }

        // Atribui e testa ao mesmo tempo: se veio um tanque_id diferente de 0, filtra por ele.
        if ($tanqueId = (int) $request->query('tanque_id')) {
            $query->where('tanque_id', $tanqueId);
        }

        // Período: só aceita 7, 30 ou 90; outro valor (ex.: 0) = tudo.
        $dias = (int) $request->query('dias', 0);
        if (in_array($dias, [7, 30, 90], true)) {
            $query->where('data', '>=', now()->subDays($dias)->toDateString());
        }

        // Total de litros de TUDO o que passa pelo filtro (não só da página atual).
        // clone = cópia da consulta, para somar sem estragar a consulta que ainda vai paginar.
        $totalLitros = (float) (clone $query)->sum('litros');

        // with(...) = eager loading (evita uma consulta por item); paginate(20) = 20 por página.
        $pagina = $query->with(self::RELACOES)
            ->orderByDesc('data')
            ->orderByDesc('id')
            ->paginate(20, ['*'], 'pagina', max(1, (int) $request->query('pagina', 1)));

        // map = transforma cada abastecimento no formato que a tela usa.
        $itens = $pagina->getCollection()->map(function ($a) {
            $data = $a->data->toDateString();

            // Quilometragem do abastecimento anterior do mesmo caminhão (base do cálculo de consumo).
            // "Anterior" = data menor, ou mesma data com id menor (lançado antes).
            // value('km') = devolve só o km do primeiro resultado.
            $kmAnterior = Abastecimento::where('caminhao_id', $a->caminhao_id)
                ->where('status', 'aprovado')
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
                'custo_litro'  => $a->custo_litro !== null ? (float) $a->custo_litro : null,
                'custo_total'  => $a->custo_total !== null ? round((float) $a->custo_total, 2) : null,
                'caminhao'     => $a->caminhao,
                'motorista'    => $a->motorista,
                'tanque'       => $a->tanque,
                'origem'       => $a->origem,          // 'base' ou 'externo' (posto)
                'posto'        => $a->posto,
                'nota_numero'  => $a->nota_numero,
                'valor_total'  => $a->valor_total !== null ? (float) $a->valor_total : null,
                // fotoUrl() (no model) gera o endereço ASSINADO da foto, ou null se não tiver foto.
                'foto_url'     => $a->fotoUrl(),
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

    // ABASTECIMENTO REGISTRAR — saída do tanque → caminhão (transaction + lockForUpdate).
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

            // Regras de negócio. "throw" para tudo e a transação desfaz o que já tinha feito.
            if ($caminhao->status !== 'ativo') {
                throw ValidationException::withMessages(['caminhao_id' => 'Este caminhão não está ativo.']);
            }

            if (! $caminhao->motorista_id) {
                throw ValidationException::withMessages(['caminhao_id' => 'Este caminhão não tem motorista responsável.']);
            }

            // Não cabe mais litros do que o tanque do caminhão comporta.
            if ($litros > (float) $caminhao->capacidade_tanque) {
                throw ValidationException::withMessages([
                    'litros' => 'O tanque do caminhão comporta no máximo ' . (float) $caminhao->capacidade_tanque . ' L.',
                ]);
            }

            // Não sai mais combustível do que o tanque da base tem.
            if ($litros > (float) $tanque->nivel_atual) {
                throw ValidationException::withMessages([
                    'litros' => 'O ' . $tanque->nome . ' tem apenas ' . (float) $tanque->nivel_atual . ' L.',
                ]);
            }

            // Km não pode ser menor que o atual nem andar mais que o limite desde o último registro.
            Quilometragem::validar($km, (int) $caminhao->km_atual);

            // Custo médio do combustível que está no tanque agora (valor do estoque ÷ litros no tanque).
            $nivelAntes = (float) $tanque->nivel_atual;
            $custoLitro = $nivelAntes > 0 ? (float) $tanque->valor_estoque / $nivelAntes : 0;
            $custoTotal = $litros * $custoLitro;

            $abastecimento = Abastecimento::create([
                'caminhao_id'  => $caminhao->id,
                'motorista_id' => $caminhao->motorista_id, // o responsável do caminhão no momento
                'tanque_id'    => $tanque->id,
                'data'         => $dados['data'],
                'litros'       => $litros,
                'km'           => $km,
                // Guarda o custo da hora: se o custo médio mudar depois, este lançamento não muda.
                'custo_litro'  => round($custoLitro, 4),
                'custo_total'  => round($custoTotal, 4),
            ]);

            // Sai do tanque: os litros e o valor correspondente. O custo médio do que sobra não muda.
            // Se o tanque esvaziou (quase zero), o valor do estoque vai para 0 (evita sobra de centavos).
            // max(0, ...) garante que o valor nunca fique negativo.
            $novoNivel = $nivelAntes - $litros;
            $tanque->update([
                'nivel_atual'   => $novoNivel,
                'valor_estoque' => $novoNivel > 0.0001 ? max(0, (float) $tanque->valor_estoque - $custoTotal) : 0,
            ]);
            $caminhao->update(['km_atual' => $km]);       // o caminhão anda até ali

            return $abastecimento;
        });

        // 201 = criado.
        return response()->json($abastecimento->load(self::RELACOES), 201);
    }

    // ABASTECIMENTO EXCLUIR — devolve litros ao tanque (KM do caminhão não volta atrás).
    public function destroy(Abastecimento $abastecimento): JsonResponse
    {
        DB::transaction(function () use ($abastecimento) {
            // Abastecimento fora da base (ou ainda não aprovado) nunca mexeu em tanque: só apaga.
            if (! $abastecimento->tanque_id || $abastecimento->status !== 'aprovado') {
                // Apaga também o arquivo da foto, para não deixar lixo no disco.
                if ($abastecimento->foto) {
                    Storage::disk('local')->delete($abastecimento->foto);
                }
                $abastecimento->delete();

                return;
            }

            $tanque = Tanque::lockForUpdate()->findOrFail($abastecimento->tanque_id);

            // Nunca passa da capacidade do tanque (ele pode ter sido reabastecido depois).
            // min(a, b) = o menor dos dois.
            $novoNivel = min(
                (float) $tanque->capacidade,
                (float) $tanque->nivel_atual + (float) $abastecimento->litros
            );

            // Devolve ao estoque o valor que tinha saído. Em abastecimentos antigos, sem custo gravado,
            // usa o custo médio atual do tanque.
            $valorDevolvido = $abastecimento->custo_total !== null
                ? (float) $abastecimento->custo_total
                : (float) $abastecimento->litros * (float) ($tanque->custo_medio ?? 0);

            $tanque->update([
                'nivel_atual'   => $novoNivel,
                'valor_estoque' => (float) $tanque->valor_estoque + $valorDevolvido,
            ]);
            $abastecimento->delete();
        });

        return response()->json(['message' => 'Abastecimento excluído.']);
    }
}