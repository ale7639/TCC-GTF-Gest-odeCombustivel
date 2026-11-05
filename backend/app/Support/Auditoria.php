<?php

namespace App\Support;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class Auditoria
{
    public static function registrar(string $action, ?Model $entity = null, array $payload = []): void
    {
        $userId = auth()->id();
        if (! $userId && $entity instanceof User) {
            $userId = $entity->id;
        }

        AuditLog::create([
            'user_id' => $userId,
            'action' => $action,
            'entity_type' => $entity ? class_basename($entity) : null,
            'entity_id' => $entity?->getKey(),
            'payload' => $payload ?: null,
            'ip_address' => request()?->ip(),
        ]);
    }
}
