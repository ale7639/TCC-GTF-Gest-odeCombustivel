<?php

namespace App\Http\Controllers;

use App\Models\Abastecimento;
use App\Models\Caminhao;
use App\Models\Lavagem;
use App\Models\Manutencao;
use App\Models\Motorista;
use App\Models\SolicitacaoSenha;
use App\Models\User;
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
            $this->garantirUsuarioComSenhaCpf($motorista, forcarSenha: true);

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

            // Mantém conta de acesso; não redefine senha no edit.
            $this->garantirUsuarioComSenhaCpf($motorista, forcarSenha: false);
        });

        Auditoria::registrar('motorista.editar', $motorista);

        return response()->json($motorista->load('caminhao:id,placa,modelo,motorista_id'));
    }

    /**
     * ADM redefine a senha do motorista sem ver a senha atual.
     * Body: password + password_confirmation.
     */
    public function alterarSenha(Request $request, Motorista $motorista): JsonResponse
    {
        $dados = $request->validate([
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ], [
            'password.min' => 'A nova senha precisa ter pelo menos 8 caracteres.',
            'password.confirmed' => 'A confirmação da senha não confere.',
        ]);

        $usuario = User::where('motorista_id', $motorista->id)
            ->where('role', User::MOTORISTA)
            ->first();

        if (! $usuario) {
            $usuario = $this->garantirUsuarioComSenhaCpf($motorista, forcarSenha: false);
        }

        $usuario->password = $dados['password'];
        $usuario->is_active = true;
        $usuario->save();

        SolicitacaoSenha::pendentes()
            ->where('motorista_id', $motorista->id)
            ->get()
            ->each(fn (SolicitacaoSenha $s) => $s->marcarAtendida($request->user()));

        Auditoria::registrar('motorista.senha', $motorista, [
            'user_id' => $usuario->id,
            'por' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Senha do motorista atualizada.',
            'motorista_id' => $motorista->id,
        ]);
    }

    public function destroy(Motorista $motorista): JsonResponse
    {
        $temHistorico = Abastecimento::where('motorista_id', $motorista->id)->exists()
            || Lavagem::where('motorista_id', $motorista->id)->exists()
            || Manutencao::where('motorista_id', $motorista->id)->exists();

        if ($temHistorico) {
            $motorista->update(['ativo' => false]);
            User::where('motorista_id', $motorista->id)->update(['is_active' => false]);
            Auditoria::registrar('motorista.desativar', $motorista);

            return response()->json([
                'message' => 'Este motorista tem histórico. Ele foi marcado como inativo.',
                'motorista' => $motorista->fresh('caminhao'),
            ]);
        }

        User::where('motorista_id', $motorista->id)->delete();
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

    /** Garante User ligado ao motorista; senha inicial = CPF (dígitos) quando forçar/criar. */
    private function garantirUsuarioComSenhaCpf(Motorista $motorista, bool $forcarSenha): User
    {
        $digitos = $motorista->senhaPadrao();
        $email = 'm'.$digitos.'@gfc.local';

        $usuario = User::where('motorista_id', $motorista->id)
            ->where('role', User::MOTORISTA)
            ->first();

        if (! $usuario) {
            $usuario = User::where('email', $email)->first() ?: new User(['email' => $email]);
            $usuario->role = User::MOTORISTA;
            $usuario->motorista_id = $motorista->id;
            $forcarSenha = true;
        }

        $usuario->name = $motorista->nome;
        $usuario->is_active = (bool) $motorista->ativo;
        $usuario->motorista_id = $motorista->id;
        $usuario->role = User::MOTORISTA;

        if ($forcarSenha && $digitos !== '') {
            $usuario->password = $digitos;
        }

        $usuario->save();

        return $usuario;
    }

    private function validar(Request $request, ?Motorista $motorista = null): array
    {
        if ($request->filled('cpf')) {
            $digitos = Motorista::cpfDigitos($request->input('cpf'));
            if (strlen($digitos) === 11) {
                $request->merge(['cpf' => Motorista::formatarCpf($digitos)]);
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
