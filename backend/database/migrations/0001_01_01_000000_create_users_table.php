<?php

// =====================================================================================
// MIGRATION: tabela "users" (logins do sistema) + duas tabelas auxiliares do Laravel.
// Este arquivo VEIO PRONTO com o Laravel (por isso a data 0001_01_01: roda antes de todas).
//
// O que é uma migration: um arquivo que cria ou altera tabelas do banco.
//   up()   -> o que fazer ao rodar "php artisan migrate" (criar/alterar);
//   down() -> como desfazer, ao rodar "php artisan migrate:rollback".
// O Laravel anota na tabela "migrations" quais arquivos já rodaram, para não rodar duas vezes.
// Os arquivos rodam em ordem pelo NOME (a data no começo do nome define a ordem).
//
// No nosso sistema, "users" guarda o login do ADMIN e dos MOTORISTAS.
// Migrations posteriores mudaram esta tabela:
//   2026_11_10 -> colunas "perfil" (admin/motorista) e "motorista_id";
//   2026_11_20 -> "email" passou a ser opcional (motorista entra com CPF).
// =====================================================================================

// "use" importa as classes do Laravel usadas aqui.
use Illuminate\Database\Migrations\Migration; // classe base de toda migration
use Illuminate\Database\Schema\Blueprint;     // a "planta" da tabela: é nela que declaramos as colunas
use Illuminate\Support\Facades\Schema;        // comandos de estrutura: create, table, dropIfExists...

// "return new class extends Migration" = classe anônima (sem nome).
// O arquivo devolve um objeto da migration, e o Laravel chama up() ou down() nele.
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Schema::create('users', ...) = CREATE TABLE users.
        // Dentro da função, cada linha $table->... é uma coluna.
        Schema::create('users', function (Blueprint $table) {
            $table->id();                                      // id: chave primária, número que cresce sozinho (BIGINT AUTO_INCREMENT)
            $table->string('name');                            // nome (VARCHAR 255)
            $table->string('email')->unique();                 // e-mail, sem repetir (unique). Depois virou opcional (2026_11_20)
            $table->timestamp('email_verified_at')->nullable(); // data de verificação de e-mail (padrão do Laravel; não usamos)
            $table->string('password');                        // senha guardada como HASH (nunca a senha em texto)
            $table->rememberToken();                           // coluna "remember_token" (padrão do Laravel; não usamos)
            $table->timestamps();                              // created_at e updated_at, preenchidas sozinhas pelo Laravel
        });

        // Tabela do Laravel para "esqueci minha senha" (não usamos: o admin define a senha do motorista).
        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();                // primary = chave primária é o próprio e-mail
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        // Tabela de sessões do Laravel (login por cookie, usado em sites).
        // A nossa API usa TOKEN (Sanctum), guardado em personal_access_tokens.
        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index(); // index = deixa a busca por essa coluna mais rápida
            $table->string('ip_address', 45)->nullable();      // 45 caracteres cabem um IPv6
            $table->text('user_agent')->nullable();            // navegador/aparelho
            $table->longText('payload');                       // dados da sessão
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // dropIfExists = DROP TABLE, só se a tabela existir (não dá erro se já não existir).
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};