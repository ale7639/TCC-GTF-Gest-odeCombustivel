<?php

namespace App\Http\Middleware;

use App\Models\Motorista;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

// Só deixa passar um motorista ATIVO e entrega o cadastro dele para o controller.
// Se o admin inativar o motorista, o acesso é cortado na hora (mesmo com token válido).
class ApenasMotorista
{
    public function handle(Request $request, Closure $next): Response
    {
        $usuario   = $request->user();
        $motorista = ($usuario?->perfil === 'motorista' && $usuario->motorista_id)
            ? Motorista::find($usuario->motorista_id)
            : null;

        if (! $motorista || ! $motorista->ativo) {
            return response()->json(['message' => 'Acesso restrito ao motorista ativo.'], 403);
        }

        $request->attributes->set('motorista', $motorista);

        return $next($request);
    }
}