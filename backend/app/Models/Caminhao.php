<?php

namespace App\Models;

use App\Support\Consumo;
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

    protected $casts = [
        'capacidade_tanque' => 'decimal:2',
        'km_atual' => 'integer',
        'ano' => 'integer',
    ];

    protected $appends = ['media_km_l'];

    public function motorista(): BelongsTo
    {
        return $this->belongsTo(Motorista::class);
    }

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

    public function getMediaKmLAttribute(): ?float
    {
        return Consumo::mediaCaminhao($this);
    }
}
