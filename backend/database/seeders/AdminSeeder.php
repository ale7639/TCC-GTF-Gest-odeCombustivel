<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        // firstOrCreate evita duplicar: se o e-mail já existe, não cria de novo.
        User::firstOrCreate(
            ['email' => 'admin@frota.com'],
            ['name' => 'Administrador', 'password' => Hash::make('admin123')]
        );
    }
}