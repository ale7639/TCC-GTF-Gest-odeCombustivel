<?php

namespace App\Http\Controllers;

use App\Models\Caminhao;
use App\Models\Lavagem;
use App\Models\Motorista;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

// Lavagens (feitas na própria empresa: sem custo, só a data). Tela do ADMIN.
class LavagemController extends Controller
{
    // GET /api/lavagens?busca=&dias=0|7|30|90&pagina=1
    public function index(Request $request): JsonResponse
    {
        $consulta = Lavagem::query()->where('status', 'aprovado');
        $this->filtrar($consulta, $request);

        $pagina = $consulta->orderByDesc('data')->orderByDesc('id')
            ->paginate(20, ['*'], 'pagina', max(1, (int) $request->query('pagina', 1)));

        $placas = Caminhao::pluck('placa', 'id');
        $nomes  = Motorista::pluck('nome', 'id');

        return response()->json([
            'dados' => $pagina->getCollection()->map(fn ($l) => [
                'id'         => $l->id,
                'data'       => Carbon::parse($l->data)->format('d/m/Y'),
                'placa'      => $placas[$l->caminhao_id] ?? '—',
                'motorista'  => $nomes[$l->motorista_id] ?? '—',
                'observacao' => $l->observacao,
            ])->values(),
            'pagina'        => $pagina->currentPage(),
            'ultima_pagina' => $pagina->lastPage(),
            'total'         => $pagina->total(),
        ]);
    }

    // POST /api/lavagens — o admin registra uma lavagem (o motorista é o responsável atual do caminhão).
    public function store(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'caminhao_id' => ['required', 'integer', 'exists:caminhoes,id'],
            'data'        => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'observacao'  => ['nullable', 'string', 'max:255'],
        ], [
            'required'             => 'Preencha o campo :attribute.',
            'data.before_or_equal' => 'A data não pode ser futura.',
        ], ['caminhao_id' => 'caminhão']);

        $caminhao = Caminhao::findOrFail($dados['caminhao_id']);
        if (! $caminhao->motorista_id) {
            throw ValidationException::withMessages(['caminhao_id' => 'Este caminhão não tem motorista responsável.']);
        }

        Lavagem::forceCreate([
            'caminhao_id'  => $caminhao->id,
            'motorista_id' => $caminhao->motorista_id,
            'data'         => $dados['data'],
            'valor'        => null,
            'observacao'   => $dados['observacao'] ?? null,
            'status'       => 'aprovado',
        ]);

        return response()->json(['message' => 'Lavagem registrada.'], 201);
    }

    // DELETE /api/lavagens/{id}
    public function destroy(int $id): JsonResponse
    {
        Lavagem::findOrFail($id)->delete();

        return response()->json(['message' => 'Lavagem excluída.']);
    }

    // Filtros usados também nas manutenções: busca por placa ou motorista, e período.
    public static function filtrar($consulta, Request $request): void
    {
        $busca = trim((string) $request->query('busca', ''));
        if ($busca !== '') {
            $caminhoes  = Caminhao::where('placa', 'like', "%{$busca}%")->pluck('id');
            $motoristas = Motorista::where('nome', 'like', "%{$busca}%")->pluck('id');
            $consulta->where(fn ($q) => $q->whereIn('caminhao_id', $caminhoes)->orWhereIn('motorista_id', $motoristas));
        }

        $dias = (int) $request->query('dias', 0);
        if (in_array($dias, [7, 30, 90], true)) {
            $consulta->where('data', '>=', now()->subDays($dias)->toDateString());
        }
    }
}