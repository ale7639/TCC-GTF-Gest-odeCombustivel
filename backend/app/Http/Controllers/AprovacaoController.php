<?php

// =====================================================================================
// AprovacaoController — o ADMIN aprova ou recusa o que os motoristas lançaram.
//
// Rotas (routes/api.php):
//   GET  /api/aprovacoes?status=...                  -> index()    lista por status (grupo do admin)
//   POST /api/aprovacoes/{tipo}/{id}/aprovar         -> aprovar()  (grupo do admin)
//   POST /api/aprovacoes/{tipo}/{id}/recusar         -> recusar()  (grupo do admin)
//   GET  /api/fotos/abastecimentos/{id}?signature=.. -> foto()     pública, mas só com URL assinada
// {tipo} = 'abastecimento', 'lavagem' ou 'manutencao' (a classe Support\Lancamentos traduz para o Model).
//
// Regra de negócio: o abastecimento do motorista fica PENDENTE e não mexe em nada.
// Só quando o admin APROVA é que o combustível sai do tanque (custo médio) e o km do caminhão anda.
// Recusar só muda o status (com um motivo opcional), porque nada tinha sido alterado.
// =====================================================================================

namespace App\Http\Controllers;

use App\Models\Abastecimento;
use App\Models\Caminhao;
use App\Models\Manutencao;
use App\Models\Tanque;
use App\Support\Lancamentos;                 // junta abastecimentos, lavagens e manutenções num formato só
use App\Support\Quilometragem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;   // resposta que é um ARQUIVO (a foto)

// Tela do ADMIN para aprovar ou recusar o que os motoristas lançaram.
class AprovacaoController extends Controller
{
    // GET /api/aprovacoes?status=pendente|aprovado|recusado
    public function index(Request $request): JsonResponse
    {
        // Só aceita os 3 status conhecidos; qualquer outra coisa vira 'pendente'.
        $status = in_array($request->query('status'), ['pendente', 'aprovado', 'recusado'], true)
            ? $request->query('status')
            : 'pendente';

        // mapas() busca placas, nomes e tanques UMA vez (evita uma consulta por item).
        $mapas = Lancamentos::mapas();
        $itens = collect();   // collect() = lista vazia do Laravel (Collection)

        // Para cada tipo (abastecimento, lavagem, manutenção): os 50 mais recentes com esse status,
        // cada um convertido para o mesmo formato (apresentar) e colocado na lista.
        foreach (Lancamentos::TIPOS as $tipo) {
            Lancamentos::modelo($tipo)::where('status', $status)
                ->orderByDesc('id')->limit(50)->get()
                ->each(fn ($m) => $itens->push(Lancamentos::apresentar($tipo, $m, $mapas)));
        }

        return response()->json([
            'status'    => $status,
            'pendentes' => Lancamentos::contarPendentes(),    // número da aba "Pendentes (N)" e do sino
            // Mistura os 3 tipos, do mais recente para o mais antigo, e mostra até 60.
            'itens'     => $itens->sortByDesc('ordem')->take(60)->values(),
        ]);
    }

    // POST /api/aprovacoes/{tipo}/{id}/aprovar
    public function aprovar(string $tipo, int $id): JsonResponse
    {
        // Transação: aprovar mexe no lançamento, no tanque e no caminhão juntos (tudo ou nada).
        DB::transaction(function () use ($tipo, $id) {
            $modelo = Lancamentos::modelo($tipo);          // ex.: 'abastecimento' -> App\Models\Abastecimento
            // lockForUpdate: se dois admins clicarem ao mesmo tempo, o segundo espera o primeiro.
            $item   = $modelo::lockForUpdate()->findOrFail($id);

            // Evita aprovar duas vezes (o segundo clique encontraria o status já mudado).
            if ($item->status !== 'pendente') {
                throw ValidationException::withMessages(['status' => 'Este lançamento já foi analisado.']);
            }

            $caminhao = Caminhao::lockForUpdate()->findOrFail($item->caminhao_id);

            if ($tipo === 'abastecimento') {
                // Confere de novo o salto de km (o km do caminhão pode ter mudado desde o envio).
                // permitirMenor: true = aceita km menor que o atual (o motorista pode ter enviado
                // um abastecimento antigo depois de outro mais novo já ter sido aprovado).
                Quilometragem::validar((int) $item->km, (int) $caminhao->km_atual, permitirMenor: true);
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
            // "trim(...) ?: null" = motivo em branco vira null. O motorista vê o motivo no app dele.
            $item->status        = 'recusado';
            $item->motivo_recusa = trim($dados['motivo'] ?? '') ?: null;
            $item->save();
        });

        return response()->json(['message' => 'Lançamento recusado.']);
    }

    // Aprovar um abastecimento é o momento em que ele de fato "acontece":
    // na base, tira os litros do tanque; fora da base, só registra o custo pago.
    // "private" = só esta classe usa; é chamada dentro da transação do aprovar().
    private function aplicarAbastecimento(Abastecimento $a): void
    {
        $litros = (float) $a->litros;

        // Fora da base: o custo é o que foi pago no posto (entra no gasto com combustível).
        if ($a->origem === 'externo') {
            $a->custo_total = (float) $a->valor_total;
            $a->custo_litro = $litros > 0 ? round((float) $a->valor_total / $litros, 4) : null;

            return;
        }

        // Na base: o combustível sai do tanque, igual ao AbastecimentoController::store.
        $tanque = Tanque::lockForUpdate()->find($a->tanque_id);
        if (! $tanque) {
            throw ValidationException::withMessages(['tanque' => 'O tanque deste abastecimento não existe mais. Recuse o lançamento.']);
        }

        // Confere o estoque AGORA (pode ter baixado desde que o motorista enviou).
        $nivelAntes = (float) $tanque->nivel_atual;
        if ($litros > $nivelAntes) {
            throw ValidationException::withMessages([
                'litros' => 'O ' . $tanque->nome . ' tem apenas ' . $nivelAntes . ' L. Registre uma entrada de combustível ou recuse o lançamento.',
            ]);
        }

        // Custo médio: valor do estoque ÷ litros no tanque.
        $custoLitro = $nivelAntes > 0 ? (float) $tanque->valor_estoque / $nivelAntes : 0;
        $custoTotal = $litros * $custoLitro;
        $novoNivel  = $nivelAntes - $litros;

        $tanque->update([
            'nivel_atual'   => $novoNivel,
            'valor_estoque' => $novoNivel > 0.0001 ? max(0, (float) $tanque->valor_estoque - $custoTotal) : 0,
        ]);

        // Grava o custo no abastecimento (o save() acontece no aprovar()).
        $a->custo_litro = round($custoLitro, 4);
        $a->custo_total = round($custoTotal, 4);
    }

    // GET /api/fotos/abastecimentos/{id}?signature=... — rota pública, mas só abre com o endereço assinado.
    // A assinatura (middleware "signed" na rota) prova que o endereço foi gerado pelo próprio sistema;
    // sem ela, ou com ela alterada, o Laravel recusa. A foto fica em storage/app (privado, fora do public).
    public function foto(Abastecimento $abastecimento): BinaryFileResponse
    {
        // abort_unless(condição, 404) = se a foto não existir, responde 404.
        abort_unless($abastecimento->foto && Storage::disk('local')->exists($abastecimento->foto), 404);

        // Devolve o próprio arquivo da imagem.
        return response()->file(Storage::disk('local')->path($abastecimento->foto));
    }
}