<?php

namespace App\Http\Controllers;

use App\Models\Abastecimento;
use App\Models\Caminhao;
use App\Models\ChecklistPreViagem;
use App\Models\ConciliacaoTanque;
use App\Models\Manutencao;
use App\Models\Motorista;
use App\Models\Multa;
use App\Models\Pneu;
use App\Models\Tanque;
use App\Support\Consumo;
use App\Support\Documentos;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $usuario = $request->user();
        $inicio = now()->subDays(30)->toDateString();
        $hoje = now()->toDateString();

        $caminhoes = Caminhao::query();
        $abastecimentos = Abastecimento::query();
        if ($usuario->isMotorista()) {
            $caminhoes->where('motorista_id', $usuario->motorista_id);
            $abastecimentos->where('motorista_id', $usuario->motorista_id);
        }

        $tanques = Tanque::orderBy('nome')->get()->map(function ($tanque) {
            $percentual = $tanque->capacidade > 0
                ? ($tanque->nivel_atual / $tanque->capacidade) * 100
                : 0;

            return [
                'id' => $tanque->id,
                'nome' => $tanque->nome,
                'tipo_combustivel' => $tanque->tipo_combustivel,
                'capacidade' => (float) $tanque->capacidade,
                'nivel_atual' => (float) $tanque->nivel_atual,
                'percentual' => round($percentual, 1),
                'alerta' => $percentual < 20,
            ];
        });

        $ultimos = (clone $abastecimentos)
            ->with(['caminhao:id,placa', 'motorista:id,nome', 'tanque:id,nome'])
            ->orderByDesc('data')
            ->orderByDesc('id')
            ->limit(5)
            ->get()
            ->map(fn ($a) => [
                'id' => $a->id,
                'data' => $a->data->toDateString(),
                'litros' => (float) $a->litros,
                'origem' => $a->origem,
                'placa' => $a->caminhao?->placa,
                'motorista' => $a->motorista?->nome,
                'tanque' => $a->tanque?->nome,
                'comprovante_url' => $a->comprovante_url,
            ]);

        $hojeQuery = (clone $abastecimentos)->whereDate('data', $hoje);
        $totalFrota = (clone $caminhoes)->where('status', '!=', 'inativo')->count();
        $ativos = (clone $caminhoes)->where('status', 'ativo')->count();
        $emManut = (clone $caminhoes)->where('status', 'manutencao')->count();

        $payload = [
            'caminhoes' => [
                'total' => (clone $caminhoes)->count(),
                'ativos' => $ativos,
                'em_manutencao' => $emManut,
                'disponibilidade_pct' => $totalFrota > 0 ? round(($ativos / $totalFrota) * 100, 1) : null,
            ],
            'litros_abastecidos_30_dias' => (float) (clone $abastecimentos)->where('data', '>=', $inicio)->sum('litros'),
            'abastecimentos_hoje' => (clone $hojeQuery)->count(),
            'litros_hoje' => (float) (clone $hojeQuery)->sum('litros'),
            'gasto_manutencao_30_dias' => $usuario->isMotorista()
                ? null
                : (float) Manutencao::where('data', '>=', $inicio)->sum('valor'),
            'tanques' => $tanques,
            'ultimos_abastecimentos' => $ultimos,
            'alertas' => [],
        ];

        if (! $usuario->isMotorista()) {
            $payload['alertas'] = $this->alertasGestao($inicio);
        } else {
            $payload['alertas'] = $this->alertasMotorista($usuario->motorista_id);
        }

        return response()->json($payload);
    }

    private function alertasGestao(string $inicio): array
    {
        $alertas = [];

        foreach (Motorista::where('ativo', true)->whereNotNull('cnh_validade')->get() as $m) {
            $a = Documentos::alerta($m->cnh_validade?->toDateString());
            if ($a && in_array($a['nivel'], ['vencido', 'proximo'], true)) {
                $alertas[] = [
                    'tipo' => 'documento',
                    'nivel' => $a['nivel'],
                    'titulo' => $a['nivel'] === 'vencido' ? 'CNH vencida' : 'CNH perto do vencimento',
                    'texto' => $m->nome.' · '.($a['nivel'] === 'vencido' ? 'vencida há '.$a['dias'].' dias' : 'vence em '.$a['dias'].' dias'),
                    'link' => '/app/motoristas',
                ];
            }
        }

        foreach (Caminhao::where('status', '!=', 'inativo')->get() as $c) {
            foreach ([['crlv_validade', 'CRLV'], ['seguro_validade', 'Seguro']] as [$campo, $label]) {
                $a = Documentos::alerta($c->{$campo}?->toDateString());
                if ($a && in_array($a['nivel'], ['vencido', 'proximo'], true)) {
                    $alertas[] = [
                        'tipo' => 'documento',
                        'nivel' => $a['nivel'],
                        'titulo' => $a['nivel'] === 'vencido' ? "$label vencido" : "$label perto do vencimento",
                        'texto' => $c->placa.' · '.($a['nivel'] === 'vencido' ? 'vencido há '.$a['dias'].' dias' : 'vence em '.$a['dias'].' dias'),
                        'link' => '/app/frota/'.$c->id,
                    ];
                }
            }

            $media = Consumo::mediaCaminhao($c);
            if ($media && $c->meta_km_l && $media < ((float) $c->meta_km_l * 0.9)) {
                $alertas[] = [
                    'tipo' => 'meta_km_l',
                    'nivel' => 'proximo',
                    'titulo' => 'Abaixo da meta km/L',
                    'texto' => $c->placa.' · média '.$media.' (meta '.$c->meta_km_l.')',
                    'link' => '/app/frota/'.$c->id,
                ];
            }

            $trechos = Consumo::trechos(
                $c->abastecimentos()->orderBy('km')->orderBy('data')->orderBy('id')->get()
            );
            $ultimo = $trechos->last();
            if ($media && $ultimo && $ultimo['km_l'] < ($media * 0.75)) {
                $alertas[] = [
                    'tipo' => 'consumo_anomalo',
                    'nivel' => 'vencido',
                    'titulo' => 'Consumo anômalo',
                    'texto' => $c->placa.' · último trecho '.$ultimo['km_l'].' km/L (média '.$media.')',
                    'link' => '/app/frota/'.$c->id,
                ];
            }
        }

        $pneus = Pneu::with('caminhao:id,placa,km_atual')->get()
            ->filter(fn ($p) => in_array($p->alerta, ['atrasado', 'proximo'], true));
        foreach ($pneus->take(8) as $p) {
            $alertas[] = [
                'tipo' => 'pneu',
                'nivel' => $p->alerta === 'atrasado' ? 'vencido' : 'proximo',
                'titulo' => $p->alerta === 'atrasado' ? 'Pneu atrasado' : 'Pneu próximo da troca',
                'texto' => ($p->caminhao?->placa).' · posição '.$p->posicao,
                'link' => '/app/frota/'.($p->caminhao_id).'/pneus',
            ];
        }

        foreach (ConciliacaoTanque::with('tanque:id,nome')->where('alerta', true)->where('data', '>=', $inicio)->orderByDesc('data')->limit(5)->get() as $c) {
            $alertas[] = [
                'tipo' => 'conciliacao',
                'nivel' => 'vencido',
                'titulo' => 'Variação no tanque',
                'texto' => ($c->tanque?->nome).' · '.number_format((float) $c->variacao, 1, ',', '.').' L em '.$c->data->format('d/m'),
                'link' => '/app/tanques/'.$c->tanque_id,
            ];
        }

        foreach (Multa::with('caminhao:id,placa')->where('status', '!=', 'pago')->whereNotNull('prazo')->whereDate('prazo', '<=', now()->addDays(7))->limit(5)->get() as $m) {
            $alertas[] = [
                'tipo' => 'multa',
                'nivel' => $m->atrasada ? 'vencido' : 'proximo',
                'titulo' => $m->atrasada ? 'Multa atrasada' : 'Multa com prazo perto',
                'texto' => ($m->caminhao?->placa).' · '.$m->descricao,
                'link' => '/app/multas',
            ];
        }

        $naoAptos = ChecklistPreViagem::with('caminhao:id,placa')
            ->where('status', 'nao_apto')
            ->where('data', '>=', $inicio)
            ->orderByDesc('id')
            ->limit(5)
            ->get();
        foreach ($naoAptos as $ch) {
            $alertas[] = [
                'tipo' => 'checklist',
                'nivel' => 'vencido',
                'titulo' => 'Saída não apta',
                'texto' => ($ch->caminhao?->placa).' · checklist pré-viagem',
                'link' => '/app/saida',
            ];
        }

        return array_slice($alertas, 0, 20);
    }

    private function alertasMotorista(?int $motoristaId): array
    {
        if (! $motoristaId) {
            return [];
        }
        $alertas = [];
        $m = Motorista::find($motoristaId);
        if ($m?->cnh_validade) {
            $a = Documentos::alerta($m->cnh_validade->toDateString());
            if ($a && in_array($a['nivel'], ['vencido', 'proximo'], true)) {
                $alertas[] = [
                    'tipo' => 'documento',
                    'nivel' => $a['nivel'],
                    'titulo' => $a['nivel'] === 'vencido' ? 'Sua CNH está vencida' : 'CNH perto do vencimento',
                    'texto' => $a['nivel'] === 'vencido' ? 'Vencida há '.$a['dias'].' dias' : 'Vence em '.$a['dias'].' dias',
                    'link' => '/app',
                ];
            }
        }

        return $alertas;
    }
}
