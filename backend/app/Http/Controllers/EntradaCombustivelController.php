<?php

// =====================================================================================
// EntradaCombustivelController — COMPRAS de combustível para os tanques da base.
//
// Rotas (routes/api.php, grupo do admin; tela Tanques > aba Entradas):
//   GET    /api/entradas        -> index()   as 100 mais recentes
//   POST   /api/entradas        -> store()   registra a compra (com nota fiscal opcional)
//   DELETE /api/entradas/{id}   -> destroy() exclui, se o combustível ainda estiver no tanque
// Não tem "alterar" pelo mesmo motivo do abastecimento: mexe no estoque e no custo médio.
//
// É AQUI que o CUSTO MÉDIO PONDERADO muda:
//   novo custo = (valor que já estava no tanque + valor da compra)
//              ÷ (litros que já estavam + litros da compra)
// Exemplo: 1.000 L valendo R$ 5.000 + compra de 2.000 L por R$ 12.000 = R$ 17.000 ÷ 3.000 L = R$ 5,6667/L.
// =====================================================================================

namespace App\Http\Controllers;

use App\Models\EntradaCombustivel;
use App\Models\NotaFiscal;
use App\Models\Tanque;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class EntradaCombustivelController extends Controller
{
    // Dados de outras tabelas que acompanham cada entrada na resposta.
    // notaFiscal é o nome do relacionamento no model EntradaCombustivel.
    private const RELACOES = ['tanque:id,nome', 'notaFiscal:id,numero,fornecedor,chave_acesso'];

    // GET /api/entradas?dias=0|7|30|90&tanque_id=&pagina=1 — lista paginada (15 por página).
    public function index(Request $request): JsonResponse
    {
        $query = EntradaCombustivel::query();

        $dias = (int) $request->query('dias', 30);
        if (in_array($dias, [7, 30, 90], true)) {
            $query->where('data', '>=', now()->subDays($dias)->toDateString());
        }

        if ($tanqueId = (int) $request->query('tanque_id')) {
            $query->where('tanque_id', $tanqueId);
        }

        $pagina = $query->with(self::RELACOES)
            ->orderByDesc('data')
            ->orderByDesc('id')
            ->paginate(15, ['*'], 'pagina', max(1, (int) $request->query('pagina', 1)));

        $pagina->getCollection()->each(function ($entrada) {
            if ($entrada->notaFiscal) {
                $entrada->notaFiscal->setAttribute('foto_url', $entrada->notaFiscal->fotoUrl());
                $entrada->notaFiscal->makeHidden(['foto', 'chave_acesso']);
            }
        });

        return response()->json([
            'dados'         => $pagina->getCollection()->values(),
            'pagina'        => $pagina->currentPage(),
            'ultima_pagina' => $pagina->lastPage(),
            'total'         => $pagina->total(),
        ]);
    }

    // POST /api/entradas — registra a chegada de combustível num tanque, com nota fiscal opcional (e foto).
    public function store(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'tanque_id'   => ['required', 'integer', 'exists:tanques,id'],
            'data'        => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'litros'      => ['required', 'numeric', 'min:1', 'max:99999999'],
            'valor_total' => ['required', 'numeric', 'min:0', 'max:99999999'],

            // Nota fiscal (opcional). Se informar o número, o fornecedor passa a ser obrigatório.
            // required_with:X = obrigatório se o campo X vier preenchido.
            'nf_numero'        => ['nullable', 'required_with:nf_chave_acesso', 'string', 'max:20'],
            'nf_fornecedor'    => ['nullable', 'required_with:nf_numero', 'string', 'max:255'],
            // digits:44 = exatamente 44 números; unique = a mesma nota não entra duas vezes.
            'nf_chave_acesso'  => ['nullable', 'digits:44', 'unique:notas_fiscais,chave_acesso'],
        ], [
            'required'                    => 'Preencha o campo :attribute.',
            'data.date_format'            => 'Data inválida.',
            'data.before_or_equal'        => 'A data não pode ser futura.',
            'litros.min'                  => 'Informe pelo menos 1 litro.',
            'tanque_id.exists'            => 'Tanque não encontrado.',
            'nf_numero.required_with'     => 'Informe o número da nota fiscal para anexar a foto.',
            'nf_fornecedor.required_with' => 'Informe o fornecedor da nota fiscal.',
            'foto.image'                  => 'O arquivo precisa ser uma imagem.',
            'foto.max'                    => 'A foto pode ter no máximo 5 MB.',
        ], [
            'tanque_id'   => 'tanque',
            'valor_total' => 'valor total',
            'nf_numero'   => 'número da nota',
            'nf_fornecedor' => 'fornecedor',
        ]);

        // Tudo ou nada: nota, entrada e nível do tanque são salvos juntos.
        $entrada = DB::transaction(function () use ($dados, $request) {
            // Trava o tanque até o fim, para dois lançamentos simultâneos não estourarem a capacidade.
            $tanque = Tanque::lockForUpdate()->findOrFail($dados['tanque_id']);
            $litros = (float) $dados['litros'];
            // Espaço livre no tanque = capacidade − o que já tem dentro.
            $espaco = (float) $tanque->capacidade - (float) $tanque->nivel_atual;

            // "+ 0.001" = pequena folga para arredondamentos de casas decimais.
            if ($litros > $espaco + 0.001) {
                throw ValidationException::withMessages([
                    'litros' => 'O ' . $tanque->nome . ' só comporta mais ' . round($espaco, 2) . ' L.',
                ]);
            }

            // Se veio número de nota, cria a nota fiscal e guarda o id para ligar à entrada.
            $notaId = null;
            if (! empty($dados['nf_numero'])) {
                $caminhoFoto = $request->hasFile('foto')
                    ? $request->file('foto')->store('notas-fiscais', 'local')
                    : null;

                $notaId = NotaFiscal::create([
                    'numero'       => $dados['nf_numero'],
                    'fornecedor'   => $dados['nf_fornecedor'],
                    'data_emissao' => $dados['data'],        // a nota é considerada emitida na data da entrada
                    'valor_total'  => $dados['valor_total'],
                    'foto'         => $caminhoFoto,
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
                // Fica registrado como era o custo médio logo depois desta compra (histórico).
                'custo_medio_apos' => $custoMedio,
            ]);

            // Entram no tanque os litros e o valor da compra.
            $tanque->update(['nivel_atual' => $novoNivel, 'valor_estoque' => $novoValor]);

            return $entrada;
        });

        $entrada->load(self::RELACOES);
        if ($entrada->notaFiscal) {
            $entrada->notaFiscal->setAttribute('foto_url', $entrada->notaFiscal->fotoUrl());
            $entrada->notaFiscal->makeHidden(['foto', 'chave_acesso']);
        }

        return response()->json($entrada, 201);
    }

    // DELETE /api/entradas/{id} — corrige um lançamento errado, tirando os litros do tanque.
    // Só é possível se o combustível ainda estiver lá (não foi gasto em abastecimentos).
    public function destroy(EntradaCombustivel $entrada): JsonResponse
    {
        DB::transaction(function () use ($entrada) {
            $tanque = Tanque::lockForUpdate()->findOrFail($entrada->tanque_id);

            // Se o tanque tem menos litros do que esta compra colocou, parte já foi usada:
            // tirar tudo deixaria o nível negativo.
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

            // Guarda a nota antes de apagar a entrada (depois não daria para achar).
            $nota = $entrada->notaFiscal;
            $entrada->delete();

            // A nota só é apagada se não estiver ligada a mais nada.
            if ($nota && ! $nota->entradas()->exists() && ! $nota->manutencoes()->exists()) {
                if ($nota->foto) {
                    Storage::disk('local')->delete($nota->foto);
                }
                $nota->delete();
            }
        });

        return response()->json(['message' => 'Entrada excluída e litros retirados do tanque.']);
    }

    // GET /api/fotos/notas-fiscais/{nota}?signature=... — rota pública, só com endereço assinado.
    public function foto(NotaFiscal $nota): BinaryFileResponse
    {
        abort_unless($nota->foto && Storage::disk('local')->exists($nota->foto), 404);

        return response()->file(Storage::disk('local')->path($nota->foto));
    }
}
