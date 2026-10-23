<?php

namespace App\Http\Controllers;

use App\Models\Abastecimento;
use App\Models\ConciliacaoTanque;
use App\Models\EntradaCombustivel;
use App\Models\Tanque;
use App\Support\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConciliacaoTanqueController extends Controller
{
    /** Variação acima deste valor (L) gera alerta. */
    public const LIMITE_ALERTA = 50;

    public function index(Tanque $tanque): JsonResponse
    {
        $lista = ConciliacaoTanque::where('tanque_id', $tanque->id)
            ->orderByDesc('data')
            ->limit(30)
            ->get();

        return response()->json($lista);
    }

    public function preview(Request $request, Tanque $tanque): JsonResponse
    {
        $dados = $request->validate([
            'data' => ['required', 'date', 'before_or_equal:today'],
        ]);

        return response()->json($this->calcular($tanque, $dados['data']));
    }

    public function store(Request $request, Tanque $tanque): JsonResponse
    {
        $dados = $request->validate([
            'data' => ['required', 'date', 'before_or_equal:today'],
            'nivel_informado' => ['required', 'numeric', 'min:0'],
            'observacao' => ['nullable', 'string', 'max:2000'],
        ]);

        if ((float) $dados['nivel_informado'] > (float) $tanque->capacidade) {
            return response()->json([
                'message' => 'O nível informado não pode passar da capacidade do tanque.',
            ], 422);
        }

        $calc = $this->calcular($tanque, $dados['data']);
        $variacao = round((float) $dados['nivel_informado'] - $calc['nivel_calculado'], 2);
        $alerta = abs($variacao) > self::LIMITE_ALERTA;

        $registro = ConciliacaoTanque::updateOrCreate(
            ['tanque_id' => $tanque->id, 'data' => $dados['data']],
            [
                'user_id' => $request->user()->id,
                'nivel_informado' => $dados['nivel_informado'],
                'entradas_dia' => $calc['entradas_dia'],
                'saidas_dia' => $calc['saidas_dia'],
                'nivel_calculado' => $calc['nivel_calculado'],
                'variacao' => $variacao,
                'alerta' => $alerta,
                'observacao' => $dados['observacao'] ?? null,
            ]
        );

        Auditoria::registrar('tanque.conciliar', $registro, [
            'tanque' => $tanque->nome,
            'variacao' => $variacao,
            'alerta' => $alerta,
        ]);

        return response()->json($registro, 201);
    }

    private function calcular(Tanque $tanque, string $data): array
    {
        $entradas = (float) EntradaCombustivel::where('tanque_id', $tanque->id)
            ->whereDate('data', $data)
            ->sum('litros');

        $saidas = (float) Abastecimento::where('tanque_id', $tanque->id)
            ->where('origem', 'base')
            ->whereDate('data', $data)
            ->sum('litros');

        // Nível atual do sistema já reflete entradas/saídas; o “esperado” do dia
        // é o nível atual (fonte de verdade do saldo).
        $nivelCalculado = (float) $tanque->nivel_atual;

        return [
            'data' => $data,
            'entradas_dia' => round($entradas, 2),
            'saidas_dia' => round($saidas, 2),
            'nivel_sistema' => round($nivelCalculado, 2),
            'nivel_calculado' => round($nivelCalculado, 2),
            'limite_alerta' => self::LIMITE_ALERTA,
        ];
    }
}
