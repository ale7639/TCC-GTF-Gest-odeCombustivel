<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    public const ROLE_ADMIN = 'administrador';
    public const ROLE_SUPERVISOR = 'supervisor';
    public const ROLE_MOTORISTA = 'motorista';

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'is_active',
        'failed_login_attempts',
        'locked_until',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'locked_until' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'failed_login_attempts' => 'integer',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    public function isSupervisor(): bool
    {
        return $this->role === self::ROLE_SUPERVISOR;
    }

    public function isMotorista(): bool
    {
        return $this->role === self::ROLE_MOTORISTA;
    }

    public function canManageFleet(): bool
    {
        return in_array($this->role, [self::ROLE_ADMIN, self::ROLE_SUPERVISOR], true);
    }

    public function canSeeReports(): bool
    {
        return $this->canManageFleet();
    }

    public function isLocked(): bool
    {
        return $this->locked_until !== null && $this->locked_until->isFuture();
    }

    public function trucks(): HasMany
    {
        return $this->hasMany(Truck::class, 'driver_id');
    }

    public function fuelings(): HasMany
    {
        return $this->hasMany(Fueling::class);
    }
}
