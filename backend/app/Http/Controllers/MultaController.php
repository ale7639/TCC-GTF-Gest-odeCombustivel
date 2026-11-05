<?php

namespace App\Http\Controllers;

use App\Models\Multa;
use App\Support\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MultaController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Multa::with(['caminhao:id,placa', 'motorista:id,nome'])
            ->orderByRaw("CASE status WHEN 'pendente' THEN 0 WHEN 'indicado' THEN 1 ELSE 2 END")
            ->orderBy('prazo')
            ->orderByDesc('id');

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }

        return response()->json($query->limit(100)->get());
    }

    public function store(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'caminhao_id' => ['required', 'integer', 'exists:caminhoes,id'],
            'motorista_id' => ['nullable', 'integer', 'exists:motoristas,id'],
            'data' => ['required', 'date'],
            'valor' => ['required', 'numeric', 'min:0'],
            'descricao' => ['required', 'string', 'max:255'],
            'prazo' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['pendente', 'indicado', 'pago'])],
        ]);

        $multa = Multa::create([
            ...$dados,
            'status' => $dados['status'] ?? 'pendente',
            'user_id' => $request->user()->id,
        ]);

        Auditoria::registrar('multa.criar', $multa);

        return response()->json($multa->load(['caminhao:id,placa', 'motorista:id,nome']), 201);
    }

    public function update(Request $request, Multa $multa): JsonResponse
    {
        $dados = $request->validate([
            'caminhao_id' => ['sometimes', 'integer', 'exists:caminhoes,id'],
            'motorista_id' => ['nullable', 'integer', 'exists:motoristas,id'],
            'data' => ['sometimes', 'date'],
            'valor' => ['sometimes', 'numeric', 'min:0'],
            'descricao' => ['sometimes', 'string', 'max:255'],
            'prazo' => ['nullable', 'date'],
            'status' => ['sometimes', Rule::in(['pendente', 'indicado', 'pago'])],
        ]);

        $multa->update($dados);
        Auditoria::registrar('multa.editar', $multa);

        return response()->json($multa->fresh()->load(['caminhao:id,placa', 'motorista:id,nome']));
    }
}
