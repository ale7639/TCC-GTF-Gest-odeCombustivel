<?php

namespace App\Models;

use App\Support\StorageUrl;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChecklistPreViagem extends Model
{
    protected $table = 'checklists_pre_viagem';

    protected $fillable = [
        'caminhao_id', 'motorista_id', 'user_id', 'data', 'status',
        'itens', 'foto_path', 'observacao', 'manutencao_id',
    ];

    protected $casts = [
        'data' => 'date',
        'itens' => 'array',
    ];

    protected $appends = ['foto_url'];

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

    public function manutencao(): BelongsTo
    {
        return $this->belongsTo(Manutencao::class);
    }

    public function getFotoUrlAttribute(): ?string
    {
        return StorageUrl::public($this->foto_path);
    }
}
