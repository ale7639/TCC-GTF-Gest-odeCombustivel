<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificacaoLeitura extends Model
{
    protected $table = 'notificacao_leituras';

    protected $fillable = [
        'user_id',
        'chave',
        'lida_em',
    ];

    protected function casts(): array
    {
        return [
            'lida_em' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
