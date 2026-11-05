<?php

namespace App\Support;

use Carbon\Carbon;

class Documentos
{
    /** Dias de antecedência para aviso de vencimento. */
    public const JANELA = 30;

    public static function alerta(?string $data): ?array
    {
        if (! $data) {
            return null;
        }

        $venc = Carbon::parse($data)->startOfDay();
        $hoje = now()->startOfDay();
        $dias = $hoje->diffInDays($venc, false);

        if ($dias < 0) {
            return ['nivel' => 'vencido', 'dias' => (int) abs($dias), 'data' => $venc->toDateString()];
        }
        if ($dias <= self::JANELA) {
            return ['nivel' => 'proximo', 'dias' => (int) $dias, 'data' => $venc->toDateString()];
        }

        return ['nivel' => 'ok', 'dias' => (int) $dias, 'data' => $venc->toDateString()];
    }
}
