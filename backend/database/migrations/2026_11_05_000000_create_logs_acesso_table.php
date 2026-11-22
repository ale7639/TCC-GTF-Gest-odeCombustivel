<?php

// =====================================================================================
// MIGRATION: tabela "logs_acesso" — AUDITORIA de login e logout.
//
// Quem grava: AuthController (a cada tentativa de login, certa ou errada, e a cada logout).
// Quem lê: LogAcessoController (tela "Log de acesso", só o admin).
// Serve para ver quem entrou, quando, de onde, e as tentativas de senha errada.
// =====================================================================================

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Uma linha para cada tentativa de login (certa ou errada) e para cada saída.
        Schema::create('logs_acesso', function (Blueprint $table) {
            $table->id();
            // Quem era (nulo quando o login digitado não existe).
            // nullOnDelete: se o usuário for apagado, o histórico continua, só sem o vínculo.
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            // O que foi digitado. O nome é "email", mas hoje guarda o e-mail do admin OU o CPF do motorista.
            $table->string('email');                        // e-mail digitado (existe mesmo quando o login falha)
            $table->string('evento', 20);                   // 'login' ou 'logout'
            $table->boolean('sucesso')->default(true);
            $table->string('motivo')->nullable();           // ex.: "Senha incorreta"
            $table->string('ip', 45)->nullable();           // de onde veio (aceita IPv6)
            $table->string('dispositivo')->nullable();      // ex.: "Chrome · Windows"
            $table->timestamps();                           // created_at = quando aconteceu

            // Índice na data: a tela lista do mais recente para o mais antigo, e o índice deixa isso rápido.
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('logs_acesso');
    }
};