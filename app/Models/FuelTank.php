<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FuelTank extends Model
{
    protected $fillable = [
        'name',
        'capacity_liters',
        'current_liters',
    ];

    protected function casts(): array
    {
        return [
            'capacity_liters' => 'decimal:2',
            'current_liters' => 'decimal:2',
        ];
    }

    public function percent(): float
    {
        if ((float) $this->capacity_liters <= 0) {
            return 0;
        }

        return round(((float) $this->current_liters / (float) $this->capacity_liters) * 100, 1);
    }

    public function remainingCapacity(): float
    {
        return max(0, (float) $this->capacity_liters - (float) $this->current_liters);
    }

    public function isCritical(): bool
    {
        return $this->percent() < 20;
    }
}
