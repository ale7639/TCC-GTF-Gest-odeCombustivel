<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Bloqueia motorista nas rotas de gestão (compat mobile Wallace + role Diego). */
class ApenasAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $usuario = $request->user();
        $ehMotorista = $usuario && (
            $usuario->role === 'motorista'
            || ($usuario->perfil ?? null) === 'motorista'
        );

        if ($ehMotorista) {
            return response()->json(['message' => 'Acesso restrito ao administrador.'], 403);
        }

        return $next($request);
    }
}
