<?php

namespace App\Http\Controllers;

use App\Models\LogAcesso;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LogAcessoController extends Controller
{
    // GET /api/logs-acesso?situacao=todos|sucesso|falha&dias=0|7|30|90&busca=&pagina=1
    public function index(Request $request): JsonResponse
    {
        $situacao = $request->query('situacao', 'todos');
        $dias     = (int) $request->query('dias', 30);
        $busca    = trim((string) $request->query('busca', ''));

        $consulta = LogAcesso::query()
            ->when($situacao === 'sucesso', fn ($q) => $q->where('sucesso', true))
            ->when($situacao === 'falha', fn ($q) => $q->where('sucesso', false))
            ->when($dias > 0, fn ($q) => $q->where('created_at', '>=', now()->subDays($dias)->startOfDay()))
            ->when($busca !== '', fn ($q) => $q->where(function ($q) use ($busca) {
                $q->where('email', 'like', "%{$busca}%")->orWhere('ip', 'like', "%{$busca}%");
            }));

        // Contagens do que está filtrado (ignorando só a escolha de situação).
        $base = LogAcesso::query()
            ->when($dias > 0, fn ($q) => $q->where('created_at', '>=', now()->subDays($dias)->startOfDay()))
            ->where('evento', 'login');
        $logins = (clone $base)->where('sucesso', true)->count();
        $falhas = (clone $base)->where('sucesso', false)->count();

        $pagina = $consulta->orderByDesc('id')->paginate(20, ['*'], 'pagina', (int) $request->query('pagina', 1));

        return response()->json([
            'dados' => $pagina->map(fn (LogAcesso $l) => [
                'id'          => $l->id,
                'email'       => $l->email,
                'evento'      => $l->evento,
                'sucesso'     => $l->sucesso,
                'motivo'      => $l->motivo,
                'ip'          => $l->ip,
                'dispositivo' => $l->dispositivo,
                'data_hora'   => $l->created_at->format('Y-m-d H:i:s'),
            ])->values(),
            'pagina'        => $pagina->currentPage(),
            'ultima_pagina' => $pagina->lastPage(),
            'total'         => $pagina->total(),
            'logins_ok'     => $logins,
            'falhas'        => $falhas,
        ]);
    }
}