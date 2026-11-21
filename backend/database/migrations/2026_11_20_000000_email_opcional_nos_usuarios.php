<?php

// =====================================================================================
// MIGRATION: o "email" dos usuários passa a ser OPCIONAL.
// Motivo: o motorista faz login com o CPF (que está no cadastro dele, tabela motoristas),
// então o login dele não precisa de e-mail. O admin continua entrando com e-mail.
// Quem usa: AuthController (decide pelo que foi digitado: com "@" é e-mail; 11 números é CPF),
// MotoristaController (cria o login do motorista sem e-mail).
// =====================================================================================

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // O motorista entra com o CPF, então o login dele não precisa de e-mail.
    // O e-mail continua único para quem tem (o admin); vários motoristas podem ficar sem e-mail.
    // (No MySQL, o "unique" não impede vários NULL: valores vazios não contam como repetidos.)
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Desfaz: volta a ser obrigatório (só funciona se nenhum usuário estiver sem e-mail).
        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable(false)->change();
        });
    }
};