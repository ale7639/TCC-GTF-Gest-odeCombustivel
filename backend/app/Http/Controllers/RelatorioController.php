<?php

namespace App\Http\Controllers;

use App\Models\Abastecimento;
use App\Models\AuditLog;
use App\Models\Caminhao;
use App\Models\NotaFiscal;
use App\Support\Consumo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RelatorioController extends Controller
{
    public function consumo(Request $request): JsonResponse
    {
        [$de, $ate] = $this->periodo($request);
        $query = Abastecimento::with('caminhao:id,placa,modelo')
            ->whereDate('data', '>=', $de)
            ->whereDate('data', '<=', $ate);

        if ($caminhaoId = $request->integer('caminhao_id')) {
            $query->where('caminhao_id', $caminhaoId);
        }

        $lista = $query->orderBy('data')->get();
        $dias = $lista->groupBy(fn ($a) => $a->data->toDateString())
            ->map(fn ($grupo, $dia) => [
                'data' => $dia,
                'litros' => round((float) $grupo->sum('litros'), 2),
                'quantidade' => $grupo->count(),
            ])
            ->values();

        $ranking = $lista->groupBy('caminhao_id')->map(function ($grupo) {
            $caminhao = $grupo->first()->caminhao;
            $media = $caminhao ? Consumo::mediaCaminhao($caminhao) : null;

            return [
                'caminhao_id' => $grupo->first()->caminhao_id,
                'placa' => $caminhao?->placa,
                'modelo' => $caminhao?->modelo,
                'litros' => round((float) $grupo->sum('litros'), 2),
                'quantidade' => $grupo->count(),
                'media_km_l' => $media,
            ];
        })->sortByDesc('litros')->values();

        $totalLitros = (float) $lista->sum('litros');
        $nDias = max(1, (int) (new \DateTime($de))->diff(new \DateTime($ate))->days + 1);

        return response()->json([
            'de' => $de,
            'ate' => $ate,
            'total_litros' => round($totalLitros, 2),
            'media_diaria' => round($totalLitros / $nDias, 2),
            'quantidade' => $lista->count(),
            'serie' => $dias,
            'ranking' => $ranking,
        ]);
    }

    public function abastecimentos(Request $request): JsonResponse
    {
        [$de, $ate] = $this->periodo($request);
        $query = Abastecimento::with([
            'caminhao:id,placa',
            'motorista:id,nome',
            'tanque:id,nome',
            'usuario:id,name',
        ])
            ->whereDate('data', '>=', $de)
            ->whereDate('data', '<=', $ate)
            ->orderByDesc('data')
            ->orderByDesc('id');

        if ($origem = $request->string('origem')->toString()) {
            $query->where('origem', $origem);
        }
        if ($caminhaoId = $request->integer('caminhao_id')) {
            $query->where('caminhao_id', $caminhaoId);
        }

        return response()->json($query->limit(300)->get());
    }

    public function quilometragem(): JsonResponse
    {
        $caminhoes = Caminhao::with('motorista:id,nome')
            ->orderBy('placa')
            ->get()
            ->map(function (Caminhao $c) {
                $ultimo = $c->abastecimentos()->orderByDesc('km')->orderByDesc('id')->first();

                return [
                    'id' => $c->id,
                    'placa' => $c->placa,
                    'modelo' => $c->modelo,
                    'km_atual' => $c->km_atual,
                    'status' => $c->status,
                    'motorista' => $c->motorista?->nome,
                    'media_km_l' => $c->media_km_l,
                    'ultimo_abastecimento_km' => $ultimo?->km,
                    'ultimo_abastecimento_data' => $ultimo?->data?->toDateString(),
                ];
            });

        return response()->json($caminhoes);
    }

    public function auditoria(Request $request): JsonResponse
    {
        $query = AuditLog::with('user:id,name,email,role')
            ->orderByDesc('id');

        if ($acao = $request->string('action')->toString()) {
            $query->where('action', 'like', $acao.'%');
        }

        return response()->json($query->limit(200)->get());
    }

    public function notas(Request $request): JsonResponse
    {
        $notas = NotaFiscal::with(['entradas.tanque:id,nome,tipo_combustivel'])
            ->orderByDesc('data_emissao')
            ->orderByDesc('id')
            ->limit((int) $request->integer('limit') ?: 30)
            ->get();

        return response()->json($notas);
    }

    private function periodo(Request $request): array
    {
        $mes = (int) ($request->integer('mes') ?: now()->month);
        $ano = (int) ($request->integer('ano') ?: now()->year);
        $de = $request->string('de')->toString() ?: sprintf('%04d-%02d-01', $ano, $mes);
        $ate = $request->string('ate')->toString() ?: date('Y-m-t', strtotime($de));

        return [$de, $ate];
    }
}
