<?php

namespace App\Http\Controllers;

use App\Models\Tanque;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TanqueController extends Controller
{
    // Tipos de combustível aceitos (lista fechada: evita "teste" ou erro de digitação).
    // GNV fica de fora: é gás, medido em m³, não fica num tanque de líquido.
    // A tela Tanques.js mostra exatamente esta mesma lista como botões.
    public const TIPOS_COMBUSTIVEL = ['Diesel S10', 'Diesel S500', 'Gasolina comum', 'Gasolina aditivada', 'Etanol'];

    // GET /api/tanques — lista os tanques da empresa (o principal primeiro).
    public function index(): JsonResponse
    {
        return response()->json(Tanque::orderByDesc('principal')->orderBy('nome')->get());
    }

    // POST /api/tanques — cadastra um tanque novo, com o nível inicial informado (ou zero).
    public function store(Request $request): JsonResponse
    {
        $dados = $this->validar($request);
        $nivel = (float) ($dados['nivel_atual'] ?? 0);

        if ($nivel > (float) $dados['capacidade']) {
            throw ValidationException::withMessages([
                'nivel_atual' => 'O nível inicial não pode passar da capacidade.',
            ]);
        }

        $tanque = DB::transaction(function () use ($dados, $nivel) {
            $principal = (bool) ($dados['principal'] ?? false);

            // Só pode existir um tanque principal: ao marcar este, os outros deixam de ser.
            if ($principal) {
                Tanque::where('principal', true)->update(['principal' => false]);
            }

            return Tanque::create([
                'nome'             => $dados['nome'],
                'tipo_combustivel' => $dados['tipo_combustivel'],
                'capacidade'       => $dados['capacidade'],
                'nivel_atual'      => $nivel,
                // Valor do combustível que já está no tanque: litros × custo por litro informado.
                'valor_estoque'    => round($nivel * (float) ($dados['custo_litro_inicial'] ?? 0), 4),
                'principal'        => $principal,
            ]);
        });

        return response()->json($tanque, 201);
    }

    // GET /api/tanques/{id} — um tanque só.
    public function show(Tanque $tanque): JsonResponse
    {
        return response()->json($tanque);
    }

    // PUT /api/tanques/{id} — altera nome, tipo, capacidade e se é o principal.
    // O nível NÃO é alterado aqui: ele muda com as entradas de combustível e os abastecimentos.
    public function update(Request $request, Tanque $tanque): JsonResponse
    {
        $dados = $this->validar($request, $tanque);

        if ((float) $dados['capacidade'] < (float) $tanque->nivel_atual) {
            throw ValidationException::withMessages([
                'capacidade' => 'A capacidade não pode ser menor que o nível atual (' . (float) $tanque->nivel_atual . ' L).',
            ]);
        }

        DB::transaction(function () use ($dados, $tanque) {
            if (! empty($dados['principal'])) {
                Tanque::where('id', '!=', $tanque->id)->where('principal', true)->update(['principal' => false]);
            }

            $tanque->update(Arr::only($dados, ['nome', 'tipo_combustivel', 'capacidade', 'principal']));
        });

        return response()->json($tanque->refresh());
    }

    // DELETE /api/tanques/{id} — exclui, mas só se nunca foi usado.
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

    // Regras de validação, iguais para cadastrar e para alterar.
    private function validar(Request $request, ?Tanque $tanque = null): array
    {
        return $request->validate([
            'nome' => [
                'required', 'string', 'max:255',
                Rule::unique('tanques', 'nome')->ignore($tanque?->id),
            ],
            // Rule::in = só aceita um dos valores da lista TIPOS_COMBUSTIVEL (no topo da classe).
            'tipo_combustivel' => ['required', Rule::in(self::TIPOS_COMBUSTIVEL)],
            // Capacidade é um número INTEIRO de litros, numa faixa realista de tanque de base.
            // (O nível pode ter casas decimais, porque é medido; a capacidade não.)
            'capacidade'       => ['required', 'integer', 'between:100,100000'],
            'nivel_atual'      => ['nullable', 'numeric', 'min:0', 'max:99999999'],
            'principal'        => ['nullable', 'boolean'],
            'custo_litro_inicial' => ['nullable', 'numeric', 'min:0', 'max:99999'],
        ], [
            'nome.unique' => 'Já existe um tanque com este nome.',
            'tipo_combustivel.in' => 'Escolha um tipo de combustível da lista.',
            'capacidade.integer'  => 'A capacidade deve ser um número inteiro de litros (sem vírgula).',
            'capacidade.between'  => 'A capacidade deve ficar entre 100 e 100.000 litros.',
            'required'    => 'Preencha o campo :attribute.',
        ], [
            'tipo_combustivel' => 'tipo de combustível',
            'nivel_atual'      => 'nível inicial',
            'custo_litro_inicial' => 'custo do nível inicial',
        ]);
    }
}