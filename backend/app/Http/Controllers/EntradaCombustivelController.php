<?php

namespace App\Http\Controllers;

use App\Models\EntradaCombustivel;
use App\Models\NotaFiscal;
use App\Models\Tanque;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class EntradaCombustivelController extends Controller
{
    // Dados de outras tabelas que acompanham cada entrada na resposta.
    private const RELACOES = ['tanque:id,nome', 'notaFiscal:id,numero,fornecedor,chave_acesso'];

    // GET /api/entradas — as 100 mais recentes.
    public function index(): JsonResponse
    {
        $entradas = EntradaCombustivel::with(self::RELACOES)
            ->orderByDesc('data')
            ->orderByDesc('id')
            ->limit(100)
            ->get();

        return response()->json($entradas);
    }

    // POST /api/entradas — registra a chegada de combustível num tanque, com nota fiscal opcional.
    public function store(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'tanque_id'   => ['required', 'integer', 'exists:tanques,id'],
            'data'        => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'litros'      => ['required', 'numeric', 'min:1', 'max:99999999'],
            'valor_total' => ['required', 'numeric', 'min:0', 'max:99999999'],

            // Nota fiscal (opcional). Se informar o número, o fornecedor passa a ser obrigatório.
            'nf_numero'        => ['nullable', 'required_with:nf_chave_acesso', 'string', 'max:20'],
            'nf_fornecedor'    => ['nullable', 'required_with:nf_numero', 'string', 'max:255'],
            'nf_chave_acesso'  => ['nullable', 'digits:44', 'unique:notas_fiscais,chave_acesso'],
        ], [
            'required'                       => 'Preencha o campo :attribute.',
            'data.date_format'               => 'Data inválida.',
            'data.before_or_equal'           => 'A data não pode ser futura.',
            'litros.min'                     => 'Informe pelo menos 1 litro.',
            'tanque_id.exists'               => 'Tanque não encontrado.',
            'nf_numero.required_with'        => 'Informe o número da nota fiscal.',
            'nf_fornecedor.required_with'    => 'Informe o fornecedor da nota fiscal.',
            'nf_chave_acesso.digits'         => 'A chave de acesso deve ter 44 números.',
            'nf_chave_acesso.unique'         => 'Esta nota fiscal já foi cadastrada.',
        ], [
            'tanque_id'   => 'tanque',
            'valor_total' => 'valor total',
        ]);

        // Tudo ou nada: nota, entrada e nível do tanque são salvos juntos.
        $entrada = DB::transaction(function () use ($dados) {
            // Trava o tanque até o fim, para dois lançamentos simultâneos não estourarem a capacidade.
            $tanque = Tanque::lockForUpdate()->findOrFail($dados['tanque_id']);
            $litros = (float) $dados['litros'];
            $espaco = (float) $tanque->capacidade - (float) $tanque->nivel_atual;

            if ($litros > $espaco + 0.001) {
                throw ValidationException::withMessages([
                    'litros' => 'O ' . $tanque->nome . ' só comporta mais ' . round($espaco, 2) . ' L.',
                ]);
            }

            $notaId = null;
            if (! empty($dados['nf_numero'])) {
                $notaId = NotaFiscal::create([
                    'numero'       => $dados['nf_numero'],
                    'fornecedor'   => $dados['nf_fornecedor'],
                    'data_emissao' => $dados['data'],        // a nota é considerada emitida na data da entrada
                    'valor_total'  => $dados['valor_total'],
                    'chave_acesso' => $dados['nf_chave_acesso'] ?? null,
                ])->id;
            }

            // Custo médio ponderado: (valor que já estava no tanque + valor da compra)
            //                        ÷ (litros que já estavam + litros da compra).
            $novoNivel  = (float) $tanque->nivel_atual + $litros;
            $novoValor  = (float) $tanque->valor_estoque + (float) $dados['valor_total'];
            $custoMedio = $novoNivel > 0 ? round($novoValor / $novoNivel, 4) : null;

            $entrada = EntradaCombustivel::create([
                'tanque_id'        => $tanque->id,
                'nota_fiscal_id'   => $notaId,
                'data'             => $dados['data'],
                'litros'           => $litros,
                'valor_total'      => $dados['valor_total'],
                'custo_medio_apos' => $custoMedio,
            ]);

            // Entram no tanque os litros e o valor da compra.
            $tanque->update(['nivel_atual' => $novoNivel, 'valor_estoque' => $novoValor]);

            return $entrada;
        });

        return response()->json($entrada->load(self::RELACOES), 201);
    }

    // DELETE /api/entradas/{id} — corrige um lançamento errado, tirando os litros do tanque.
    // Só é possível se o combustível ainda estiver lá (não foi gasto em abastecimentos).
    public function destroy(EntradaCombustivel $entrada): JsonResponse
    {
        DB::transaction(function () use ($entrada) {
            $tanque = Tanque::lockForUpdate()->findOrFail($entrada->tanque_id);

            if ((float) $tanque->nivel_atual < (float) $entrada->litros) {
                throw ValidationException::withMessages([
                    'litros' => 'Parte deste combustível já foi usada em abastecimentos, então a entrada não pode ser excluída.',
                ]);
            }

            // Tira do tanque os litros e o valor que essa entrada tinha colocado.
            $novoNivel = (float) $tanque->nivel_atual - (float) $entrada->litros;
            $tanque->update([
                'nivel_atual'   => $novoNivel,
                'valor_estoque' => $novoNivel > 0.0001
                    ? max(0, (float) $tanque->valor_estoque - (float) $entrada->valor_total)
                    : 0,
            ]);

            $nota = $entrada->notaFiscal;
            $entrada->delete();

            // A nota só é apagada se não estiver ligada a mais nada.
            if ($nota && ! $nota->entradas()->exists() && ! $nota->manutencoes()->exists()) {
                $nota->delete();
            }
        });

        return response()->json(['message' => 'Entrada excluída e litros retirados do tanque.']);
    }
}