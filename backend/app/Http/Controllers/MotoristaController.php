<?php

namespace App\Http\Controllers;

use App\Models\Abastecimento;
use App\Models\Caminhao;
use App\Models\Lavagem;
use App\Models\Manutencao;
use App\Models\Motorista;
use App\Models\SolicitacaoSenha;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class MotoristaController extends Controller
{
    // MOTORISTA — CRUD, vínculo com caminhão, acesso (login CPF) e pedidos de senha.

    // MOTORISTA FORM — campos do formulário que não são colunas da tabela motoristas.
    private const NAO_SAO_DO_MOTORISTA = ['caminhao_id', 'acesso_senha', 'criar_acesso'];

    // MOTORISTA LISTA — todos, com caminhão responsável e flag tem_acesso.
    public function index(): JsonResponse
    {
        $motoristas = Motorista::with('caminhao:id,placa,modelo,motorista_id')
            ->orderBy('nome')
            ->get();

        $comAcesso = User::whereNotNull('motorista_id')->where('perfil', 'motorista')->pluck('motorista_id')->flip();

        return response()->json(
            $motoristas->map(fn ($m) => array_merge($m->toArray(), [
                'tem_acesso' => $comAcesso->has($m->id),
                // Compat: telas antigas ainda leem acesso_email; login real é o CPF.
                'acesso_email' => $comAcesso->has($m->id) ? $m->cpf : null,
            ]))
        );
    }

    // MOTORISTA CADASTRAR — cria ficha + login por CPF.
    public function store(Request $request): JsonResponse
    {
        $dados = $this->validar($request);

        // A transaction garante que, se algo falhar no meio, nada fica salvo pela metade.
        $motorista = DB::transaction(function () use ($dados) {
            $motorista = Motorista::create(Arr::except($dados, self::NAO_SAO_DO_MOTORISTA));
            $this->vincular($motorista, $dados['caminhao_id'] ?? null);
            // Todo motorista ativo ganha usuário; senha inicial = CPF (dígitos) se não informada.
            $this->garantirUsuario($motorista, $dados['acesso_senha'] ?? null, forcarSenha: true);

            return $motorista;
        });

        return response()->json($this->comAcesso($motorista->load('caminhao:id,placa,modelo,motorista_id')), 201);
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
        $senhaRedefinida = ! empty($dados['acesso_senha']);

        DB::transaction(function () use ($motorista, $dados, $senhaRedefinida, $request) {
            $motorista->update(Arr::except($dados, self::NAO_SAO_DO_MOTORISTA));

            if (array_key_exists('caminhao_id', $dados)) {
                $this->vincular($motorista, $dados['caminhao_id']);
            }

            // Mantém/cria conta; senha só muda se ADM enviar acesso_senha.
            $this->garantirUsuario(
                $motorista,
                $dados['acesso_senha'] ?? null,
                forcarSenha: $senhaRedefinida
            );

            // Redefinição pelo formulário de motoristas também encerra o “pedido de senha”.
            if ($senhaRedefinida) {
                $this->atenderPedidosSenha($motorista, $request->user());
            }
        });

        return response()->json($this->comAcesso($motorista->load('caminhao:id,placa,modelo,motorista_id')));
    }

    /**
     * ADM redefine a senha do motorista (CPF continua sendo o login).
     * Body: password + password_confirmation.
     */
    public function alterarSenha(Request $request, Motorista $motorista): JsonResponse
    {
        $dados = $request->validate([
            'password' => ['required', 'string', 'min:6', 'max:100', 'confirmed'],
        ], [
            'password.required'  => 'Informe a nova senha.',
            'password.min'       => 'A nova senha precisa ter pelo menos 6 caracteres.',
            'password.confirmed' => 'A confirmação da senha não confere.',
        ]);

        $usuario = $this->garantirUsuario($motorista, $dados['password'], forcarSenha: true);
        $usuario->tokens()->delete();
        $this->atenderPedidosSenha($motorista, $request->user());

        return response()->json([
            'message'      => 'Senha do motorista atualizada.',
            'motorista_id' => $motorista->id,
        ]);
    }

    /** Marca pedidos de “esqueci minha senha” deste motorista como atendidos. */
    private function atenderPedidosSenha(Motorista $motorista, ?User $admin): void
    {
        if (! $admin) {
            return;
        }

        SolicitacaoSenha::pendentes()
            ->where('motorista_id', $motorista->id)
            ->get()
            ->each(fn (SolicitacaoSenha $s) => $s->marcarAtendida($admin));
    }

    // GET /api/solicitacoes-senha — pedidos de “esqueci minha senha” pendentes.
    public function solicitacoesSenha(): JsonResponse
    {
        $lista = SolicitacaoSenha::pendentes()
            ->orderByDesc('updated_at')
            ->limit(50)
            ->get()
            ->map(fn (SolicitacaoSenha $s) => [
                'id'           => $s->id,
                'motorista_id' => $s->motorista_id,
                'nome'         => $s->nome,
                'cpf'          => $s->cpf,
                'atualizado_em'=> optional($s->updated_at)->timezone(config('app.timezone'))->format('d/m/Y H:i'),
            ]);

        return response()->json([
            'pendentes' => $lista->count(),
            'itens'     => $lista,
        ]);
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

    /**
     * Garante User ligado ao motorista. Login do app = CPF; e-mail interno só na tabela users.
     * Se $senha for null e forçar, usa os dígitos do CPF.
     */
    private function garantirUsuario(Motorista $motorista, ?string $senha, bool $forcarSenha): User
    {
        $email = $motorista->emailAcessoInterno();
        $usuario = User::where('motorista_id', $motorista->id)->where('perfil', 'motorista')->first();

        if (! $usuario) {
            $usuario = User::where('email', $email)->first() ?: new User(['email' => $email]);
            $usuario->perfil = 'motorista';
            $usuario->motorista_id = $motorista->id;
            $forcarSenha = true;
        }

        $usuario->name = $motorista->nome;
        $usuario->motorista_id = $motorista->id;
        $usuario->perfil = 'motorista';

        // Mantém e-mail legado se já existir; só preenche o interno quando for conta nova.
        if (! $usuario->email) {
            $usuario->email = $email;
        }

        if ($forcarSenha) {
            // User usa cast "hashed": passar a senha em texto puro.
            $usuario->password = $senha !== null && $senha !== '' ? $senha : $motorista->senhaPadrao();
            if ($usuario->exists) {
                $usuario->tokens()->delete();
            }
        }

        $usuario->save();

        return $usuario;
    }

    private function comAcesso(Motorista $motorista): array
    {
        $tem = User::where('motorista_id', $motorista->id)->where('perfil', 'motorista')->exists();

        return array_merge($motorista->toArray(), [
            'tem_acesso'   => $tem,
            'acesso_email' => $tem ? $motorista->cpf : null,
        ]);
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

    // Algoritmo oficial do CPF: os dois últimos dígitos são calculados a partir dos 9 primeiros.
    public static function cpfValido(?string $cpf): bool
    {
        $d = preg_replace('/\D/', '', (string) $cpf);
        if (strlen($d) !== 11 || preg_match('/^(\d)\1{10}$/', $d)) {
            return false; // tamanho errado ou todos os dígitos iguais
        }

        for ($t = 9; $t < 11; $t++) {
            $soma = 0;
            for ($i = 0; $i < $t; $i++) {
                $soma += (int) $d[$i] * (($t + 1) - $i);
            }
            if ((int) $d[$t] !== ((10 * $soma) % 11) % 10) {
                return false;
            }
        }

        return true;
    }

    // Regras de validação, iguais para cadastrar e para alterar.
    private function validar(Request $request, ?Motorista $motorista = null): array
    {
        // Padroniza o CPF: se vierem 11 números, grava como 000.000.000-00.
        if ($request->filled('cpf')) {
            $digitos = Motorista::cpfDigitos($request->input('cpf'));
            if (strlen($digitos) === 11) {
                $request->merge(['cpf' => Motorista::formatarCpf($digitos)]);
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

        return $request->validate([
            'nome' => ['required', 'string', 'max:255'],
            'cpf'  => [
                'required', 'string', 'regex:/^\d{3}\.\d{3}\.\d{3}-\d{2}$/',
                // Confere os dois dígitos verificadores (recusa CPFs inventados, como 111.111.111-11).
                function ($atributo, $valor, $falhar) {
                    if (! self::cpfValido($valor)) {
                        $falhar('CPF inválido. Confira os números digitados.');
                    }
                },
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
            // Opcional: ADM define/redefine a senha (login = CPF).
            'acesso_senha' => ['nullable', 'string', 'min:6', 'max:100'],
        ], [
            'cpf.unique'         => 'Já existe um motorista com este CPF.',
            'cpf.regex'          => 'CPF inválido. Use o formato 000.000.000-00.',
            'cnh.digits'         => 'A CNH deve ter 11 números.',
            'telefone.regex'     => 'Telefone inválido. Use DDD + celular, ex.: 44 98751-3965.',
            'acesso_senha.min'   => 'A senha precisa ter pelo menos 6 caracteres.',
            'caminhao_id.exists' => 'Caminhão não encontrado.',
            'required'           => 'Preencha o campo :attribute.',
        ]);
    }
}
