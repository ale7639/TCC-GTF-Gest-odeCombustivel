<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

// Bloqueia o motorista nas rotas de gestão. Quem não é motorista é tratado como administrador.
class ApenasAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->perfil === 'motorista') {
            return response()->json(['message' => 'Acesso restrito ao administrador.'], 403);
        }

        return $next($request);
    }
}