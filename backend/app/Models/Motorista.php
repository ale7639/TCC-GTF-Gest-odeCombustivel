<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Motorista extends Model
{
    use HasFactory;

    protected $fillable = ['nome', 'cpf', 'cnh', 'telefone', 'ativo'];

    protected $casts = ['ativo' => 'boolean'];

    // Um motorista é responsável por um caminhão.
    // A chave estrangeira (motorista_id) está na tabela caminhoes.
    public function caminhao(): HasOne
    {
        return $this->hasOne(Caminhao::class);
    }

    /** Senha inicial sugerida = CPF só com dígitos (ex.: 09666897989). */
    public function senhaPadrao(): string
    {
        return self::cpfDigitos($this->cpf);
    }

    public static function cpfDigitos(?string $cpf): string
    {
        return preg_replace('/\D+/', '', (string) $cpf) ?: '';
    }

    public static function formatarCpf(string $digitos): string
    {
        $d = self::cpfDigitos($digitos);

        return substr($d, 0, 3).'.'.substr($d, 3, 3).'.'.substr($d, 6, 3).'-'.substr($d, 9, 2);
    }

    /** E-mail interno só para a tabela users (login do app é pelo CPF). */
    public function emailAcessoInterno(): string
    {
        return 'm'.self::cpfDigitos($this->cpf).'@frota.local';
    }
}