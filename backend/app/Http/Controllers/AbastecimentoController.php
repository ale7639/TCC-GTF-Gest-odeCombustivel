<?php

namespace App\Http\Controllers;

use App\Models\Abastecimento;
use App\Models\Caminhao;
use App\Models\Tanque;
use App\Services\AbastecimentoService;
use App\Support\Consumo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AbastecimentoController extends Controller
{
    public function limites(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'caminhao_id' => ['required', 'integer', 'exists:caminhoes,id'],
            'tanque_id' => ['nullable', 'integer', 'exists:tanques,id'],
        ]);

        $caminhao = Caminhao::findOrFail($dados['caminhao_id']);
        $this->authorize('abastecer', $caminhao);

        $tanque = isset($dados['tanque_id']) ? Tanque::find($dados['tanque_id']) : null;

        return response()->json([
            'caminhao' => $caminhao->only(['id', 'placa', 'km_atual', 'capacidade_tanque', 'status']),
            'tanque' => $tanque ? [
                'id' => $tanque->id,
                'nome' => $tanque->nome,
                'nivel_atual' => (float) $tanque->nivel_atual,
                'tipo_combustivel' => $tanque->tipo_combustivel,
            ] : null,
            'max_litros_base' => $tanque ? (float) $tanque->nivel_atual : 0,
        ]);
    }

    public function store(Request $request, AbastecimentoService $service): JsonResponse
    {
        $dados = $request->validate([
            'caminhao_id' => ['required', 'integer', 'exists:caminhoes,id'],
            'origem' => ['required', Rule::in(['base', 'externo'])],
            'tanque_id' => ['nullable', 'integer', 'exists:tanques,id'],
            'posto' => ['nullable', 'string', 'max:255'],
            'data' => ['nullable', 'date', 'before_or_equal:today'],
            'litros' => ['required', 'numeric', 'min:0.01', 'max:2000'],
            'km' => ['required', 'integer', 'min:0'],
            'comprovante' => ['nullable', 'image', 'max:5120'],
        ]);

        $caminhao = Caminhao::findOrFail($dados['caminhao_id']);
        $this->authorize('abastecer', $caminhao);

        $abastecimento = $service->registrar($request->user(), $dados, $request->file('comprovante'));

        return response()->json($abastecimento, 201);
    }

    public function doCaminhao(Request $request, Caminhao $caminhao): JsonResponse
    {
        $this->authorize('view', $caminhao);

        $lista = $caminhao->abastecimentos()
            ->with(['tanque:id,nome', 'motorista:id,nome'])
            ->orderByDesc('data')
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        $trechos = Consumo::trechos(
            $caminhao->abastecimentos()->orderBy('km')->orderBy('data')->orderBy('id')->get()
        )->keyBy('abastecimento_id');

        $lista->transform(function ($item) use ($trechos) {
            $item->setAttribute('km_l', $trechos[$item->id]['km_l'] ?? null);

            return $item;
        });

        return response()->json($lista);
    }

    public function index(Request $request): JsonResponse
    {
        $usuario = $request->user();
        $query = Abastecimento::with([
            'caminhao:id,placa,modelo',
            'motorista:id,nome,telefone',
            'tanque:id,nome,tipo_combustivel',
        ])->orderByDesc('data')->orderByDesc('id');

        if ($usuario->isMotorista()) {
            $query->where('motorista_id', $usuario->motorista_id);
        }
        if ($origem = $request->string('origem')->toString()) {
            $query->where('origem', $origem);
        }
        if ($caminhaoId = $request->integer('caminhao_id')) {
            $query->where('caminhao_id', $caminhaoId);
        }
        if ($de = $request->string('de')->toString()) {
            $query->whereDate('data', '>=', $de);
        }
        if ($ate = $request->string('ate')->toString()) {
            $query->whereDate('data', '<=', $ate);
        }

        return response()->json($query->limit(200)->get());
    }

    /**
     * Exclui lançamento incorreto. Se veio da base, devolve litros ao tanque
     * (sem ultrapassar a capacidade). Abastecimento externo só remove o registro.
     */
    public function destroy(Abastecimento $abastecimento): JsonResponse
    {
        DB::transaction(function () use ($abastecimento) {
            if ($abastecimento->tanque_id) {
                $tanque = Tanque::lockForUpdate()->findOrFail($abastecimento->tanque_id);
                $novoNivel = min(
                    (float) $tanque->capacidade,
                    (float) $tanque->nivel_atual + (float) $abastecimento->litros
                );
                $tanque->update(['nivel_atual' => $novoNivel]);
            }

            $abastecimento->delete();
        });

        return response()->json(['message' => 'Abastecimento excluído e litros devolvidos ao tanque, quando aplicável.']);
    }
}
