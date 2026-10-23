<?php

namespace App\Http\Controllers;

use App\Models\Abastecimento;
use App\Models\Caminhao;
use App\Models\Lavagem;
use App\Models\Manutencao;
use App\Models\Motorista;
use App\Support\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class MotoristaController extends Controller
{
    public function index(): JsonResponse
    {
        $motoristas = Motorista::with('caminhao:id,placa,modelo,motorista_id')
            ->orderBy('nome')
            ->get();

        return response()->json($motoristas);
    }

    public function store(Request $request): JsonResponse
    {
        $dados = $this->validar($request);

        $motorista = DB::transaction(function () use ($dados) {
            $motorista = Motorista::create(Arr::except($dados, 'caminhao_id'));
            $this->vincular($motorista, $dados['caminhao_id'] ?? null);

            return $motorista;
        });

        Auditoria::registrar('motorista.criar', $motorista, ['nome' => $motorista->nome]);

        return response()->json($motorista->load('caminhao:id,placa,modelo,motorista_id'), 201);
    }

    public function show(Motorista $motorista): JsonResponse
    {
        return response()->json($motorista->load('caminhao:id,placa,modelo,km_atual,status,motorista_id'));
    }

    public function update(Request $request, Motorista $motorista): JsonResponse
    {
        $dados = $this->validar($request, $motorista);

        DB::transaction(function () use ($motorista, $dados) {
            $motorista->update(Arr::except($dados, 'caminhao_id'));

            if (array_key_exists('caminhao_id', $dados)) {
                $this->vincular($motorista, $dados['caminhao_id']);
            }
        });

        Auditoria::registrar('motorista.editar', $motorista);

        return response()->json($motorista->load('caminhao:id,placa,modelo,motorista_id'));
    }

    public function destroy(Motorista $motorista): JsonResponse
    {
        $temHistorico = Abastecimento::where('motorista_id', $motorista->id)->exists()
            || Lavagem::where('motorista_id', $motorista->id)->exists()
            || Manutencao::where('motorista_id', $motorista->id)->exists();

        if ($temHistorico) {
            $motorista->update(['ativo' => false]);
            Auditoria::registrar('motorista.desativar', $motorista);

            return response()->json([
                'message' => 'Este motorista tem histórico. Ele foi marcado como inativo.',
                'motorista' => $motorista->fresh('caminhao'),
            ]);
        }

        $motorista->delete();
        Auditoria::registrar('motorista.excluir', $motorista);

        return response()->json(['message' => 'Motorista excluído.']);
    }

    private function vincular(Motorista $motorista, ?int $caminhaoId): void
    {
        Caminhao::where('motorista_id', $motorista->id)->update(['motorista_id' => null]);

        if ($caminhaoId) {
            Caminhao::whereKey($caminhaoId)->update(['motorista_id' => $motorista->id]);
        }
    }

    private function validar(Request $request, ?Motorista $motorista = null): array
    {
        if ($request->filled('cpf')) {
            $digitos = preg_replace('/\D/', '', $request->input('cpf'));
            if (strlen($digitos) === 11) {
                $request->merge([
                    'cpf' => substr($digitos, 0, 3).'.'.substr($digitos, 3, 3).'.'
                        .substr($digitos, 6, 3).'-'.substr($digitos, 9, 2),
                ]);
            }
        }

        return $request->validate([
            'nome' => ['required', 'string', 'max:255'],
            'cpf' => [
                'required', 'string', 'regex:/^\d{3}\.\d{3}\.\d{3}-\d{2}$/',
                Rule::unique('motoristas', 'cpf')->ignore($motorista?->id),
            ],
            'cnh' => ['required', 'string', 'max:20'],
            'cnh_validade' => ['nullable', 'date'],
            'telefone' => ['nullable', 'string', 'max:20'],
            'limite_litros_dia' => ['nullable', 'numeric', 'min:0', 'max:2000'],
            'credito_litros_mes' => ['nullable', 'numeric', 'min:0', 'max:50000'],
            'ativo' => ['required', 'boolean'],
            'caminhao_id' => [
                'nullable', 'integer', 'exists:caminhoes,id',
                function ($atributo, $valor, $falhar) use ($motorista) {
                    $dono = Caminhao::whereKey($valor)->value('motorista_id');

                    if ($dono && (int) $dono !== (int) $motorista?->id) {
                        $falhar('Este caminhão já tem outro motorista responsável.');
                    }
                },
            ],
        ], [
            'cpf.unique' => 'Já existe um motorista com este CPF.',
            'cpf.regex' => 'CPF inválido. Informe os 11 números.',
            'caminhao_id.exists' => 'Caminhão não encontrado.',
            'required' => 'Preencha o campo :attribute.',
        ]);
    }
}
