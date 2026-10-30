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
    // Campos do formulário que não são colunas da tabela motoristas.
    private const NAO_SAO_DO_MOTORISTA = ['caminhao_id', 'acesso_email', 'acesso_senha'];

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
            $motorista = Motorista::create(Arr::except($dados, self::NAO_SAO_DO_MOTORISTA));
            $this->vincular($motorista, $dados['caminhao_id'] ?? null);
            $this->salvarAcesso($motorista, $dados);

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
            $motorista->update(Arr::except($dados, self::NAO_SAO_DO_MOTORISTA));

            if (array_key_exists('caminhao_id', $dados)) {
                $this->vincular($motorista, $dados['caminhao_id']);
            }

            $this->salvarAcesso($motorista, $dados);
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

    // Cria ou atualiza o login do motorista com o e-mail e a senha vindos do formulário.
    // E-mail em branco = não mexe no acesso. Senha em branco numa edição = mantém a atual.
    private function salvarAcesso(Motorista $motorista, array $dados): void
    {
        $usuario = User::where('motorista_id', $motorista->id)->first();
        $email   = $dados['acesso_email'] ?? null;
        $senha   = $dados['acesso_senha'] ?? null;

        if (! $email) {
            // Mantém o nome do login igual ao do cadastro.
            $usuario?->forceFill(['name' => $motorista->nome])->save();

            return;
        }

        if (! $usuario) {
            User::forceCreate([
                'name'         => $motorista->nome,
                'email'        => $email,
                'password'     => Hash::make($senha),
                'perfil'       => 'motorista',
                'motorista_id' => $motorista->id,
            ]);

            return;
        }

        $usuario->forceFill(['email' => $email, 'name' => $motorista->nome]);

        // Trocou a senha: derruba as sessões abertas, para valer a senha nova.
        if ($senha) {
            $usuario->forceFill(['password' => Hash::make($senha)]);
            $usuario->tokens()->delete();
        }

        $usuario->save();
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

        // Telefone (celular com WhatsApp): grava como "44 98751-3965".
        if ($request->filled('telefone')) {
            $d = preg_replace('/\D/', '', $request->input('telefone'));
            if (strlen($d) === 11) {
                $request->merge(['telefone' => substr($d, 0, 2) . ' ' . substr($d, 2, 5) . '-' . substr($d, 7, 4)]);
            }
        }

        // CNH: guarda só os números (o número de registro da CNH tem 11 dígitos).
        if ($request->filled('cnh')) {
            $request->merge(['cnh' => preg_replace('/\D/', '', $request->input('cnh'))]);
        }

        // Login atual deste motorista (para não acusar "e-mail em uso" com o e-mail dele mesmo).
        $usuario = $motorista ? User::where('motorista_id', $motorista->id)->first() : null;

        return $request->validate([
            'nome' => ['required', 'string', 'max:255'],
            'cpf'  => [
                'required', 'string', 'regex:/^\d{3}\.\d{3}\.\d{3}-\d{2}$/',
                Rule::unique('motoristas', 'cpf')->ignore($motorista?->id),
            ],
            'cnh'      => ['required', 'digits:11'],
            'telefone' => ['required', 'regex:/^\d{2} 9\d{4}-\d{4}$/'],
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
            'acesso_email' => [
                'nullable', 'email', 'max:255',
                Rule::unique('users', 'email')->ignore($usuario?->id),
            ],
            // Senha obrigatória só quando o login está sendo criado agora.
            'acesso_senha' => [
                'nullable', 'string', 'min:6', 'max:100',
                Rule::requiredIf(fn () => $request->filled('acesso_email') && ! $usuario),
            ],
        ], [
            'cpf.unique'         => 'Já existe um motorista com este CPF.',
            'cpf.regex'          => 'CPF inválido. Use o formato 000.000.000-00.',
            'cnh.digits'         => 'A CNH deve ter 11 números.',
            'telefone.regex'     => 'Telefone inválido. Use DDD + celular, ex.: 44 98751-3965.',
            'acesso_email.email' => 'E-mail de acesso inválido.',
            'acesso_email.unique'=> 'Este e-mail de acesso já está em uso.',
            'acesso_senha.required' => 'Defina uma senha para criar o acesso do motorista.',
            'acesso_senha.min'   => 'A senha precisa ter pelo menos 6 caracteres.',
            'caminhao_id.exists' => 'Caminhão não encontrado.',
            'required'           => 'Preencha o campo :attribute.',
        ]);
    }
}