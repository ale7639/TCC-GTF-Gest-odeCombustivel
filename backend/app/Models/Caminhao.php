<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Caminhao extends Model
{
    use HasFactory;

    protected $table = 'caminhoes';

    protected $fillable = [
        'placa', 'modelo', 'ano', 'capacidade_tanque',
        'km_atual', 'status', 'motorista_id',
    ];

    protected $casts = ['capacidade_tanque' => 'decimal:2'];

    // O caminhão pertence a um motorista (a coluna motorista_id está nele).
    public function motorista(): BelongsTo
    {
        return $this->belongsTo(Motorista::class);
    }

    // Um caminhão tem muitos abastecimentos, lavagens e manutenções.
    public function abastecimentos(): HasMany
    {
        return $this->hasMany(Abastecimento::class);
    }

    public function lavagens(): HasMany
    {
        return $this->hasMany(Lavagem::class);
    }

    public function manutencoes(): HasMany
    {
        return $this->hasMany(Manutencao::class);
    }
}