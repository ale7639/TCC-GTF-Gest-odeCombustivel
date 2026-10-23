<?php

namespace App\Support;

use App\Models\Abastecimento;
use App\Models\Caminhao;
use Illuminate\Support\Collection;

class Consumo
{
    /**
     * Média km/L do caminhão: (Δ km entre abastecimentos consecutivos) / litros do abastecimento seguinte.
     */
    public static function mediaCaminhao(Caminhao $caminhao): ?float
    {
        $lista = $caminhao->relationLoaded('abastecimentos')
            ? $caminhao->abastecimentos->sortBy([['km', 'asc'], ['data', 'asc'], ['id', 'asc']])->values()
            : $caminhao->abastecimentos()->orderBy('km')->orderBy('data')->orderBy('id')->get();

        $trechos = self::trechos($lista);

        if ($trechos->isEmpty()) {
            return null;
        }

        return round((float) $trechos->avg('km_l'), 2);
    }

    public static function trechos(Collection $abastecimentos): Collection
    {
        $ordenado = $abastecimentos->sortBy([['km', 'asc'], ['data', 'asc'], ['id', 'asc']])->values();
        $trechos = collect();
        $anterior = null;

        foreach ($ordenado as $atual) {
            if ($anterior && $atual->km > $anterior->km && (float) $atual->litros > 0.5) {
                $delta = $atual->km - $anterior->km;
                $trechos->push([
                    'abastecimento_id' => $atual->id,
                    'km_l' => round($delta / (float) $atual->litros, 2),
                    'delta_km' => $delta,
                ]);
            }
            $anterior = $atual;
        }

        return $trechos;
    }

    public static function kmLDoAbastecimento(Abastecimento $atual, ?Abastecimento $anterior): ?float
    {
        if (! $anterior || $atual->km <= $anterior->km || (float) $atual->litros <= 0.5) {
            return null;
        }

        return round(($atual->km - $anterior->km) / (float) $atual->litros, 2);
    }
}
