<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Lavagem extends Model
{
    use HasFactory;

    protected $table = 'lavagens';

    protected $fillable = ['caminhao_id', 'motorista_id', 'data', 'valor', 'observacao'];

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
}