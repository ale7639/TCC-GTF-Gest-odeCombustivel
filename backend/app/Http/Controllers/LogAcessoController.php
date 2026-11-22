<?php

// =====================================================================================
// LogAcessoController — tela "Log de acesso" do ADMIN (auditoria de login/logout).
//
// Rota (routes/api.php, grupo do admin):
//   GET /api/logs-acesso?situacao=todos|sucesso|falha&dias=0|7|30|90&busca=&pagina=1 -> index()
//
// Só LÊ a tabela logs_acesso. Quem grava é o AuthController, a cada tentativa de login e logout.
// =====================================================================================

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

        // when(condição, função) = só aplica o filtro QUANDO a condição for verdadeira.
        // É um jeito mais curto de escrever vários "if" montando a consulta.
        $consulta = LogAcesso::query()
            ->when($situacao === 'sucesso', fn ($q) => $q->where('sucesso', true))
            ->when($situacao === 'falha', fn ($q) => $q->where('sucesso', false))
            // startOfDay() = desde a meia-noite daquele dia.
            ->when($dias > 0, fn ($q) => $q->where('created_at', '>=', now()->subDays($dias)->startOfDay()))
            // Busca no login digitado (e-mail ou CPF) ou no IP.
            ->when($busca !== '', fn ($q) => $q->where(function ($q) use ($busca) {
                $q->where('email', 'like', "%{$busca}%")->orWhere('ip', 'like', "%{$busca}%");
            }));

        // Contagens do que está filtrado (ignorando só a escolha de situação).
        // Conta só os eventos de login (logout não é tentativa).
        $base = LogAcesso::query()
            ->when($dias > 0, fn ($q) => $q->where('created_at', '>=', now()->subDays($dias)->startOfDay()))
            ->where('evento', 'login');
        $logins = (clone $base)->where('sucesso', true)->count();
        $falhas = (clone $base)->where('sucesso', false)->count();

        // Mais recentes primeiro, 20 por página.
        $pagina = $consulta->orderByDesc('id')->paginate(20, ['*'], 'pagina', (int) $request->query('pagina', 1));

        return response()->json([
            'dados' => $pagina->map(fn (LogAcesso $l) => [
                'id'          => $l->id,
                'email'       => $l->email,          // o que foi digitado (e-mail ou CPF)
                'evento'      => $l->evento,
                'sucesso'     => $l->sucesso,
                'motivo'      => $l->motivo,         // ex.: "Senha incorreta", "Bloqueado por excesso de tentativas"
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