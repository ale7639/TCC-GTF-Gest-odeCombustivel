<?php

namespace App\Http\Controllers;

use App\Models\Abastecimento;
use App\Models\Caminhao;
use App\Models\Lavagem;
use App\Models\Manutencao;
use App\Models\Motorista;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class MotoristaController extends Controller
{
    // GET /api/motoristas — lista todos, com o caminhão pelo qual cada um é responsável.
    public function index(): JsonResponse
    {
        $motoristas = Motorista::with('caminhao:id,placa,modelo,motorista_id')
            ->orderBy('nome')
            ->get();

        // Junta o e-mail de acesso (login) de cada motorista, quando existe.
        $emails = User::whereNotNull('motorista_id')->pluck('email', 'motorista_id');

        return response()->json(
            $motoristas->map(fn ($m) => array_merge($m->toArray(), ['acesso_email' => $emails[$m->id] ?? null]))
        );
    }

    // POST /api/motoristas — cadastra um motorista (e já pode vincular a um caminhão).
    public function store(Request $request): JsonResponse
    {
        $dados = $this->validar($request);

        // A transaction garante que, se algo falhar no meio, nada fica salvo pela metade.
        $motorista = DB::transaction(function () use ($dados) {
            $motorista = Motorista::create(Arr::except($dados, 'caminhao_id'));
            $this->vincular($motorista, $dados['caminhao_id'] ?? null);

            return $motorista;
        });

        return response()->json($motorista->load('caminhao:id,placa,modelo,motorista_id'), 201);
    }

    // GET /api/motoristas/{id} — um motorista só.
    public function show(Motorista $motorista): JsonResponse
    {
        return response()->json($motorista->load('caminhao:id,placa,modelo,motorista_id'));
    }

    // PUT /api/motoristas/{id} — altera os dados e, se o campo caminhao_id vier, o vínculo.
    public function update(Request $request, Motorista $motorista): JsonResponse
    {
        $dados = $this->validar($request, $motorista);

        DB::transaction(function () use ($motorista, $dados) {
            $motorista->update(Arr::except($dados, 'caminhao_id'));

            if (array_key_exists('caminhao_id', $dados)) {
                $this->vincular($motorista, $dados['caminhao_id']);
            }
        });

        return response()->json($motorista->load('caminhao:id,placa,modelo,motorista_id'));
    }

    // DELETE /api/motoristas/{id} — exclui, mas só se não houver histórico.
    public function destroy(Motorista $motorista): JsonResponse
    {
        $temHistorico = Abastecimento::where('motorista_id', $motorista->id)->exists()
            || Lavagem::where('motorista_id', $motorista->id)->exists()
            || Manutencao::where('motorista_id', $motorista->id)->exists();

        if ($temHistorico) {
            return response()->json([
                'message' => 'Este motorista tem histórico de abastecimentos, lavagens ou manutenções. Marque como inativo em vez de excluir.',
            ], 409);
        }

        // O login do motorista (se houver) é apagado junto, com as sessões abertas.
        User::where('motorista_id', $motorista->id)->get()->each(function ($usuario) {
            $usuario->tokens()->delete();
            $usuario->delete();
        });

        // O caminhão dele (se houver) fica sem motorista automaticamente (nullOnDelete da migration).
        $motorista->delete();

        return response()->json(['message' => 'Motorista excluído.']);
    }

    // PUT /api/motoristas/{id}/acesso — o admin cria ou altera o e-mail e a senha de login do motorista.
    // Ao criar, a senha é obrigatória. Ao alterar, deixar a senha em branco mantém a atual.
    public function definirAcesso(Request $request, Motorista $motorista): JsonResponse
    {
        $usuario = User::where('motorista_id', $motorista->id)->first();

        $dados = $request->validate([
            'email'    => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($usuario?->id)],
            'password' => [$usuario ? 'nullable' : 'required', 'string', 'min:6', 'max:100'],
        ], [
            'email.unique'      => 'Este e-mail já está em uso.',
            'email.email'       => 'E-mail inválido.',
            'password.required' => 'Defina uma senha para criar o acesso.',
            'password.min'      => 'A senha precisa ter pelo menos 6 caracteres.',
            'required'          => 'Preencha o campo :attribute.',
        ], [
            'password' => 'senha',
        ]);

        DB::transaction(function () use ($usuario, $motorista, $dados) {
            if (! $usuario) {
                User::forceCreate([
                    'name'         => $motorista->nome,
                    'email'        => $dados['email'],
                    'password'     => Hash::make($dados['password']),
                    'perfil'       => 'motorista',
                    'motorista_id' => $motorista->id,
                ]);

                return;
            }

            $usuario->forceFill(['email' => $dados['email'], 'name' => $motorista->nome]);

            // Trocou a senha: derruba as sessões abertas, para valer a senha nova.
            if (! empty($dados['password'])) {
                $usuario->forceFill(['password' => Hash::make($dados['password'])]);
                $usuario->tokens()->delete();
            }

            $usuario->save();
        });

        return response()->json(['message' => $usuario ? 'Acesso atualizado.' : 'Acesso criado.', 'acesso_email' => $dados['email']]);
    }

    // DELETE /api/motoristas/{id}/acesso — remove o login (o cadastro do motorista continua).
    public function removerAcesso(Motorista $motorista): JsonResponse
    {
        User::where('motorista_id', $motorista->id)->get()->each(function ($usuario) {
            $usuario->tokens()->delete();
            $usuario->delete();
        });

        return response()->json(['message' => 'Acesso removido.']);
    }

    // Define qual caminhão o motorista conduz: solta o anterior e prende o novo (ou nenhum).
    private function vincular(Motorista $motorista, ?int $caminhaoId): void
    {
        Caminhao::where('motorista_id', $motorista->id)->update(['motorista_id' => null]);

        if ($caminhaoId) {
            Caminhao::whereKey($caminhaoId)->update(['motorista_id' => $motorista->id]);
        }
    }

    // Regras de validação, iguais para cadastrar e para alterar.
    private function validar(Request $request, ?Motorista $motorista = null): array
    {
        // Padroniza o CPF: se vierem 11 números, grava como 000.000.000-00.
        if ($request->filled('cpf')) {
            $digitos = preg_replace('/\D/', '', $request->input('cpf'));
            if (strlen($digitos) === 11) {
                $request->merge([
                    'cpf' => substr($digitos, 0, 3) . '.' . substr($digitos, 3, 3) . '.'
                        . substr($digitos, 6, 3) . '-' . substr($digitos, 9, 2),
                ]);
            }
        }

        return $request->validate([
            'nome' => ['required', 'string', 'max:255'],
            'cpf'  => [
                'required', 'string', 'regex:/^\d{3}\.\d{3}\.\d{3}-\d{2}$/',
                Rule::unique('motoristas', 'cpf')->ignore($motorista?->id),
            ],
            'cnh'      => ['required', 'string', 'max:20'],
            'telefone' => ['nullable', 'string', 'max:20'],
            'ativo'    => ['required', 'boolean'],
            'caminhao_id' => [
                'nullable', 'integer', 'exists:caminhoes,id',
                // Recusa um caminhão que já pertence a outro motorista.
                function ($atributo, $valor, $falhar) use ($motorista) {
                    $dono = Caminhao::whereKey($valor)->value('motorista_id');

                    if ($dono && (int) $dono !== (int) $motorista?->id) {
                        $falhar('Este caminhão já tem outro motorista responsável.');
                    }
                },
            ],
        ], [
            'cpf.unique'         => 'Já existe um motorista com este CPF.',
            'cpf.regex'          => 'CPF inválido. Informe os 11 números.',
            'caminhao_id.exists' => 'Caminhão não encontrado.',
            'required'           => 'Preencha o campo :attribute.',
        ]);
    }
}