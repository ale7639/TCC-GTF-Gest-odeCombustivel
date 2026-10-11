<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EntradaCombustivel extends Model
{
    use HasFactory;

    protected $table = 'entradas_combustivel';

    protected $fillable = ['tanque_id', 'nota_fiscal_id', 'data', 'litros', 'valor_total'];

    protected $casts = [
        'data'        => 'date',
        'litros'      => 'decimal:2',
        'valor_total' => 'decimal:2',
    ];

    public function tanque(): BelongsTo
    {
        return $this->belongsTo(Tanque::class);
    }

    // O nome do método é notaFiscal; o Laravel deduz a coluna nota_fiscal_id.
    public function notaFiscal(): BelongsTo
    {
        return $this->belongsTo(NotaFiscal::class);
    }
}