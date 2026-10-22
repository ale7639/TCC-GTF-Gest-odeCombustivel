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
}