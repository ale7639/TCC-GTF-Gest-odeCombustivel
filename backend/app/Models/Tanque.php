<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tanque extends Model
{
    use HasFactory;

    protected $fillable = ['nome', 'tipo_combustivel', 'capacidade', 'nivel_atual'];

    protected $casts = [
        'capacidade'  => 'decimal:2',
        'nivel_atual' => 'decimal:2',
    ];

    // Combustível que chegou no tanque.
    public function entradas(): HasMany
    {
        return $this->hasMany(EntradaCombustivel::class);
    }

    // Combustível que saiu do tanque para os caminhões.
    public function abastecimentos(): HasMany
    {
        return $this->hasMany(Abastecimento::class);
    }
}