<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Maintenance extends Model
{
    protected $fillable = [
        'truck_id',
        'user_id',
        'service_date',
        'km',
        'description',
        'next_date',
        'next_km',
    ];

    protected function casts(): array
    {
        return [
            'service_date' => 'date',
            'next_date' => 'date',
            'km' => 'integer',
            'next_km' => 'integer',
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
