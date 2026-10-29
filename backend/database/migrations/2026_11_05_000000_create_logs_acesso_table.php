<?php

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
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('email');                        // e-mail digitado (existe mesmo quando o login falha)
            $table->string('evento', 20);                   // 'login' ou 'logout'
            $table->boolean('sucesso')->default(true);
            $table->string('motivo')->nullable();           // ex.: "Senha incorreta"
            $table->string('ip', 45)->nullable();           // de onde veio (aceita IPv6)
            $table->string('dispositivo')->nullable();      // ex.: "Chrome · Windows"
            $table->timestamps();

            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('logs_acesso');
    }
};