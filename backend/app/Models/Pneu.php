<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Pneu extends Model
{
    protected $table = 'pneus';

    protected $fillable = [
        'caminhao_id', 'posicao', 'data_troca', 'km_troca',
        'intervalo_km', 'observacao',
    ];

    protected $casts = [
        'data_troca' => 'date',
        'km_troca' => 'integer',
        'intervalo_km' => 'integer',
    ];

    protected $appends = ['alerta', 'proxima_km', 'km_restantes'];

    public function caminhao(): BelongsTo
    {
        return $this->belongsTo(Caminhao::class);
    }

    public function getProximaKmAttribute(): ?int
    {
        if ($this->km_troca === null) {
            return null;
        }

        return (int) $this->km_troca + (int) ($this->intervalo_km ?: 60000);
    }

    public function getKmRestantesAttribute(): ?int
    {
        $proxima = $this->proxima_km;
        $km = $this->caminhao?->km_atual;
        if ($proxima === null || $km === null) {
            return null;
        }

        return $proxima - (int) $km;
    }

    public function getAlertaAttribute(): string
    {
        if ($this->km_troca === null && $this->data_troca === null) {
            return 'sem_registro';
        }
        $restantes = $this->km_restantes;
        if ($restantes === null) {
            return 'ok';
        }
        if ($restantes <= 0) {
            return 'atrasado';
        }
        if ($restantes <= 5000) {
            return 'proximo';
        }

        return 'ok';
    }
}
