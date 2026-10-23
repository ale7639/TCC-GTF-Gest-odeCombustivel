<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $usuario = $request->user();

        if (! $usuario || ! in_array($usuario->role, $roles, true)) {
            return response()->json([
                'message' => 'Acesso não autorizado para o seu perfil.',
            ], 403);
        }

        return $next($request);
    }
}
