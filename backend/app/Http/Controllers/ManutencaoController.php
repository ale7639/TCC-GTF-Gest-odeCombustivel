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
    /** Status de OS: aberto / em_andamento / fechado (+ aliases antigos). */
    private function normalizarStatus(string $status): string
    {
        return match ($status) {
            'agendada' => 'aberto',
            'concluida' => 'fechado',
            default => $status,
        };
    }

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
            $abertas = $c->manutencoes()
                ->whereIn('status', ['aberto', 'em_andamento', 'agendada'])
                ->orderBy('data_prevista')
                ->limit(3)
                ->get(['id', 'tipo', 'oficina', 'data_prevista', 'data', 'status', 'descricao']);

            return [
                'id' => $c->id,
                'placa' => $c->placa,
                'modelo' => $c->modelo,
                'km_atual' => $c->km_atual,
                'status' => $c->status,
                'motorista' => $c->motorista?->only(['id', 'nome']),
                'oleo' => $oleo,
                'agendadas' => $abertas,
                'ordens' => $abertas,
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
                'os_abertas' => Manutencao::whereIn('status', ['aberto', 'em_andamento', 'agendada'])->count(),
            ],
        ]);
    }

    public function index(Caminhao $caminhao): JsonResponse
    {
        $this->authorize('view', $caminhao);

        $lista = $caminhao->manutencoes()
            ->with(['motorista:id,nome', 'notaFiscal'])
            ->orderByRaw("CASE status WHEN 'aberto' THEN 0 WHEN 'em_andamento' THEN 1 WHEN 'agendada' THEN 0 ELSE 2 END")
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
            'status' => ['required', Rule::in(['aberto', 'em_andamento', 'fechado', 'agendada', 'concluida'])],
            'data_prevista' => ['required', 'date'],
            'data_realizada' => ['nullable', 'date', 'before_or_equal:today'],
            'tipo' => ['required', 'string', 'max:120'],
            'oficina' => ['nullable', 'string', 'max:120'],
            'descricao' => ['required', 'string', 'max:2000'],
            'valor' => ['nullable', 'numeric', 'min:0'],
            'km' => ['required', 'integer', 'min:0'],
            'checklist' => ['nullable', 'array'],
            'checklist.*' => ['string', 'max:120'],
            'marcar_caminhao_manutencao' => ['sometimes', 'boolean'],
            'oleo_intervalo_km' => ['nullable', 'integer', 'min:1000', 'max:100000'],
            'oleo_proxima_data' => ['nullable', 'date', 'after_or_equal:today'],
        ]);

        $status = $this->normalizarStatus($dados['status']);
        if ($status === 'fechado' && empty($dados['data_realizada'])) {
            return response()->json(['message' => 'Informe a data em que a OS foi fechada.'], 422);
        }

        $motoristaId = $caminhao->motorista_id;
        if (! $motoristaId) {
            return response()->json([
                'message' => 'Vincule um motorista ao caminhão antes de registrar a manutenção.',
            ], 422);
        }

        $dataRef = $status === 'fechado'
            ? ($dados['data_realizada'] ?? $dados['data_prevista'])
            : $dados['data_prevista'];

        $manutencao = $caminhao->manutencoes()->create([
            'motorista_id' => $motoristaId,
            'data' => $dataRef,
            'data_prevista' => $dados['data_prevista'],
            'data_realizada' => $status === 'fechado' ? $dataRef : null,
            'status' => $status,
            'tipo' => $dados['tipo'],
            'oficina' => $dados['oficina'] ?? null,
            'descricao' => $dados['descricao'],
            'checklist' => $dados['checklist'] ?? null,
            'valor' => $dados['valor'] ?? 0,
            'km' => $dados['km'],
        ]);

        if ($dados['km'] > $caminhao->km_atual) {
            $caminhao->km_atual = $dados['km'];
        }

        if (! empty($dados['marcar_caminhao_manutencao']) && in_array($status, ['aberto', 'em_andamento'], true)) {
            $caminhao->status = 'manutencao';
        }

        if ($status === 'fechado' && Oleo::ehTrocaDeOleo($dados['tipo'])) {
            $intervalo = (int) ($dados['oleo_intervalo_km'] ?? $caminhao->oleo_intervalo_km ?: 10000);
            $caminhao->oleo_ultima_data = $dataRef;
            $caminhao->oleo_ultima_km = $dados['km'];
            $caminhao->oleo_intervalo_km = $intervalo;
            $caminhao->oleo_proxima_data = $dados['oleo_proxima_data'] ?? null;
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

    public function atualizarStatus(Request $request, Caminhao $caminhao, Manutencao $manutencao): JsonResponse
    {
        $this->authorize('operar', $caminhao);
        abort_unless($request->user()->isGestao(), 403);
        abort_unless($manutencao->caminhao_id === $caminhao->id, 404);

        $dados = $request->validate([
            'status' => ['required', Rule::in(['aberto', 'em_andamento', 'fechado'])],
            'oficina' => ['nullable', 'string', 'max:120'],
        ]);

        if ($dados['status'] === 'fechado') {
            return $this->concluir($request, $caminhao, $manutencao);
        }

        $manutencao->update([
            'status' => $dados['status'],
            'oficina' => $dados['oficina'] ?? $manutencao->oficina,
        ]);

        if ($dados['status'] === 'em_andamento' && $caminhao->status === 'ativo') {
            $caminhao->update(['status' => 'manutencao']);
        }

        return response()->json([
            'manutencao' => $manutencao->fresh()->load('motorista:id,nome'),
            'caminhao' => $caminhao->fresh()->only(['id', 'placa', 'status']),
        ]);
    }

    public function concluir(Request $request, Caminhao $caminhao, Manutencao $manutencao): JsonResponse
    {
        $this->authorize('operar', $caminhao);
        abort_unless($request->user()->isGestao(), 403, 'Acesso não autorizado para o seu perfil.');
        abort_unless($manutencao->caminhao_id === $caminhao->id, 404);

        if ($manutencao->status === 'fechado' || $manutencao->status === 'concluida') {
            return response()->json(['message' => 'Esta ordem de serviço já está fechada.'], 422);
        }

        $dados = $request->validate([
            'data_realizada' => ['required', 'date', 'before_or_equal:today'],
            'km' => ['required', 'integer', 'min:0'],
            'valor' => ['nullable', 'numeric', 'min:0'],
            'descricao' => ['nullable', 'string', 'max:2000'],
            'oficina' => ['nullable', 'string', 'max:120'],
            'checklist' => ['nullable', 'array'],
            'checklist.*' => ['string', 'max:120'],
            'oleo_intervalo_km' => ['nullable', 'integer', 'min:1000', 'max:100000'],
            'oleo_proxima_data' => ['nullable', 'date', 'after_or_equal:today'],
            'liberar_caminhao' => ['sometimes', 'boolean'],
        ]);

        $manutencao->update([
            'status' => 'fechado',
            'data_realizada' => $dados['data_realizada'],
            'data' => $dados['data_realizada'],
            'km' => $dados['km'],
            'valor' => $dados['valor'] ?? $manutencao->valor,
            'descricao' => $dados['descricao'] ?? $manutencao->descricao,
            'oficina' => $dados['oficina'] ?? $manutencao->oficina,
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
