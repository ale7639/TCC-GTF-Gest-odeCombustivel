<?php

namespace App\Policies;

use App\Models\Truck;
use App\Models\User;

class TruckPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Truck $truck): bool
    {
        if ($user->isMotorista()) {
            return (int) $truck->driver_id === (int) $user->id;
        }

        return true;
    }

    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    public function update(User $user, Truck $truck): bool
    {
        return $user->isAdmin();
    }

    public function delete(User $user, Truck $truck): bool
    {
        return $user->isAdmin();
    }
}
