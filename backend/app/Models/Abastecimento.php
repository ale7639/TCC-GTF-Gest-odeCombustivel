<?php

namespace App\Models;

use App\Support\StorageUrl;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Abastecimento extends Model
{
    use HasFactory;

    protected $fillable = [
        'caminhao_id', 'motorista_id', 'user_id', 'tanque_id',
        'origem', 'posto', 'comprovante_path',
        'data', 'litros', 'km',
    ];

    protected $casts = [
        'data' => 'date',
        'litros' => 'decimal:2',
        'km' => 'integer',
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
}
