<?php

namespace App\Models;

use App\Support\WhatsApp;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Motorista extends Model
{
    use HasFactory;

    protected $fillable = [
        'nome', 'cpf', 'cnh', 'cnh_validade', 'telefone',
        'limite_litros_dia', 'credito_litros_mes', 'ativo',
    ];

    protected $casts = [
        'ativo' => 'boolean',
        'cnh_validade' => 'date',
        'limite_litros_dia' => 'decimal:2',
        'credito_litros_mes' => 'decimal:2',
    ];

    protected $appends = ['whatsapp_url'];

    public function caminhao(): HasOne
    {
        return $this->hasOne(Caminhao::class);
    }

    public function abastecimentos(): HasMany
    {
        return $this->hasMany(Abastecimento::class);
    }

    public function getWhatsappUrlAttribute(): ?string
    {
        return WhatsApp::link($this->telefone);
    }
}
