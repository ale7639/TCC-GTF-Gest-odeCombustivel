<?php

namespace App\Models;

use App\Services\ChecklistService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Truck extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'plate',
        'name',
        'model',
        'fuel_type',
        'tank_capacity',
        'current_liters',
        'current_km',
        'sector',
        'driver_id',
        'wash_frequency_days',
        'next_maintenance_date',
        'next_maintenance_km',
        'crlv_expires_at',
        'insurance_expires_at',
        'license_expires_at',
        'photo_url',
        'status',
        'last_verified_at',
        'last_verified_by',
    ];

    protected function casts(): array
    {
        return [
            'tank_capacity' => 'decimal:2',
            'current_liters' => 'decimal:2',
            'current_km' => 'integer',
            'wash_frequency_days' => 'integer',
            'next_maintenance_km' => 'integer',
            'next_maintenance_date' => 'date',
            'crlv_expires_at' => 'date',
            'insurance_expires_at' => 'date',
            'license_expires_at' => 'date',
            'last_verified_at' => 'datetime',
        ];
    }

    public function remainingCapacity(): float
    {
        return max(0, (float) $this->tank_capacity - (float) $this->current_liters);
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'last_verified_by');
    }

    public function fuelings(): HasMany
    {
        return $this->hasMany(Fueling::class);
    }

    public function maintenances(): HasMany
    {
        return $this->hasMany(Maintenance::class);
    }

    public function washes(): HasMany
    {
        return $this->hasMany(Wash::class);
    }

    public function alerts(): HasMany
    {
        return $this->hasMany(Alert::class);
    }

    public function checklist(): array
    {
        return app(ChecklistService::class)->forTruck($this);
    }
}
