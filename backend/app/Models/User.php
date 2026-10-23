<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    public const ADMIN = 'administrador';
    public const SUPERVISOR = 'supervisor';
    public const MOTORISTA = 'motorista';

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'is_active',
        'motorista_id',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    public function motorista(): BelongsTo
    {
        return $this->belongsTo(Motorista::class);
    }

    public function isAdmin(): bool
    {
        return $this->role === self::ADMIN;
    }

    public function isGestao(): bool
    {
        return in_array($this->role, [self::ADMIN, self::SUPERVISOR], true);
    }

    public function isMotorista(): bool
    {
        return $this->role === self::MOTORISTA;
    }

    public function toPublicArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'nome' => $this->name,
            'email' => $this->email,
            'role' => $this->role,
            'is_active' => (bool) $this->is_active,
            'motorista_id' => $this->motorista_id,
        ];
    }
}
