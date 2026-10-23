<?php

namespace Database\Seeders;

use App\Models\Motorista;
use App\Models\User;
use Illuminate\Database\Seeder;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        User::firstOrCreate(
            ['email' => 'diego@gfc.com.br'],
            ['name' => 'Diego Silva', 'password' => 'Senha123', 'role' => User::ADMIN, 'is_active' => true]
        );

        User::firstOrCreate(
            ['email' => 'ana@gfc.com.br'],
            ['name' => 'Ana Souza', 'password' => 'Senha123', 'role' => User::SUPERVISOR, 'is_active' => true]
        );

        $joaoFicha = Motorista::where('cpf', '111.111.111-11')->first();

        User::firstOrCreate(
            ['email' => 'joao@gfc.com.br'],
            [
                'name' => 'João Santos',
                'password' => 'Senha123',
                'role' => User::MOTORISTA,
                'is_active' => true,
                'motorista_id' => $joaoFicha?->id,
            ]
        );

        User::firstOrCreate(
            ['email' => 'admin@frota.com'],
            ['name' => 'Administrador', 'password' => 'admin123', 'role' => User::ADMIN, 'is_active' => true]
        );
    }
}
