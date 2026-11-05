<?php

namespace App\Support;

class WhatsApp
{
    public static function link(?string $telefone): ?string
    {
        $digitos = preg_replace('/\D/', '', (string) $telefone);
        if ($digitos === '') {
            return null;
        }
        if (strlen($digitos) === 10 || strlen($digitos) === 11) {
            $digitos = '55'.$digitos;
        }
        if (strlen($digitos) < 12) {
            return null;
        }

        return 'https://wa.me/'.$digitos;
    }
}
