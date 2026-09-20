<?php

namespace App\Support;

class PasswordRules
{
    public static function regex(): string
    {
        return '/^(?=.*[A-Z])(?=.*\d).{8,}$/';
    }

    public static function message(): string
    {
        return 'A senha deve ter no mínimo 8 caracteres, incluindo uma letra maiúscula e um número.';
    }
}
