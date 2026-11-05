<?php

namespace App\Models;

use App\Support\StorageUrl;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class NotaFiscal extends Model
{
    use HasFactory;

    protected $table = 'notas_fiscais';

    protected $fillable = [
        'numero', 'fornecedor', 'data_emissao', 'valor_total', 'chave_acesso', 'comprovante_path',
    ];

    protected $casts = [
        'data_emissao' => 'date',
        'valor_total' => 'decimal:2',
    ];

    protected $appends = ['comprovante_url'];

    public function entradas(): HasMany
    {
        return $this->hasMany(EntradaCombustivel::class);
    }

    public function manutencoes(): HasMany
    {
        return $this->hasMany(Manutencao::class);
    }

    public function getComprovanteUrlAttribute(): ?string
    {
        return StorageUrl::public($this->comprovante_path);
    }
}
