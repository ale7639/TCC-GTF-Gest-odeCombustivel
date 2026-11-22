<?php

// =====================================================================================
// AdminSeeder — cria o usuário ADMINISTRADOR do sistema.
//
// O que é um seeder: uma classe que coloca dados iniciais no banco (a "semente").
// Roda com:  php artisan db:seed          (só os seeders)
//       ou:  php artisan migrate:fresh --seed   (apaga tudo, recria as tabelas e roda os seeders)
// Quem chama este arquivo: o DatabaseSeeder ($this->call(AdminSeeder::class)).
//
// Por que o admin nasce aqui e não numa tela de cadastro: não existe cadastro público de
// administrador (seria uma falha de segurança: qualquer um criaria uma conta com acesso total).
// O admin é criado na instalação; os motoristas são cadastrados depois pelo próprio admin.
//
// Login criado: admin@frota.com  |  senha: admin123   (trocar num sistema de verdade)
// =====================================================================================

namespace Database\Seeders;

use App\Models\Motorista;
use App\Models\User;
use Illuminate\Database\Seeder;            // classe base de todo seeder
use Illuminate\Support\Facades\Hash;       // Hash::make = transforma a senha em hash (bcrypt)

class AdminSeeder extends Seeder
{
    // run() é o método que o Laravel executa quando o seeder roda.
    public function run(): void
    {
        // firstOrCreate evita duplicar: se o e-mail já existe, não cria de novo.
        // 1º array = como PROCURAR (pelo e-mail);
        // 2º array = o que preencher, só se for criar.
        // O perfil não é informado: a coluna "perfil" tem valor padrão 'admin'
        // (migration 2026_11_10_000000_perfil_motorista_e_aprovacoes), então ele já nasce admin.
        User::firstOrCreate(
            ['email' => 'admin@frota.com'],
            ['name' => 'Administrador', 'password' => 'admin123', 'role' => User::ADMIN, 'is_active' => true]
        );
    }
}