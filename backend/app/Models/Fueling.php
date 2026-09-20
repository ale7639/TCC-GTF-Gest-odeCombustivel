<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Fueling extends Model
{
    public $timestamps = true;

    protected $fillable = [
        'truck_id',
        'user_id',
        'quantity_liters',
        'tank_before',
        'tank_after',
        'truck_before',
        'truck_after',
        'km_at_fueling',
        'ip_address',
    ];

    protected function casts(): array
    {
        return [
            'quantity_liters' => 'decimal:2',
            'tank_before' => 'decimal:2',
            'tank_after' => 'decimal:2',
            'truck_before' => 'decimal:2',
            'truck_after' => 'decimal:2',
            'km_at_fueling' => 'integer',
        ];
    }

    public function truck(): BelongsTo
    {
        return $this->belongsTo(Truck::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
