<?php

namespace App\Http\Controllers;

use App\Models\Caminhao;
use App\Models\Manutencao;
use App\Models\Motorista;
use App\Models\NotaFiscal;
use App\Support\Auditoria;
use App\Support\Oleo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

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
        ], [
            'data_realizada.before_or_equal' => 'A data em que foi feita não pode ser posterior a hoje.',
            'oleo_proxima_data.after_or_equal' => 'A próxima data sugerida deve ser hoje ou uma data futura.',
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
        ], [
            'data_realizada.required' => 'Informe a data em que a OS foi fechada.',
            'data_realizada.before_or_equal' => 'A data em que foi feita não pode ser posterior a hoje.',
            'oleo_proxima_data.after_or_equal' => 'A próxima data sugerida deve ser hoje ou uma data futura.',
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

    /** GET /api/manutencoes — listagem flat (admin mobile). */
    public function listarTodas(Request $request): JsonResponse
    {
        $consulta = Manutencao::query()->where('status', 'aprovado');
        LavagemController::filtrar($consulta, $request);

        $totalValor = (float) (clone $consulta)->sum('valor');

        $pagina = $consulta->orderByDesc('data')->orderByDesc('id')
            ->paginate(20, ['*'], 'pagina', max(1, (int) $request->query('pagina', 1)));

        $placas = Caminhao::pluck('placa', 'id');
        $nomes = Motorista::pluck('nome', 'id');
        $notas = NotaFiscal::whereIn('id', $pagina->getCollection()->pluck('nota_fiscal_id')->filter())
            ->pluck('numero', 'id');

        return response()->json([
            'dados' => $pagina->getCollection()->map(fn ($m) => [
                'id' => $m->id,
                'data' => Carbon::parse($m->data)->format('d/m/Y'),
                'placa' => $placas[$m->caminhao_id] ?? '—',
                'motorista' => $nomes[$m->motorista_id] ?? '—',
                'tipo' => $m->tipo,
                'descricao' => $m->descricao,
                'valor' => (float) $m->valor,
                'km' => (int) $m->km,
                'nota' => $m->nota_fiscal_id ? ($notas[$m->nota_fiscal_id] ?? null) : null,
            ])->values(),
            'pagina' => $pagina->currentPage(),
            'ultima_pagina' => $pagina->lastPage(),
            'total' => $pagina->total(),
            'total_valor' => round($totalValor, 2),
        ]);
    }

    /** POST /api/manutencoes — registro flat (admin mobile). */
    public function storeGlobal(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'caminhao_id' => ['required', 'integer', 'exists:caminhoes,id'],
            'data' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'tipo' => ['required', 'string', 'max:255'],
            'descricao' => ['nullable', 'string', 'max:1000'],
            'valor' => ['required', 'numeric', 'min:0', 'max:9999999'],
            'km' => ['required', 'integer', 'min:0'],
            'nf_numero' => ['nullable', 'required_with:nf_chave_acesso', 'string', 'max:20'],
            'nf_fornecedor' => ['nullable', 'required_with:nf_numero', 'string', 'max:255'],
            'nf_chave_acesso' => ['nullable', 'digits:44', 'unique:notas_fiscais,chave_acesso'],
        ], [
            'required' => 'Preencha o campo :attribute.',
            'data.before_or_equal' => 'A data não pode ser futura.',
        ], ['caminhao_id' => 'caminhão', 'descricao' => 'descrição', 'km' => 'quilometragem']);

        DB::transaction(function () use ($dados) {
            $caminhao = Caminhao::lockForUpdate()->findOrFail($dados['caminhao_id']);
            if (! $caminhao->motorista_id) {
                throw ValidationException::withMessages(['caminhao_id' => 'Este caminhão não tem motorista responsável.']);
            }

            $notaId = null;
            if (! empty($dados['nf_numero'])) {
                $notaId = NotaFiscal::forceCreate([
                    'numero' => $dados['nf_numero'],
                    'fornecedor' => $dados['nf_fornecedor'],
                    'data_emissao' => $dados['data'],
                    'valor_total' => $dados['valor'],
                    'chave_acesso' => $dados['nf_chave_acesso'] ?? null,
                    'categoria' => 'Manutenção',
                    'caminhao_id' => $caminhao->id,
                ])->id;
            }

            Manutencao::forceCreate([
                'caminhao_id' => $caminhao->id,
                'motorista_id' => $caminhao->motorista_id,
                'data' => $dados['data'],
                'tipo' => $dados['tipo'],
                'descricao' => $dados['descricao'] ?? null,
                'valor' => $dados['valor'],
                'km' => $dados['km'],
                'nota_fiscal_id' => $notaId,
                'status' => 'aprovado',
            ]);

            $caminhao->update(['km_atual' => max((int) $caminhao->km_atual, (int) $dados['km'])]);
        });

        return response()->json(['message' => 'Manutenção registrada.'], 201);
    }

    public function destroy(int $id): JsonResponse
    {
        DB::transaction(function () use ($id) {
            $manutencao = Manutencao::findOrFail($id);
            $notaId = $manutencao->nota_fiscal_id;
            $manutencao->delete();

            if ($notaId && ! Manutencao::where('nota_fiscal_id', $notaId)->exists()) {
                NotaFiscal::whereKey($notaId)->whereDoesntHave('entradas')->delete();
            }
        });

        return response()->json(['message' => 'Manutenção excluída.']);
    }
}
