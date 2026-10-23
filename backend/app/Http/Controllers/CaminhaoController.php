<?php

namespace App\Http\Controllers;

use App\Models\Caminhao;
use App\Support\Auditoria;
use App\Support\Consumo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CaminhaoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Caminhao::class);

        $query = Caminhao::with('motorista:id,nome,telefone,ativo')->orderBy('placa');
        $usuario = $request->user();

        if ($usuario->isMotorista()) {
            $query->where('motorista_id', $usuario->motorista_id);
        }

        if ($busca = $request->string('q')->toString()) {
            $query->where(function ($q) use ($busca) {
                $q->where('placa', 'like', "%{$busca}%")
                    ->orWhere('modelo', 'like', "%{$busca}%");
            });
        }

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Caminhao::class);
        $caminhao = Caminhao::create($this->validar($request));
        Auditoria::registrar('caminhao.criar', $caminhao, ['placa' => $caminhao->placa]);

        return response()->json($caminhao->load('motorista:id,nome,telefone'), 201);
    }

    public function show(Request $request, Caminhao $caminhao): JsonResponse
    {
        $this->authorize('view', $caminhao);
        $caminhao->load('motorista:id,nome,cpf,cnh,telefone,ativo');
        $abastecimentos = $caminhao->abastecimentos()
            ->with(['tanque:id,nome', 'motorista:id,nome'])
            ->orderByDesc('data')
            ->orderByDesc('id')
            ->limit(30)
            ->get();

        $anteriores = $caminhao->abastecimentos()->orderBy('km')->orderBy('data')->orderBy('id')->get();
        $porId = Consumo::trechos($anteriores)->keyBy('abastecimento_id');
        $abastecimentos->transform(function ($item) use ($porId) {
            $item->setAttribute('km_l', $porId[$item->id]['km_l'] ?? null);

            return $item;
        });

        return response()->json($caminhao->toArray() + [
            'abastecimentos' => $abastecimentos,
            'media_km_l' => $caminhao->media_km_l,
        ]);
    }

    public function update(Request $request, Caminhao $caminhao): JsonResponse
    {
        $this->authorize('update', $caminhao);
        $caminhao->update($this->validar($request, $caminhao));
        Auditoria::registrar('caminhao.editar', $caminhao, ['placa' => $caminhao->placa]);

        return response()->json($caminhao->load('motorista:id,nome,telefone'));
    }

    public function destroy(Caminhao $caminhao): JsonResponse
    {
        $this->authorize('delete', $caminhao);

        $temHistorico = $caminhao->abastecimentos()->exists()
            || $caminhao->lavagens()->exists()
            || $caminhao->manutencoes()->exists();

        if ($temHistorico) {
            $caminhao->update(['status' => 'inativo', 'motorista_id' => null]);
            Auditoria::registrar('caminhao.desativar', $caminhao);

            return response()->json([
                'message' => 'Este caminhão tem histórico. Ele foi desativado em vez de excluído.',
                'caminhao' => $caminhao->fresh('motorista'),
            ]);
        }

        $caminhao->delete();
        Auditoria::registrar('caminhao.excluir', $caminhao);

        return response()->json(['message' => 'Caminhão excluído.']);
    }

    private function validar(Request $request, ?Caminhao $caminhao = null): array
    {
        if ($request->filled('placa')) {
            $request->merge([
                'placa' => strtoupper(str_replace(['-', ' '], '', $request->input('placa'))),
            ]);
        }

        return $request->validate([
            'placa' => [
                'required', 'string', 'max:8',
                Rule::unique('caminhoes', 'placa')->ignore($caminhao?->id),
            ],
            'modelo' => ['required', 'string', 'max:255'],
            'ano' => ['required', 'integer', 'between:1980,'.(date('Y') + 1)],
            'capacidade_tanque' => ['required', 'numeric', 'min:1', 'max:99999'],
            'km_atual' => ['required', 'integer', 'min:0'],
            'status' => ['required', Rule::in(['ativo', 'manutencao', 'inativo'])],
            'crlv_validade' => ['nullable', 'date'],
            'seguro_validade' => ['nullable', 'date'],
            'meta_km_l' => ['nullable', 'numeric', 'min:0.5', 'max:20'],
            'motorista_id' => [
                'nullable', 'integer', 'exists:motoristas,id',
                Rule::unique('caminhoes', 'motorista_id')->ignore($caminhao?->id),
            ],
        ], [
            'placa.unique' => 'Já existe um caminhão com esta placa.',
            'motorista_id.unique' => 'Este motorista já é responsável por outro caminhão.',
            'motorista_id.exists' => 'Motorista não encontrado.',
            'required' => 'Preencha o campo :attribute.',
        ]);
    }
}
