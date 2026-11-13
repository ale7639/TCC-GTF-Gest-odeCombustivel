<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\URL;

class NotaFiscal extends Model
{
    use HasFactory;

    protected $table = 'notas_fiscais';

    protected $fillable = [
        'numero', 'fornecedor', 'data_emissao', 'valor_total', 'chave_acesso', 'foto',
        'categoria', 'descricao', 'caminhao_id',
    ];

    protected $casts = [
        'data_emissao' => 'date',
        'valor_total'  => 'decimal:2',
    ];

    public function entradas(): HasMany
    {
        return $this->hasMany(EntradaCombustivel::class);
    }

    public function manutencoes(): HasMany
    {
        return $this->hasMany(Manutencao::class);
    }

    // Endereço temporário (2 horas) da foto. A foto fica fora da pasta pública;
    // só quem recebe este endereço assinado consegue abri-la.
    public function fotoUrl(): ?string
    {
        return $this->foto
            ? URL::temporarySignedRoute('notas-fiscais.foto', now()->addHours(2), ['nota' => $this->id])
            : null;
    }
}
