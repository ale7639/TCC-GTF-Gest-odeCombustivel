<?php

namespace App\Support;

class Plate
{
    public static function normalize(string $plate): string
    {
        $clean = preg_replace('/[^A-Z0-9]/', '', strtoupper($plate)) ?? '';

        if (preg_match('/^[A-Z]{3}\d{4}$/', $clean)) {
            return substr($clean, 0, 3).'-'.substr($clean, 3);
        }

        return $clean;
    }

    public static function isValid(string $plate): bool
    {
        $normalized = self::normalize($plate);

        return (bool) preg_match('/^([A-Z]{3}-\d{4}|[A-Z]{3}\d[A-Z]\d{2})$/', $normalized);
    }
}
