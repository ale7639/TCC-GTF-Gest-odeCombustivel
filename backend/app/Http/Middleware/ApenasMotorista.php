<?php

namespace App\Http\Middleware;

use App\Models\Motorista;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Só motorista ativo; injeta o cadastro em $request->attributes['motorista']. */
class ApenasMotorista
{
    public function handle(Request $request, Closure $next): Response
    {
        $usuario = $request->user();
        $ehMotorista = $usuario && (
            $usuario->role === 'motorista'
            || ($usuario->perfil ?? null) === 'motorista'
        );

        $motorista = ($ehMotorista && $usuario->motorista_id)
            ? Motorista::find($usuario->motorista_id)
            : null;

        if (! $motorista || ! $motorista->ativo) {
            return response()->json(['message' => 'Acesso restrito ao motorista ativo.'], 403);
        }

        $request->attributes->set('motorista', $motorista);

        return $next($request);
    }
}
