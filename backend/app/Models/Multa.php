<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Multa extends Model
{
    protected $fillable = [
        'caminhao_id', 'motorista_id', 'user_id',
        'data', 'valor', 'descricao', 'prazo', 'status',
    ];

    protected $casts = [
        'data' => 'date',
        'prazo' => 'date',
        'valor' => 'decimal:2',
    ];

    protected $appends = ['atrasada'];

    public function caminhao(): BelongsTo
    {
        return $this->belongsTo(Caminhao::class);
    }

    public function motorista(): BelongsTo
    {
        return $this->belongsTo(Motorista::class);
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function getAtrasadaAttribute(): bool
    {
        if ($this->status === 'pago' || ! $this->prazo) {
            return false;
        }

        return $this->prazo->isPast();
    }
}
