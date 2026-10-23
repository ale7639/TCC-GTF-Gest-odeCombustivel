<?php

namespace App\Http\Controllers;

use App\Models\Tanque;
use App\Services\TanqueService;
use App\Support\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TanqueController extends Controller
{
    public function index(): JsonResponse
    {
        $tanques = Tanque::orderBy('nome')->get()->map(fn (Tanque $tanque) => $this->comPercentual($tanque));

        return response()->json($tanques);
    }

    public function store(Request $request): JsonResponse
    {
        $tanque = Tanque::create($this->validar($request));
        Auditoria::registrar('tanque.criar', $tanque, ['nome' => $tanque->nome]);

        return response()->json($this->comPercentual($tanque), 201);
    }

    public function show(Tanque $tanque): JsonResponse
    {
        $tanque->load(['entradas' => function ($q) {
            $q->with('notaFiscal')->orderByDesc('data')->orderByDesc('id')->limit(20);
        }]);

        return response()->json($this->comPercentual($tanque));
    }

    public function update(Request $request, Tanque $tanque): JsonResponse
    {
        $dados = $this->validar($request, $tanque);

        if ((float) $dados['capacidade'] < (float) $tanque->nivel_atual) {
            throw ValidationException::withMessages([
                'capacidade' => 'A capacidade não pode ser menor que o nível atual ('.(float) $tanque->nivel_atual.' L).',
            ]);
        }

        $tanque->update([
            'nome' => $dados['nome'],
            'tipo_combustivel' => $dados['tipo_combustivel'],
            'capacidade' => $dados['capacidade'],
        ]);
        Auditoria::registrar('tanque.editar', $tanque);

        return response()->json($this->comPercentual($tanque->refresh()));
    }

    public function entrada(Request $request, Tanque $tanque, TanqueService $service): JsonResponse
    {
        $dados = $request->validate([
            'data' => ['required', 'date', 'before_or_equal:today'],
            'litros' => ['required', 'numeric', 'min:0.01'],
            'valor_total' => ['required', 'numeric', 'min:0'],
            'numero' => ['required', 'string', 'max:20'],
            'fornecedor' => ['required', 'string', 'max:255'],
            'chave_acesso' => ['nullable', 'string', 'size:44'],
            'comprovante' => ['required', 'image', 'max:5120'],
        ], [
            'comprovante.required' => 'Envie a foto da nota fiscal / cupom da entrada.',
            'chave_acesso.size' => 'A chave de acesso da NF-e tem 44 dígitos.',
        ]);

        $entrada = $service->registrarEntrada($tanque, $dados, $request->file('comprovante'));

        return response()->json($entrada, 201);
    }

    public function destroy(Tanque $tanque): JsonResponse
    {
        if ($tanque->abastecimentos()->exists() || $tanque->entradas()->exists()) {
            return response()->json([
                'message' => 'Este tanque tem histórico de abastecimentos ou entradas de combustível e não pode ser excluído.',
            ], 409);
        }

        $tanque->delete();

        return response()->json(['message' => 'Tanque excluído.']);
    }

    private function validar(Request $request, ?Tanque $tanque = null): array
    {
        $regras = [
            'nome' => [
                'required', 'string', 'max:255',
                Rule::unique('tanques', 'nome')->ignore($tanque?->id),
            ],
            'tipo_combustivel' => ['required', 'string', 'max:80'],
            'capacidade' => ['required', 'numeric', 'min:1', 'max:99999999'],
        ];

        if (! $tanque) {
            $regras['nivel_atual'] = ['nullable', 'numeric', 'min:0', 'max:99999999'];
        }

        $dados = $request->validate($regras, [
            'nome.unique' => 'Já existe um tanque com este nome.',
        ]);
        $dados['nivel_atual'] = $tanque?->nivel_atual ?? ($dados['nivel_atual'] ?? 0);

        if ((float) $dados['nivel_atual'] > (float) $dados['capacidade']) {
            if ($tanque) {
                throw ValidationException::withMessages([
                    'capacidade' => 'A capacidade não pode ser menor que o nível atual.',
                ]);
            }
            $dados['nivel_atual'] = $dados['capacidade'];
        }

        return $dados;
    }

    private function comPercentual(Tanque $tanque): array
    {
        $percentual = $tanque->capacidade > 0
            ? round(((float) $tanque->nivel_atual / (float) $tanque->capacidade) * 100, 1)
            : 0;

        return $tanque->toArray() + [
            'percentual' => $percentual,
            'alerta' => $percentual < 20,
        ];
    }
}
