<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tanque extends Model
{
    use HasFactory;

    protected $fillable = [
        'nome', 'tipo_combustivel', 'capacidade', 'nivel_atual', 'valor_estoque', 'principal',
    ];

    protected $casts = [
        'capacidade'    => 'decimal:2',
        'nivel_atual'   => 'decimal:2',
        'valor_estoque' => 'decimal:4',
        'principal'     => 'boolean',
    ];

    // Faz o custo_medio aparecer automaticamente nas respostas da API.
    protected $appends = ['custo_medio'];

    // Custo médio por litro do combustível que está no tanque: valor do estoque ÷ litros no tanque.
    // Fica vazio (null) quando o tanque está vazio.
    public function getCustoMedioAttribute(): ?float
    {
        $nivel = (float) $this->nivel_atual;

        return $nivel > 0 ? round((float) $this->valor_estoque / $nivel, 4) : null;
    }

    // Combustível que chegou no tanque.
    public function entradas(): HasMany
    {
        return $this->hasMany(EntradaCombustivel::class);
    }

    // Combustível que saiu do tanque para os caminhões.
    public function abastecimentos(): HasMany
    {
        return $this->hasMany(Abastecimento::class);
    }
}