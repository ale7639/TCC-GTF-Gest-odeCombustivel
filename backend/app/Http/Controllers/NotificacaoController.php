<?php

namespace App\Http\Controllers;

use App\Models\NotificacaoLeitura;
use App\Support\Alertas;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificacaoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $usuario = $request->user();
        $itens = $this->comLeitura($usuario);

        return response()->json([
            'itens' => $itens,
            'nao_lidas' => collect($itens)->where('lida', false)->count(),
        ]);
    }

    public function resumo(Request $request): JsonResponse
    {
        $itens = $this->comLeitura($request->user());

        return response()->json([
            'nao_lidas' => collect($itens)->where('lida', false)->count(),
        ]);
    }

    public function marcarLida(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'chave' => ['required', 'string', 'max:160'],
        ]);

        $usuario = $request->user();
        $validas = collect(Alertas::paraUsuario($usuario))->pluck('chave');
        if (! $validas->contains($dados['chave'])) {
            return response()->json(['message' => 'Notificação não encontrada.'], 404);
        }

        NotificacaoLeitura::updateOrCreate(
            ['user_id' => $usuario->id, 'chave' => $dados['chave']],
            ['lida_em' => now()]
        );

        return response()->json(['ok' => true]);
    }

    public function marcarTodas(Request $request): JsonResponse
    {
        $usuario = $request->user();
        $agora = now();

        foreach (Alertas::paraUsuario($usuario) as $alerta) {
            NotificacaoLeitura::updateOrCreate(
                ['user_id' => $usuario->id, 'chave' => $alerta['chave']],
                ['lida_em' => $agora]
            );
        }

        return response()->json(['ok' => true]);
    }

    private function comLeitura($usuario): array
    {
        $lidas = NotificacaoLeitura::where('user_id', $usuario->id)
            ->pluck('lida_em', 'chave');

        return collect(Alertas::paraUsuario($usuario))
            ->map(function (array $alerta) use ($lidas) {
                $lidaEm = $lidas->get($alerta['chave']);
                $alerta['lida'] = $lidaEm !== null;
                $alerta['lida_em'] = $lidaEm?->toIso8601String();

                return $alerta;
            })
            ->values()
            ->all();
    }
}
