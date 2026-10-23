<?php

namespace App\Models;

use App\Support\Consumo;
use App\Support\Oleo;
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
        'km_atual', 'oleo_ultima_data', 'oleo_ultima_km',
        'oleo_intervalo_km', 'oleo_proxima_data',
        'status', 'crlv_validade', 'seguro_validade', 'meta_km_l',
        'motorista_id',
    ];

    protected $casts = [
        'capacidade_tanque' => 'decimal:2',
        'km_atual' => 'integer',
        'ano' => 'integer',
        'oleo_ultima_data' => 'date',
        'oleo_proxima_data' => 'date',
        'oleo_ultima_km' => 'integer',
        'oleo_intervalo_km' => 'integer',
        'crlv_validade' => 'date',
        'seguro_validade' => 'date',
        'meta_km_l' => 'decimal:2',
    ];

    protected $appends = ['media_km_l', 'oleo'];

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

    public function pneus(): HasMany
    {
        return $this->hasMany(Pneu::class);
    }

    public function checklistsPreViagem(): HasMany
    {
        return $this->hasMany(ChecklistPreViagem::class);
    }

    public function multas(): HasMany
    {
        return $this->hasMany(Multa::class);
    }

    public function getMediaKmLAttribute(): ?float
    {
        return Consumo::mediaCaminhao($this);
    }

    public function getOleoAttribute(): array
    {
        return Oleo::resumo($this);
    }
}
