<?php

namespace App\Http\Controllers;

use App\Models\Caminhao;
use App\Models\ChecklistPreViagem;
use App\Models\Manutencao;
use App\Support\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ChecklistPreViagemController extends Controller
{
    public const ITENS = [
        'freios',
        'luzes',
        'pneus',
        'oleo_agua',
        'extintor',
        'documentos',
        'para_brisas',
        'estepe',
    ];

    public const ROTULOS = [
        'freios' => 'Freios',
        'luzes' => 'Luzes e setas',
        'pneus' => 'Pneus / calibragem',
        'oleo_agua' => 'Óleo e água',
        'extintor' => 'Extintor',
        'documentos' => 'Documentos no veículo',
        'para_brisas' => 'Para-brisas / limpadores',
        'estepe' => 'Estepe e macaco',
    ];

    public function itens(): JsonResponse
    {
        return response()->json(collect(self::ITENS)->map(fn ($k) => [
            'chave' => $k,
            'rotulo' => self::ROTULOS[$k],
        ])->values());
    }

    public function index(Request $request): JsonResponse
    {
        $query = ChecklistPreViagem::with(['caminhao:id,placa', 'motorista:id,nome'])
            ->orderByDesc('data')
            ->orderByDesc('id');

        if ($request->user()->isMotorista()) {
            $query->where('motorista_id', $request->user()->motorista_id);
        }
        if ($id = $request->integer('caminhao_id')) {
            $query->where('caminhao_id', $id);
        }

        return response()->json($query->limit(50)->get());
    }

    public function store(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'caminhao_id' => ['required', 'integer', 'exists:caminhoes,id'],
            'data' => ['nullable', 'date', 'before_or_equal:today'],
            'itens' => ['required', 'array', 'min:1'],
            'itens.*.chave' => ['required', 'string', Rule::in(self::ITENS)],
            'itens.*.ok' => ['required', 'boolean'],
            'itens.*.observacao' => ['nullable', 'string', 'max:255'],
            'observacao' => ['nullable', 'string', 'max:2000'],
            'foto' => ['nullable', 'image', 'max:5120'],
            'abrir_manutencao' => ['sometimes', 'boolean'],
        ]);

        $caminhao = Caminhao::findOrFail($dados['caminhao_id']);
        $this->authorize('abastecer', $caminhao);

        $usuario = $request->user();
        $motoristaId = $usuario->isMotorista()
            ? $usuario->motorista_id
            : $caminhao->motorista_id;

        $itens = collect($dados['itens'])->map(fn ($i) => [
            'chave' => $i['chave'],
            'rotulo' => self::ROTULOS[$i['chave']] ?? $i['chave'],
            'ok' => (bool) $i['ok'],
            'observacao' => $i['observacao'] ?? null,
        ])->values()->all();

        $reprovados = collect($itens)->where('ok', false)->values();
        $status = $reprovados->isEmpty() ? 'apto' : 'nao_apto';

        $fotoPath = null;
        if ($request->file('foto')) {
            $fotoPath = $request->file('foto')->store('checklists', 'public');
        }

        $manutencaoId = null;
        if ($status === 'nao_apto' && ($dados['abrir_manutencao'] ?? true) && $motoristaId) {
            $falhas = $reprovados->pluck('rotulo')->implode(', ');
            $manutencao = Manutencao::create([
                'caminhao_id' => $caminhao->id,
                'motorista_id' => $motoristaId,
                'data' => $dados['data'] ?? now()->toDateString(),
                'data_prevista' => $dados['data'] ?? now()->toDateString(),
                'status' => 'aberto',
                'tipo' => 'Checklist pré-viagem',
                'oficina' => 'Pátio / oficina',
                'descricao' => 'Itens reprovados na saída do pátio: '.$falhas,
                'checklist' => $reprovados->pluck('rotulo')->all(),
                'valor' => 0,
                'km' => $caminhao->km_atual,
            ]);
            $manutencaoId = $manutencao->id;
            if ($caminhao->status === 'ativo') {
                $caminhao->status = 'manutencao';
                $caminhao->save();
            }
        }

        $checklist = ChecklistPreViagem::create([
            'caminhao_id' => $caminhao->id,
            'motorista_id' => $motoristaId,
            'user_id' => $usuario->id,
            'data' => $dados['data'] ?? now()->toDateString(),
            'status' => $status,
            'itens' => $itens,
            'foto_path' => $fotoPath,
            'observacao' => $dados['observacao'] ?? null,
            'manutencao_id' => $manutencaoId,
        ]);

        Auditoria::registrar('checklist.pre_viagem', $checklist, [
            'placa' => $caminhao->placa,
            'status' => $status,
        ]);

        return response()->json($checklist->load([
            'caminhao:id,placa,status',
            'motorista:id,nome',
            'manutencao:id,tipo,status',
        ]), 201);
    }
}
