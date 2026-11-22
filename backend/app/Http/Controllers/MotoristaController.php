<?php

// =====================================================================================
// MotoristaController — CRUD de motoristas + o ACESSO deles ao app.
//
// Rotas (routes/api.php, grupo do admin):
//   GET    /api/motoristas               -> index()         lista (com o caminhão de cada um)
//   POST   /api/motoristas               -> store()         cadastra
//   GET    /api/motoristas/{id}          -> show()
//   PUT    /api/motoristas/{id}          -> update()        altera
//   DELETE /api/motoristas/{id}          -> destroy()       exclui (só sem histórico)
//   DELETE /api/motoristas/{id}/acesso   -> removerAcesso() tira o login, mantém o cadastro
//
// Duas tabelas envolvidas:
//   motoristas = os dados da pessoa (nome, CPF, CNH, telefone, ativo);
//   users      = o LOGIN dela (senha), ligado por users.motorista_id, com perfil 'motorista'.
// O motorista entra no app com o CPF e a senha que o ADMIN definiu (acesso_senha).
// =====================================================================================

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
use Illuminate\Support\Arr;                // Arr::except = copia um array tirando algumas chaves
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;       // Hash::make = transforma a senha em hash (bcrypt)
use Illuminate\Validation\Rule;

class MotoristaController extends Controller
{
    // Campos do formulário que não são colunas da tabela motoristas.
    // (caminhao_id vai para a tabela caminhoes; acesso_senha vai para a tabela users.)
    private const NAO_SAO_DO_MOTORISTA = ['caminhao_id', 'acesso_senha'];

    // MOTORISTA FORM — campos do formulário que não são colunas da tabela motoristas.
    private const NAO_SAO_DO_MOTORISTA = ['caminhao_id', 'acesso_senha', 'criar_acesso'];

    // MOTORISTA LISTA — todos, com caminhão responsável e flag tem_acesso.
    public function index(): JsonResponse
    {
        $motoristas = Motorista::with('caminhao:id,placa,modelo,motorista_id')
            ->orderBy('nome')
            ->get();

        // Quais motoristas já têm acesso ao app (login pelo CPF).
        // pluck + all = lista simples de ids, ex.: [3, 5, 8].
        $comAcesso = User::whereNotNull('motorista_id')->pluck('motorista_id')->all();

        // array_merge acrescenta o campo "tem_acesso" (true/false) em cada motorista.
        return response()->json(
            $motoristas->map(fn ($m) => array_merge($m->toArray(), ['tem_acesso' => in_array($m->id, $comAcesso)]))
        );
    }

    // MOTORISTA CADASTRAR — cria ficha + login por CPF.
    public function store(Request $request): JsonResponse
    {
        $dados = $this->validar($request);

        // A transaction garante que, se algo falhar no meio, nada fica salvo pela metade.
        // São até 3 gravações: o motorista, o vínculo com o caminhão e o login.
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

            // array_key_exists = o campo veio na requisição (mesmo que null, que significa "sem caminhão").
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

        // 409 = conflito: excluir apagaria a referência dos lançamentos dele.
        if ($temHistorico) {
            return response()->json([
                'message' => 'Este motorista tem histórico de abastecimentos, lavagens ou manutenções. Marque como inativo em vez de excluir.',
            ], 409);
        }

        // O login do motorista (se houver) é apagado junto, com as sessões abertas.
        // tokens()->delete() = apaga os tokens do Sanctum (desloga de todos os aparelhos).
        User::where('motorista_id', $motorista->id)->get()->each(function ($usuario) {
            $usuario->tokens()->delete();
            $usuario->delete();
        });

        // O caminhão dele (se houver) fica sem motorista automaticamente (nullOnDelete da migration).
        $motorista->delete();

        return response()->json(['message' => 'Motorista excluído.']);
    }

    // Acesso do motorista ao app: ele entra com o CPF do cadastro e a senha definida pelo admin.
    // Senha preenchida = cria o acesso (se ainda não existe) ou troca a senha.
    // Senha em branco = não mexe no acesso.
    private function salvarAcesso(Motorista $motorista, array $dados): void
    {
        $usuario = User::where('motorista_id', $motorista->id)->first();
        $senha   = $dados['acesso_senha'] ?? null;

        if (! $senha) {
            // Mantém o nome do login igual ao do cadastro.
            // "?->" = se não houver login ($usuario null), não faz nada.
            $usuario?->forceFill(['name' => $motorista->nome])->save();

            return;
        }

        if (! $usuario) {
            // forceCreate porque perfil e motorista_id não estão no fillable do User (proteção).
            User::forceCreate([
                'name'         => $motorista->nome,
                'email'        => null, // o motorista não usa e-mail: entra pelo CPF
                'password'     => Hash::make($senha),   // guarda o HASH, nunca a senha em texto
                'perfil'       => 'motorista',
                'motorista_id' => $motorista->id,
            ]);

            return;
        }

        // Trocou a senha: derruba as sessões abertas, para valer a senha nova.
        $usuario->forceFill(['name' => $motorista->nome, 'password' => Hash::make($senha)])->save();
        $usuario->tokens()->delete();
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
        // 1) Qualquer caminhão que estava com ele fica sem motorista.
        Caminhao::where('motorista_id', $motorista->id)->update(['motorista_id' => null]);

        // 2) O caminhão escolhido passa a ser dele.
        if ($caminhaoId) {
            Caminhao::whereKey($caminhaoId)->update(['motorista_id' => $motorista->id]);
        }
    }

    // Algoritmo oficial do CPF: os dois últimos dígitos são calculados a partir dos 9 primeiros.
    // "public static" = pode ser usado sem criar o controller (MotoristaController::cpfValido(...)).
    public static function cpfValido(?string $cpf): bool
    {
        $d = preg_replace('/\D/', '', (string) $cpf);   // só os números
        // (\d)\1{10} = um dígito repetido 11 vezes (111.111.111-11): a conta "fecha", mas não é CPF real.
        if (strlen($d) !== 11 || preg_match('/^(\d)\1{10}$/', $d)) {
            return false; // tamanho errado ou todos os dígitos iguais
        }

        // $t = 9 confere o 1º dígito verificador (posição 9); $t = 10 confere o 2º (posição 10).
        // Cada dígito é multiplicado por um peso decrescente (10, 9, 8... ou 11, 10, 9...),
        // soma tudo, e o resto da divisão por 11 dá o dígito esperado.
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
                // regex = formato 000.000.000-00 (o merge acima já deixou assim).
                'required', 'string', 'regex:/^\d{3}\.\d{3}\.\d{3}-\d{2}$/',
                // Confere os dois dígitos verificadores (recusa CPFs inventados, como 111.111.111-11).
                function ($atributo, $valor, $falhar) {
                    if (! self::cpfValido($valor)) {
                        $falhar('CPF inválido. Confira os números digitados.');
                    }
                },
                // CPF único, ignorando o próprio motorista na alteração.
                Rule::unique('motoristas', 'cpf')->ignore($motorista?->id),
            ],
            'cnh'      => ['required', 'digits:11'],
            // DDD (2 números) + espaço + celular começando com 9.
            'telefone' => ['required', 'regex:/^\d{2} 9\d{4}-\d{4}$/'],
            'ativo'    => ['required', 'boolean'],
            'caminhao_id' => [
                'nullable', 'integer', 'exists:caminhoes,id',
                // Recusa um caminhão que já pertence a outro motorista.
                // "use ($motorista)" = deixa a função enxergar a variável $motorista de fora.
                function ($atributo, $valor, $falhar) use ($motorista) {
                    $dono = Caminhao::whereKey($valor)->value('motorista_id');

                    if ($dono && (int) $dono !== (int) $motorista?->id) {
                        $falhar('Este caminhão já tem outro motorista responsável.');
                    }
                },
            ],
            // Senha de acesso do motorista ao app (opcional).
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
