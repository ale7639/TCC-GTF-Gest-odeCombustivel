<?php

// =====================================================================================
// MIGRATION: tabelas de FILAS (jobs) do Laravel. VEIO PRONTA com o Laravel.
//
// Fila = tarefas para rodar "depois", em segundo plano (ex.: mandar e-mail).
// No .env está QUEUE_CONNECTION=database, mas o nosso sistema NÃO usa filas:
// todas as operações acontecem na hora, dentro da requisição.
// As tabelas existem porque fazem parte da instalação padrão do Laravel.
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
        // Tarefas esperando para rodar.
        Schema::create('jobs', function (Blueprint $table) {
            $table->id();
            $table->string('queue')->index();                    // nome da fila
            $table->longText('payload');                         // a tarefa em si (serializada)
            $table->unsignedTinyInteger('attempts');             // quantas vezes já tentou rodar
            $table->unsignedInteger('reserved_at')->nullable();  // quando um processo pegou a tarefa
            $table->unsignedInteger('available_at');             // a partir de quando pode rodar
            $table->unsignedInteger('created_at');
        });

        // Grupos de tarefas (lotes).
        Schema::create('job_batches', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name');
            $table->integer('total_jobs');
            $table->integer('pending_jobs');
            $table->integer('failed_jobs');
            $table->longText('failed_job_ids');
            $table->mediumText('options')->nullable();
            $table->integer('cancelled_at')->nullable();
            $table->integer('created_at');
            $table->integer('finished_at')->nullable();
        });

        // Tarefas que deram erro (com a mensagem do erro, para investigar).
        Schema::create('failed_jobs', function (Blueprint $table) {
            $table->id();
            $table->string('uuid')->unique();
            $table->text('connection');
            $table->text('queue');
            $table->longText('payload');
            $table->longText('exception');                       // o erro que aconteceu
            $table->timestamp('failed_at')->useCurrent();        // useCurrent = preenche com a data/hora atual
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('jobs');
        Schema::dropIfExists('job_batches');
        Schema::dropIfExists('failed_jobs');
    }
};