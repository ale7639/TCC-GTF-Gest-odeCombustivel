<?php

namespace App\Policies;

use App\Models\Caminhao;
use App\Models\User;

class CaminhaoPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Caminhao $caminhao): bool
    {
        return $this->alcance($user, $caminhao);
    }

    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    public function update(User $user, Caminhao $caminhao): bool
    {
        return $user->isAdmin();
    }

    public function delete(User $user, Caminhao $caminhao): bool
    {
        return $user->isAdmin();
    }

    public function abastecer(User $user, Caminhao $caminhao): bool
    {
        return $this->alcance($user, $caminhao);
    }

    public function operar(User $user, Caminhao $caminhao): bool
    {
        if ($user->isGestao()) {
            return true;
        }

        return $this->alcance($user, $caminhao);
    }

    private function alcance(User $user, Caminhao $caminhao): bool
    {
        if ($user->isGestao()) {
            return true;
        }

        return $user->isMotorista()
            && $user->motorista_id
            && (int) $caminhao->motorista_id === (int) $user->motorista_id;
    }
}
