<?php

namespace App\Support;

use App\Models\Caminhao;
use Carbon\Carbon;

class Oleo
{
    public static function resumo(Caminhao $caminhao): array
    {
        $intervalo = (int) ($caminhao->oleo_intervalo_km ?: 10000);
        $ultimaKm = $caminhao->oleo_ultima_km !== null ? (int) $caminhao->oleo_ultima_km : null;
        $proximaKm = $ultimaKm !== null ? $ultimaKm + $intervalo : null;
        $kmAtual = (int) $caminhao->km_atual;
        $restanteKm = $proximaKm !== null ? $proximaKm - $kmAtual : null;

        $proximaData = $caminhao->oleo_proxima_data
            ? Carbon::parse($caminhao->oleo_proxima_data)->startOfDay()
            : null;
        $dias = $proximaData ? (int) now()->startOfDay()->diffInDays($proximaData, false) : null;

        $alerta = 'ok';
        if ($restanteKm !== null && $restanteKm <= 0) {
            $alerta = 'atrasado';
        } elseif ($dias !== null && $dias < 0) {
            $alerta = 'atrasado';
        } elseif ($restanteKm !== null && $restanteKm <= 1500) {
            $alerta = 'proximo';
        } elseif ($dias !== null && $dias <= 15) {
            $alerta = 'proximo';
        } elseif ($ultimaKm === null && ! $caminhao->oleo_ultima_data) {
            $alerta = 'sem_registro';
        }

        return [
            'ultima_data' => $caminhao->oleo_ultima_data?->toDateString(),
            'ultima_km' => $ultimaKm,
            'intervalo_km' => $intervalo,
            'proxima_km' => $proximaKm,
            'proxima_data' => $proximaData?->toDateString(),
            'restante_km' => $restanteKm,
            'dias_para_data' => $dias,
            'alerta' => $alerta,
            'rotulo' => match ($alerta) {
                'atrasado' => 'Troca de óleo atrasada',
                'proximo' => 'Troca de óleo próxima',
                'sem_registro' => 'Sem registro de óleo',
                default => 'Óleo em dia',
            },
        ];
    }

    public static function ehTrocaDeOleo(string $tipo): bool
    {
        $t = mb_strtolower($tipo);

        return str_contains($t, 'óleo')
            || str_contains($t, 'oleo')
            || str_contains($t, 'lubrificant');
    }
}
