<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\URL;

class Abastecimento extends Model
{
    use HasFactory;

    protected $fillable = [
        'caminhao_id', 'motorista_id', 'tanque_id', 'data', 'litros', 'km', 'custo_litro', 'custo_total',
        'origem', 'posto', 'nota_numero', 'valor_total', 'foto', 'status', 'motivo_recusa',
    ];

    protected $casts = [
        'data'        => 'date',
        'litros'      => 'decimal:2',
        'custo_litro' => 'decimal:4',
        'custo_total' => 'decimal:4',
        'valor_total' => 'decimal:2',
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

    // Endereço temporário (2 horas) da foto. A foto fica guardada fora da pasta pública;
    // só quem recebe este endereço assinado consegue abri-la.
    public function fotoUrl(): ?string
    {
        return $this->foto
            ? URL::temporarySignedRoute('abastecimentos.foto', now()->addHours(2), ['abastecimento' => $this->id])
            : null;
    }
}