<?php

namespace App\Support;

use Illuminate\Validation\ValidationException;

// Regra da quilometragem informada num abastecimento, usada em todo o sistema
// (admin, motorista e aprovação). Para mudar o limite, mude só a constante abaixo.
class Quilometragem
{
    // Quanto o caminhão pode ter andado, no máximo, entre um registro e outro.
    // Um tanque cheio dura em geral 1.500 a 3.000 km, então 5.000 km é folgado.
    // Serve para barrar erro de digitação (ex.: um dígito a mais), que distorceria o consumo.
    public const SALTO_MAXIMO = 5000;

    // $permitirMenor = true na aprovação: lá o km do caminhão pode ter avançado por outro lançamento
    // depois que o motorista enviou, então só o salto exagerado é conferido.
    public static function validar(int $km, int $kmAtual, bool $permitirMenor = false): void
    {
        $fmt = fn (int $n) => number_format($n, 0, ',', '.');

        if (! $permitirMenor && $km < $kmAtual) {
            throw ValidationException::withMessages([
                'km' => 'A quilometragem não pode ser menor que a atual (' . $fmt($kmAtual) . ' km).',
            ]);
        }

        if ($km - $kmAtual > self::SALTO_MAXIMO) {
            throw ValidationException::withMessages([
                'km' => 'A quilometragem aumentou ' . $fmt($km - $kmAtual) . ' km desde o último registro ('
                    . $fmt($kmAtual) . ' km). O limite é ' . $fmt(self::SALTO_MAXIMO)
                    . ' km. Confira o número digitado; se estiver certo, corrija o km do caminhão na Gestão de frota.',
            ]);
        }
    }
}