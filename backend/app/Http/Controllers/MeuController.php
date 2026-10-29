<?php

namespace App\Http\Controllers;

use App\Models\Abastecimento;
use App\Models\Caminhao;
use App\Models\Lavagem;
use App\Models\Manutencao;
use App\Models\Tanque;
use App\Support\Lancamentos;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

// Tudo que o MOTORISTA pode fazer. O caminhão e o motorista vêm sempre do login (token),
// nunca do que o aplicativo envia: assim ninguém consegue lançar algo em nome de outro caminhão.
class MeuController extends Controller
{
    private function caminhaoDe($motorista): Caminhao
    {
        $caminhao = Caminhao::where('motorista_id', $motorista->id)->first();

        if (! $caminhao) {
            throw ValidationException::withMessages(['caminhao' => 'Você não tem caminhão vinculado. Fale com o administrador.']);
        }
        if ($caminhao->status !== 'ativo') {
            throw ValidationException::withMessages(['caminhao' => 'Seu caminhão não está ativo no momento.']);
        }

        return $caminhao;
    }

    // GET /api/meu/painel — o caminhão do motorista e o histórico dos lançamentos dele.
    public function painel(Request $request): JsonResponse
    {
        $motorista = $request->attributes->get('motorista');
        $caminhao  = Caminhao::where('motorista_id', $motorista->id)->first();
        $mapas     = Lancamentos::mapas();

        $historico = collect();
        foreach (Lancamentos::TIPOS as $tipo) {
            Lancamentos::modelo($tipo)::where('motorista_id', $motorista->id)
                ->orderByDesc('id')->limit(30)->get()
                ->each(fn ($m) => $historico->push(Lancamentos::apresentar($tipo, $m, $mapas)));
        }

        return response()->json([
            'motorista' => ['id' => $motorista->id, 'nome' => $motorista->nome],
            'caminhao'  => $caminhao ? [
                'id'                => $caminhao->id,
                'placa'             => $caminhao->placa,
                'modelo'            => $caminhao->modelo,
                'km_atual'          => $caminhao->km_atual,
                'capacidade_tanque' => (float) $caminhao->capacidade_tanque,
                'status'            => $caminhao->status,
            ] : null,
            'historico' => $historico->sortByDesc('ordem')->take(40)->values(),
        ]);
    }

    // GET /api/meu/tanques — só nome e combustível (o motorista não vê níveis nem custos).
    public function tanques(): JsonResponse
    {
        return response()->json(
            Tanque::orderByDesc('principal')->orderBy('nome')->get(['id', 'nome', 'tipo_combustivel', 'principal'])
        );
    }

    // POST /api/meu/abastecimentos — na base (sai de um tanque) ou fora da base (posto, com valor e nota).
    // Fica PENDENTE: o tanque e o caminhão só são atualizados quando o admin aprova.
    public function abastecer(Request $request): JsonResponse
    {
        $motorista = $request->attributes->get('motorista');
        $caminhao  = $this->caminhaoDe($motorista);

        $dados = $request->validate([
            'origem'      => ['required', Rule::in(['base', 'externo'])],
            'data'        => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'litros'      => ['required', 'numeric', 'min:1', 'max:99999'],
            'km'          => ['required', 'integer', 'min:0'],
            'tanque_id'   => ['required_if:origem,base', 'nullable', 'integer', 'exists:tanques,id'],
            'posto'       => ['required_if:origem,externo', 'nullable', 'string', 'max:120'],
            'valor_total' => ['required_if:origem,externo', 'nullable', 'numeric', 'min:0.01', 'max:9999999'],
            'nota_numero' => ['nullable', 'string', 'max:30'],
            'foto'        => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ], [
            'required'             => 'Preencha o campo :attribute.',
            'required_if'          => 'Preencha o campo :attribute.',
            'data.before_or_equal' => 'A data não pode ser futura.',
            'litros.min'           => 'Informe pelo menos 1 litro.',
            'foto.image'           => 'O arquivo precisa ser uma imagem.',
            'foto.max'             => 'A foto pode ter no máximo 5 MB.',
        ], [
            'tanque_id'   => 'tanque',
            'valor_total' => 'valor total',
            'nota_numero' => 'número da nota',
            'km'          => 'quilometragem',
        ]);

        if ((float) $dados['litros'] > (float) $caminhao->capacidade_tanque) {
            throw ValidationException::withMessages([
                'litros' => 'O tanque do seu caminhão comporta no máximo ' . (float) $caminhao->capacidade_tanque . ' L.',
            ]);
        }
        if ((int) $dados['km'] < $caminhao->km_atual) {
            throw ValidationException::withMessages([
                'km' => 'A quilometragem não pode ser menor que a atual (' . $caminhao->km_atual . ' km).',
            ]);
        }

        $externo = $dados['origem'] === 'externo';

        Abastecimento::create([
            'caminhao_id'  => $caminhao->id,
            'motorista_id' => $motorista->id,
            'tanque_id'    => $externo ? null : $dados['tanque_id'],
            'data'         => $dados['data'],
            'litros'       => $dados['litros'],
            'km'           => $dados['km'],
            'origem'       => $dados['origem'],
            'posto'        => $externo ? $dados['posto'] : null,
            'nota_numero'  => $externo ? ($dados['nota_numero'] ?? null) : null,
            'valor_total'  => $externo ? $dados['valor_total'] : null,
            'foto'         => ($externo && $request->hasFile('foto'))
                ? $request->file('foto')->store('abastecimentos', 'local')
                : null,
            'status'       => 'pendente',
        ]);

        return response()->json(['message' => 'Abastecimento enviado. Aguardando aprovação do administrador.'], 201);
    }

    // POST /api/meu/lavagens
    public function lavar(Request $request): JsonResponse
    {
        $motorista = $request->attributes->get('motorista');
        $caminhao  = $this->caminhaoDe($motorista);

        $dados = $request->validate([
            'data'       => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'valor'      => ['required', 'numeric', 'min:0', 'max:999999'],
            'observacao' => ['nullable', 'string', 'max:255'],
        ], [
            'required'             => 'Preencha o campo :attribute.',
            'data.before_or_equal' => 'A data não pode ser futura.',
        ]);

        // forceCreate grava todos os campos informados, sem depender da lista "fillable" do model.
        Lavagem::forceCreate([
            'caminhao_id'  => $caminhao->id,
            'motorista_id' => $motorista->id,
            'data'         => $dados['data'],
            'valor'        => $dados['valor'],
            'observacao'   => $dados['observacao'] ?? null,
            'status'       => 'pendente',
        ]);

        return response()->json(['message' => 'Lavagem enviada. Aguardando aprovação do administrador.'], 201);
    }

    // POST /api/meu/manutencoes
    public function manter(Request $request): JsonResponse
    {
        $motorista = $request->attributes->get('motorista');
        $caminhao  = $this->caminhaoDe($motorista);

        $dados = $request->validate([
            'data'      => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'tipo'      => ['required', 'string', 'max:255'],
            'descricao' => ['nullable', 'string', 'max:1000'],
            'valor'     => ['required', 'numeric', 'min:0', 'max:9999999'],
            'km'        => ['required', 'integer', 'min:0'],
        ], [
            'required'             => 'Preencha o campo :attribute.',
            'data.before_or_equal' => 'A data não pode ser futura.',
        ], [
            'descricao' => 'descrição',
            'km'        => 'quilometragem',
        ]);

        Manutencao::forceCreate([
            'caminhao_id'  => $caminhao->id,
            'motorista_id' => $motorista->id,
            'data'         => $dados['data'],
            'tipo'         => $dados['tipo'],
            'descricao'    => $dados['descricao'] ?? null,
            'valor'        => $dados['valor'],
            'km'           => $dados['km'],
            'status'       => 'pendente',
        ]);

        return response()->json(['message' => 'Manutenção enviada. Aguardando aprovação do administrador.'], 201);
    }
}