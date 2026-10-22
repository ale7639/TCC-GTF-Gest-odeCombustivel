<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Manutencao extends Model
{
    use HasFactory;

    protected $table = 'manutencoes';

    protected $fillable = [
        'caminhao_id', 'motorista_id', 'nota_fiscal_id',
        'data', 'tipo', 'descricao', 'valor', 'km',
    ];

    protected $casts = [
        'data'  => 'date',
        'valor' => 'decimal:2',
    ];

    public function caminhao(): BelongsTo
    {
        return $this->belongsTo(Caminhao::class);
    }

    public function motorista(): BelongsTo
    {
        return $this->belongsTo(Motorista::class);
    }

    public function notaFiscal(): BelongsTo
    {
        return $this->belongsTo(NotaFiscal::class);
    }
}