<?php

// =====================================================================================
// MIGRATION: tabela "personal_access_tokens" — os TOKENS de login do Laravel Sanctum.
// Esta migration é criada pelo próprio Sanctum (pacote de autenticação por token).
//
// Como funciona no nosso sistema:
//   1) o usuário faz login (AuthController) e o servidor cria uma linha aqui;
//   2) o app recebe o token e o manda em toda requisição (Authorization: Bearer ...);
//   3) o middleware auth:sanctum procura o token nesta tabela para saber quem é o usuário;
//   4) no logout, a linha é apagada (o token deixa de valer).
// Trocar a senha de um motorista apaga os tokens dele (derruba as sessões abertas).
// =====================================================================================

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            // morphs('tokenable') cria DUAS colunas: tokenable_type (ex.: "App\Models\User")
            // e tokenable_id (o id do usuário). Assim o token pode pertencer a qualquer tipo de model.
            $table->morphs('tokenable');
            $table->text('name');                                  // nome do token (no nosso caso, "app-mobile")
            // O token é guardado como HASH (64 caracteres): nem quem lê o banco consegue usá-lo.
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();                 // permissões do token (não usamos: "*" = tudo)
            $table->timestamp('last_used_at')->nullable();         // último uso
            $table->timestamp('expires_at')->nullable()->index();  // quando vence (se houver vencimento)
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('personal_access_tokens');
    }
};