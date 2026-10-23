<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConciliacaoTanque extends Model
{
    protected $table = 'conciliacoes_tanque';

    protected $fillable = [
        'tanque_id', 'user_id', 'data', 'nivel_informado',
        'entradas_dia', 'saidas_dia', 'nivel_calculado',
        'variacao', 'alerta', 'observacao',
    ];

    protected $casts = [
        'data' => 'date',
        'nivel_informado' => 'decimal:2',
        'entradas_dia' => 'decimal:2',
        'saidas_dia' => 'decimal:2',
        'nivel_calculado' => 'decimal:2',
        'variacao' => 'decimal:2',
        'alerta' => 'boolean',
    ];

    public function tanque(): BelongsTo
    {
        return $this->belongsTo(Tanque::class);
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
