<?php

namespace App\Http\Controllers;

use App\Models\Caminhao;
use App\Models\Manutencao;
use App\Support\Auditoria;
use App\Support\Oleo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ManutencaoController extends Controller
{
    /** Hub da frota: status de óleo + manutenções recentes/agendadas. */
    public function hub(Request $request): JsonResponse
    {
        $usuario = $request->user();
        $query = Caminhao::with('motorista:id,nome')
            ->where('status', '!=', 'inativo')
            ->orderBy('placa');

        if ($usuario->isMotorista()) {
            $query->where('motorista_id', $usuario->motorista_id);
        }

        $caminhoes = $query->get()->map(function (Caminhao $c) {
            $oleo = Oleo::resumo($c);
            $agendadas = $c->manutencoes()
                ->where('status', 'agendada')
                ->orderBy('data_prevista')
                ->limit(3)
                ->get(['id', 'tipo', 'data_prevista', 'data', 'status', 'descricao']);

            return [
                'id' => $c->id,
                'placa' => $c->placa,
                'modelo' => $c->modelo,
                'km_atual' => $c->km_atual,
                'status' => $c->status,
                'motorista' => $c->motorista?->only(['id', 'nome']),
                'oleo' => $oleo,
                'agendadas' => $agendadas,
            ];
        });

        $alertas = $caminhoes
            ->filter(fn ($c) => in_array($c['oleo']['alerta'], ['atrasado', 'proximo', 'sem_registro'], true))
            ->values();

        return response()->json([
            'caminhoes' => $caminhoes,
            'alertas' => $alertas,
            'resumo' => [
                'atrasados' => $alertas->where('oleo.alerta', 'atrasado')->count(),
                'proximos' => $alertas->where('oleo.alerta', 'proximo')->count(),
                'sem_registro' => $alertas->where('oleo.alerta', 'sem_registro')->count(),
            ],
        ]);
    }

    public function index(Caminhao $caminhao): JsonResponse
    {
        $this->authorize('view', $caminhao);

        $lista = $caminhao->manutencoes()
            ->with(['motorista:id,nome', 'notaFiscal'])
            ->orderByRaw("CASE status WHEN 'agendada' THEN 0 ELSE 1 END")
            ->orderByDesc('data_prevista')
            ->orderByDesc('data')
            ->limit(40)
            ->get();

        return response()->json([
            'caminhao' => [
                'id' => $caminhao->id,
                'placa' => $caminhao->placa,
                'modelo' => $caminhao->modelo,
                'km_atual' => $caminhao->km_atual,
                'status' => $caminhao->status,
                'oleo' => Oleo::resumo($caminhao),
                'oleo_intervalo_km' => $caminhao->oleo_intervalo_km,
            ],
            'historico' => $lista,
        ]);
    }

    public function store(Request $request, Caminhao $caminhao): JsonResponse
    {
        $this->authorize('operar', $caminhao);
        abort_unless($request->user()->isGestao(), 403, 'Acesso não autorizado para o seu perfil.');

        $dados = $request->validate([
            'status' => ['required', Rule::in(['agendada', 'concluida'])],
            'data_prevista' => ['required', 'date'],
            'data_realizada' => ['nullable', 'date', 'required_if:status,concluida', 'before_or_equal:today'],
            'tipo' => ['required', 'string', 'max:120'],
            'descricao' => ['required', 'string', 'max:2000'],
            'valor' => ['nullable', 'numeric', 'min:0'],
            'km' => ['required', 'integer', 'min:0'],
            'checklist' => ['nullable', 'array'],
            'checklist.*' => ['string', 'max:120'],
            'marcar_caminhao_manutencao' => ['sometimes', 'boolean'],
            'oleo_intervalo_km' => ['nullable', 'integer', 'min:1000', 'max:100000'],
            'oleo_proxima_data' => ['nullable', 'date', 'after_or_equal:today'],
        ]);

        $motoristaId = $caminhao->motorista_id;
        if (! $motoristaId) {
            return response()->json([
                'message' => 'Vincule um motorista ao caminhão antes de registrar a manutenção.',
            ], 422);
        }

        $dataRef = $dados['status'] === 'concluida'
            ? ($dados['data_realizada'] ?? $dados['data_prevista'])
            : $dados['data_prevista'];

        $manutencao = $caminhao->manutencoes()->create([
            'motorista_id' => $motoristaId,
            'data' => $dataRef,
            'data_prevista' => $dados['data_prevista'],
            'data_realizada' => $dados['status'] === 'concluida' ? $dataRef : null,
            'status' => $dados['status'],
            'tipo' => $dados['tipo'],
            'descricao' => $dados['descricao'],
            'checklist' => $dados['checklist'] ?? null,
            'valor' => $dados['valor'] ?? 0,
            'km' => $dados['km'],
        ]);

        if ($dados['km'] > $caminhao->km_atual) {
            $caminhao->km_atual = $dados['km'];
        }

        if (! empty($dados['marcar_caminhao_manutencao']) && $dados['status'] === 'agendada') {
            $caminhao->status = 'manutencao';
        }

        if ($dados['status'] === 'concluida' && Oleo::ehTrocaDeOleo($dados['tipo'])) {
            $intervalo = (int) ($dados['oleo_intervalo_km'] ?? $caminhao->oleo_intervalo_km ?: 10000);
            $caminhao->oleo_ultima_data = $dataRef;
            $caminhao->oleo_ultima_km = $dados['km'];
            $caminhao->oleo_intervalo_km = $intervalo;
            if (! empty($dados['oleo_proxima_data'])) {
                $caminhao->oleo_proxima_data = $dados['oleo_proxima_data'];
            } else {
                $caminhao->oleo_proxima_data = null;
            }
            if ($caminhao->status === 'manutencao') {
                $caminhao->status = 'ativo';
            }
        }

        $caminhao->save();

        Auditoria::registrar('manutencao.criar', $manutencao, [
            'placa' => $caminhao->placa,
            'status' => $manutencao->status,
            'tipo' => $manutencao->tipo,
        ]);

        return response()->json([
            'manutencao' => $manutencao->load('motorista:id,nome'),
            'caminhao' => [
                'id' => $caminhao->id,
                'placa' => $caminhao->placa,
                'status' => $caminhao->status,
                'oleo' => Oleo::resumo($caminhao->fresh()),
            ],
        ], 201);
    }

    public function concluir(Request $request, Caminhao $caminhao, Manutencao $manutencao): JsonResponse
    {
        $this->authorize('operar', $caminhao);
        abort_unless($request->user()->isGestao(), 403, 'Acesso não autorizado para o seu perfil.');
        abort_unless($manutencao->caminhao_id === $caminhao->id, 404);

        if ($manutencao->status === 'concluida') {
            return response()->json(['message' => 'Esta manutenção já está concluída.'], 422);
        }

        $dados = $request->validate([
            'data_realizada' => ['required', 'date', 'before_or_equal:today'],
            'km' => ['required', 'integer', 'min:0'],
            'valor' => ['nullable', 'numeric', 'min:0'],
            'descricao' => ['nullable', 'string', 'max:2000'],
            'checklist' => ['nullable', 'array'],
            'checklist.*' => ['string', 'max:120'],
            'oleo_intervalo_km' => ['nullable', 'integer', 'min:1000', 'max:100000'],
            'oleo_proxima_data' => ['nullable', 'date', 'after_or_equal:today'],
            'liberar_caminhao' => ['sometimes', 'boolean'],
        ]);

        $manutencao->update([
            'status' => 'concluida',
            'data_realizada' => $dados['data_realizada'],
            'data' => $dados['data_realizada'],
            'km' => $dados['km'],
            'valor' => $dados['valor'] ?? $manutencao->valor,
            'descricao' => $dados['descricao'] ?? $manutencao->descricao,
            'checklist' => $dados['checklist'] ?? $manutencao->checklist,
        ]);

        if ($dados['km'] > $caminhao->km_atual) {
            $caminhao->km_atual = $dados['km'];
        }

        if (Oleo::ehTrocaDeOleo($manutencao->tipo)) {
            $intervalo = (int) ($dados['oleo_intervalo_km'] ?? $caminhao->oleo_intervalo_km ?: 10000);
            $caminhao->oleo_ultima_data = $dados['data_realizada'];
            $caminhao->oleo_ultima_km = $dados['km'];
            $caminhao->oleo_intervalo_km = $intervalo;
            $caminhao->oleo_proxima_data = $dados['oleo_proxima_data'] ?? null;
        }

        if (! empty($dados['liberar_caminhao']) || $caminhao->status === 'manutencao') {
            $caminhao->status = 'ativo';
        }

        $caminhao->save();

        Auditoria::registrar('manutencao.concluir', $manutencao, ['placa' => $caminhao->placa]);

        return response()->json([
            'manutencao' => $manutencao->fresh()->load('motorista:id,nome'),
            'caminhao' => [
                'id' => $caminhao->id,
                'placa' => $caminhao->placa,
                'status' => $caminhao->status,
                'oleo' => Oleo::resumo($caminhao->fresh()),
            ],
        ]);
    }
}
