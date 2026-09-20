<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Alert extends Model
{
    public const TYPE_MAINTENANCE = 'manutencao_vencida';
    public const TYPE_WASH = 'lavagem_atrasada';
    public const TYPE_FUEL = 'combustivel_baixo';
    public const TYPE_DOCS = 'documentacao_vencer';

    protected $fillable = [
        'type',
        'title',
        'description',
        'truck_id',
        'is_read',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'is_read' => 'boolean',
            'meta' => 'array',
        ];
    }

    public function truck(): BelongsTo
    {
        return $this->belongsTo(Truck::class);
    }
}
