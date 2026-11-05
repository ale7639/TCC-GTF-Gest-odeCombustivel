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
        $senhaCpf = $joaoFicha?->senhaPadrao() ?: '11111111111';

        $joao = User::firstOrCreate(
            ['email' => 'joao@gfc.com.br'],
            [
                'name' => 'João Santos',
                'password' => $senhaCpf,
                'role' => User::MOTORISTA,
                'is_active' => true,
                'motorista_id' => $joaoFicha?->id,
            ]
        );

        // Garante senha = CPF (dígitos), mesmo se o usuário já existia com Senha123.
        $joao->password = $senhaCpf;
        $joao->role = User::MOTORISTA;
        $joao->is_active = true;
        if ($joaoFicha) {
            $joao->motorista_id = $joaoFicha->id;
        }
        $joao->save();

        User::firstOrCreate(
            ['email' => 'admin@frota.com'],
            ['name' => 'Administrador', 'password' => 'admin123', 'role' => User::ADMIN, 'is_active' => true]
        );
    }
}