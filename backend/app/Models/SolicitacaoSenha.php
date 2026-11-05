<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SolicitacaoSenha extends Model
{
    protected $table = 'solicitacoes_senha';

    public const PENDENTE = 'pendente';
    public const ATENDIDA = 'atendida';

    protected $fillable = [
        'motorista_id', 'cpf', 'nome', 'status',
        'atendida_por', 'atendida_em',
    ];

    protected $casts = [
        'atendida_em' => 'datetime',
    ];

    public function motorista(): BelongsTo
    {
        return $this->belongsTo(Motorista::class);
    }

    public function atendente(): BelongsTo
    {
        return $this->belongsTo(User::class, 'atendida_por');
    }

    public function scopePendentes($query)
    {
        return $query->where('status', self::PENDENTE);
    }

    public function marcarAtendida(User $admin): void
    {
        $this->update([
            'status' => self::ATENDIDA,
            'atendida_por' => $admin->id,
            'atendida_em' => now(),
        ]);
    }
}
