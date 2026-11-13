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
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

// MEU / MOTORISTA — só o que o motorista logado pode fazer.
// Caminhão e motorista vêm do token; o app não escolhe em nome de outro.
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

    // MEU PAINEL — caminhão do motorista + histórico dos lançamentos.
    public function painel(Request $request): JsonResponse
    {
        $motorista = $request->attributes->get('motorista');
        $caminhao  = Caminhao::where('motorista_id', $motorista->id)->first();
        $mapas     = Lancamentos::mapas();
        $filtro    = $request->query('tipo'); // abastecimento|lavagem|manutencao|null

        $tipos = Lancamentos::TIPOS;
        if (in_array($filtro, $tipos, true)) {
            $tipos = [$filtro];
        }

        $historico = collect();
        foreach ($tipos as $tipo) {
            Lancamentos::modelo($tipo)::where('motorista_id', $motorista->id)
                ->orderByDesc('id')->limit(30)->get()
                ->each(fn ($m) => $historico->push(Lancamentos::apresentar($tipo, $m, $mapas)));
        }

        return response()->json([
            'motorista' => $this->dadosMotorista($motorista),
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

    // GET /api/meu/perfil — dados do próprio motorista (não de outro).
    public function perfil(Request $request): JsonResponse
    {
        $motorista = $request->attributes->get('motorista');
        $caminhao  = Caminhao::where('motorista_id', $motorista->id)->first();

        return response()->json([
            'motorista' => $this->dadosMotorista($motorista),
            'caminhao'  => $caminhao ? [
                'id'     => $caminhao->id,
                'placa'  => $caminhao->placa,
                'modelo' => $caminhao->modelo,
                'status' => $caminhao->status,
            ] : null,
        ]);
    }

    // PUT /api/meu/perfil — motorista altera o próprio telefone.
    public function atualizarPerfil(Request $request): JsonResponse
    {
        $motorista = $request->attributes->get('motorista');

        if ($request->filled('telefone')) {
            $d = preg_replace('/\D/', '', $request->input('telefone'));
            if (strlen($d) === 11) {
                $request->merge(['telefone' => substr($d, 0, 2).' '.substr($d, 2, 5).'-'.substr($d, 7, 4)]);
            }
        }

        $dados = $request->validate([
            'telefone' => ['required', 'regex:/^\d{2} 9\d{4}-\d{4}$/'],
        ], [
            'telefone.regex' => 'Telefone inválido. Use DDD + celular, ex.: 44 98751-3965.',
            'required'       => 'Preencha o campo :attribute.',
        ]);

        $motorista->update(['telefone' => $dados['telefone']]);

        return response()->json([
            'message'   => 'Telefone atualizado.',
            'motorista' => $this->dadosMotorista($motorista->fresh()),
        ]);
    }

    // PUT /api/meu/senha — motorista troca a própria senha (precisa da atual).
    public function alterarSenha(Request $request): JsonResponse
    {
        $usuario = $request->user();
        $dados = $request->validate([
            'senha_atual' => ['required', 'string'],
            'password'    => ['required', 'string', 'min:6', 'max:100', 'confirmed'],
        ], [
            'password.min'       => 'A nova senha precisa ter pelo menos 6 caracteres.',
            'password.confirmed' => 'A confirmação da senha não confere.',
            'required'           => 'Preencha o campo :attribute.',
        ]);

        if (! Hash::check($dados['senha_atual'], $usuario->password)) {
            throw ValidationException::withMessages([
                'senha_atual' => 'A senha atual está incorreta.',
            ]);
        }

        $usuario->password = $dados['password'];
        $usuario->save();
        $usuario->tokens()->where('id', '!=', $usuario->currentAccessToken()->id)->delete();

        return response()->json(['message' => 'Senha atualizada.']);
    }

    private function dadosMotorista($motorista): array
    {
        return [
            'id'       => $motorista->id,
            'nome'     => $motorista->nome,
            'cpf'      => $motorista->cpf,
            'cnh'      => $motorista->cnh,
            'telefone' => $motorista->telefone,
            'ativo'    => (bool) $motorista->ativo,
        ];
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
    // MEU ABASTECER — lançamento do motorista (pode ficar pendente de aprovação).
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

    // POST /api/meu/lavagens — registrada direto (sem aprovação).
    public function lavar(Request $request): JsonResponse
    {
        $motorista = $request->attributes->get('motorista');
        $caminhao  = $this->caminhaoDe($motorista);

        // Lavagem é feita na própria empresa: sem custo, só a data (observação é opcional).
        $dados = $request->validate([
            'data'       => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
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
            'valor'        => null,
            'observacao'   => $dados['observacao'] ?? null,
            'status'       => 'aprovado', // lavagem não mexe em estoque: vale na hora, sem aprovação
        ]);

        return response()->json(['message' => 'Lavagem registrada.'], 201);
    }

    // POST /api/meu/manutencoes — registrada direto (sem aprovação).
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

        // Manutenção vale na hora (sem aprovação) e atualiza o km do caminhão, se for maior.
        Manutencao::forceCreate([
            'caminhao_id'  => $caminhao->id,
            'motorista_id' => $motorista->id,
            'data'         => $dados['data'],
            'tipo'         => $dados['tipo'],
            'descricao'    => $dados['descricao'] ?? null,
            'valor'        => $dados['valor'],
            'km'           => $dados['km'],
            'status'       => 'aprovado',
        ]);
        $caminhao->update(['km_atual' => max((int) $caminhao->km_atual, (int) $dados['km'])]);

        return response()->json(['message' => 'Manutenção registrada.'], 201);
    }
}