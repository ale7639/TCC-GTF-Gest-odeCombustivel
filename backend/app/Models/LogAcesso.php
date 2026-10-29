<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LogAcesso extends Model
{
    protected $table = 'logs_acesso';

    protected $fillable = ['user_id', 'email', 'evento', 'sucesso', 'motivo', 'ip', 'dispositivo'];

    protected $casts = ['sucesso' => 'boolean'];

    // Resume o "user agent" do navegador em algo legível: "Chrome · Windows".
    public static function resumirDispositivo(?string $ua): string
    {
        if (! $ua) return 'Desconhecido';

        $navegador = match (true) {
            str_contains($ua, 'Edg/')    => 'Edge',
            str_contains($ua, 'OPR/')    => 'Opera',
            str_contains($ua, 'Chrome')  => 'Chrome',
            str_contains($ua, 'Firefox') => 'Firefox',
            str_contains($ua, 'Safari')  => 'Safari',
            str_contains($ua, 'okhttp'), str_contains($ua, 'Expo') => 'App',
            default                      => 'Outro',
        };
        $sistema = match (true) {
            str_contains($ua, 'Windows') => 'Windows',
            str_contains($ua, 'Android') => 'Android',
            str_contains($ua, 'iPhone'), str_contains($ua, 'iPad') => 'iOS',
            str_contains($ua, 'Mac OS')  => 'macOS',
            str_contains($ua, 'Linux')   => 'Linux',
            default                      => 'Sistema desconhecido',
        };

        return "$navegador · $sistema";
    }
}