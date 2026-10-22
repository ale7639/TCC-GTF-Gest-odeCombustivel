<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Abastecimento extends Model
{
    use HasFactory;

    protected $fillable = ['caminhao_id', 'motorista_id', 'tanque_id', 'data', 'litros', 'km'];

    protected $casts = [
        'data'   => 'date',
        'litros' => 'decimal:2',
    ];

    public function caminhao(): BelongsTo
    {
        return $this->belongsTo(Caminhao::class);
    }

    public function motorista(): BelongsTo
    {
        return $this->belongsTo(Motorista::class);
    }

    public function tanque(): BelongsTo
    {
        return $this->belongsTo(Tanque::class);
    }
}