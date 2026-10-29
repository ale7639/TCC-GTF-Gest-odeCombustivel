<?php

namespace App\Http\Controllers;

use App\Models\Abastecimento;
use App\Models\Caminhao;
use App\Models\Manutencao;
use App\Models\Tanque;
use App\Support\Lancamentos;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

// Tela do ADMIN para aprovar ou recusar o que os motoristas lançaram.
class AprovacaoController extends Controller
{
    // GET /api/aprovacoes?status=pendente|aprovado|recusado
    public function index(Request $request): JsonResponse
    {
        $status = in_array($request->query('status'), ['pendente', 'aprovado', 'recusado'], true)
            ? $request->query('status')
            : 'pendente';

        $mapas = Lancamentos::mapas();
        $itens = collect();

        foreach (Lancamentos::TIPOS as $tipo) {
            Lancamentos::modelo($tipo)::where('status', $status)
                ->orderByDesc('id')->limit(50)->get()
                ->each(fn ($m) => $itens->push(Lancamentos::apresentar($tipo, $m, $mapas)));
        }

        return response()->json([
            'status'    => $status,
            'pendentes' => Lancamentos::contarPendentes(),
            'itens'     => $itens->sortByDesc('ordem')->take(60)->values(),
        ]);
    }

    // POST /api/aprovacoes/{tipo}/{id}/aprovar
    public function aprovar(string $tipo, int $id): JsonResponse
    {
        DB::transaction(function () use ($tipo, $id) {
            $modelo = Lancamentos::modelo($tipo);
            $item   = $modelo::lockForUpdate()->findOrFail($id);

            if ($item->status !== 'pendente') {
                throw ValidationException::withMessages(['status' => 'Este lançamento já foi analisado.']);
            }

            $caminhao = Caminhao::lockForUpdate()->findOrFail($item->caminhao_id);

            if ($tipo === 'abastecimento') {
                $this->aplicarAbastecimento($item);
            }

            // Abastecimento e manutenção informam a quilometragem: o caminhão nunca "volta" no km.
            if (in_array($tipo, ['abastecimento', 'manutencao'], true) && $item->km !== null) {
                $caminhao->update(['km_atual' => max((int) $caminhao->km_atual, (int) $item->km)]);
            }

            $item->status        = 'aprovado';
            $item->motivo_recusa = null;
            $item->save();
        });

        return response()->json(['message' => 'Lançamento aprovado.']);
    }

    // POST /api/aprovacoes/{tipo}/{id}/recusar  (motivo opcional)
    public function recusar(Request $request, string $tipo, int $id): JsonResponse
    {
        $dados = $request->validate(['motivo' => ['nullable', 'string', 'max:255']]);

        DB::transaction(function () use ($tipo, $id, $dados) {
            $item = Lancamentos::modelo($tipo)::lockForUpdate()->findOrFail($id);

            if ($item->status !== 'pendente') {
                throw ValidationException::withMessages(['status' => 'Este lançamento já foi analisado.']);
            }

            // Como o lançamento pendente ainda não mexeu em tanque nem em km, recusar é só mudar o status.
            $item->status        = 'recusado';
            $item->motivo_recusa = trim($dados['motivo'] ?? '') ?: null;
            $item->save();
        });

        return response()->json(['message' => 'Lançamento recusado.']);
    }

    // Aprovar um abastecimento é o momento em que ele de fato "acontece":
    // na base, tira os litros do tanque; fora da base, só registra o custo pago.
    private function aplicarAbastecimento(Abastecimento $a): void
    {
        $litros = (float) $a->litros;

        if ($a->origem === 'externo') {
            $a->custo_total = (float) $a->valor_total;
            $a->custo_litro = $litros > 0 ? round((float) $a->valor_total / $litros, 4) : null;

            return;
        }

        $tanque = Tanque::lockForUpdate()->find($a->tanque_id);
        if (! $tanque) {
            throw ValidationException::withMessages(['tanque' => 'O tanque deste abastecimento não existe mais. Recuse o lançamento.']);
        }

        $nivelAntes = (float) $tanque->nivel_atual;
        if ($litros > $nivelAntes) {
            throw ValidationException::withMessages([
                'litros' => 'O ' . $tanque->nome . ' tem apenas ' . $nivelAntes . ' L. Registre uma entrada de combustível ou recuse o lançamento.',
            ]);
        }

        $custoLitro = $nivelAntes > 0 ? (float) $tanque->valor_estoque / $nivelAntes : 0;
        $custoTotal = $litros * $custoLitro;
        $novoNivel  = $nivelAntes - $litros;

        $tanque->update([
            'nivel_atual'   => $novoNivel,
            'valor_estoque' => $novoNivel > 0.0001 ? max(0, (float) $tanque->valor_estoque - $custoTotal) : 0,
        ]);

        $a->custo_litro = round($custoLitro, 4);
        $a->custo_total = round($custoTotal, 4);
    }

    // GET /api/fotos/abastecimentos/{id}?signature=... — rota pública, mas só abre com o endereço assinado.
    public function foto(Abastecimento $abastecimento): BinaryFileResponse
    {
        abort_unless($abastecimento->foto && Storage::disk('local')->exists($abastecimento->foto), 404);

        return response()->file(Storage::disk('local')->path($abastecimento->foto));
    }
}