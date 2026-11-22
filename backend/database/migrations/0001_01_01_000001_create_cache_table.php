<?php

// =====================================================================================
// MIGRATION: tabelas de CACHE do Laravel. VEIO PRONTA com o Laravel.
//
// Cache = guardar um resultado por um tempo para não recalcular.
// No nosso .env, CACHE_STORE=database: o cache fica nestas tabelas do MySQL.
// Quem usa no nosso sistema: o RateLimiter do login (conta as senhas erradas
// e bloqueia por 15 minutos depois de 5 erros) guarda esse contador no cache.
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
        // Cada linha é um valor guardado: uma chave, o valor e quando expira.
        Schema::create('cache', function (Blueprint $table) {
            $table->string('key')->primary();          // nome do item (ex.: o contador de erros de um login)
            $table->mediumText('value');               // o valor guardado
            $table->integer('expiration')->index();    // quando vence (em segundos, formato "timestamp")
        });

        // "Travas" do cache: impedem que dois processos mexam no mesmo item ao mesmo tempo.
        Schema::create('cache_locks', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->string('owner');                   // quem está com a trava
            $table->integer('expiration')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cache');
        Schema::dropIfExists('cache_locks');
    }
};