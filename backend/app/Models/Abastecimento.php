<?php

namespace App\Models;

use App\Support\StorageUrl;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\URL;

class Abastecimento extends Model
{
    use HasFactory;

    protected $fillable = [
        'caminhao_id', 'motorista_id', 'user_id', 'tanque_id',
        'origem', 'posto', 'comprovante_path',
        'nota_numero', 'valor_total', 'foto', 'status', 'motivo_recusa',
        'custo_litro', 'custo_total',
        'data', 'litros', 'km', 'motivo_excesso',
    ];

    protected $casts = [
        'data' => 'date',
        'litros' => 'decimal:2',
        'km' => 'integer',
        'custo_litro' => 'decimal:4',
        'custo_total' => 'decimal:4',
        'valor_total' => 'decimal:2',
    ];

    protected $appends = ['comprovante_url'];

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

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function getComprovanteUrlAttribute(): ?string
    {
        return StorageUrl::public($this->comprovante_path);
    }

    /** URL assinada (2h) da foto privada — fluxo mobile/Wallace. */
    public function fotoUrl(): ?string
    {
        return $this->foto
            ? URL::temporarySignedRoute('abastecimentos.foto', now()->addHours(2), ['abastecimento' => $this->id])
            : null;
    }
}
