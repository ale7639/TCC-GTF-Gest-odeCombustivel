<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Wash extends Model
{
    protected $fillable = [
        'truck_id',
        'user_id',
        'washed_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'washed_at' => 'datetime',
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
