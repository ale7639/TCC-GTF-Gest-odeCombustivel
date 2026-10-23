<?php

namespace App\Support;

class StorageUrl
{
    public static function public(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        return '/storage/'.$path;
    }
}
