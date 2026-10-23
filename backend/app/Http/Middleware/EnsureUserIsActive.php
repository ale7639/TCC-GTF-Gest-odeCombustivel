<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $usuario = $request->user();

        if ($usuario && ! $usuario->is_active) {
            $usuario->currentAccessToken()?->delete();

            return response()->json(['message' => 'Conta inativa.'], 401);
        }

        return $next($request);
    }
}
