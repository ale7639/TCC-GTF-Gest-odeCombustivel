<?php

// =====================================================================================
// MIGRATION: tabela "motoristas" — o CADASTRO de cada motorista.
//
// Atenção à diferença:
//   motoristas = dados da pessoa (nome, CPF, CNH, telefone);
//   users      = o LOGIN dela no app (senha). Um motorista pode existir sem login.
//   A ligação entre os dois é users.motorista_id (migration 2026_11_10).
//
// Quem usa: MotoristaController (CRUD), Model App\Models\Motorista.
// Ligações que apontam PARA esta tabela:
//   caminhoes.motorista_id, abastecimentos.motorista_id, lavagens.motorista_id,
//   manutencoes.motorista_id e users.motorista_id.
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
        Schema::create('motoristas', function (Blueprint $table) {
            $table->id();                                    // chave primária
            $table->string('nome');
            // CPF com 14 caracteres = formato 000.000.000-00 (o controller grava sempre assim).
            // unique = não pode haver dois motoristas com o mesmo CPF (o banco recusa).
            // É pelo CPF que o motorista faz login no app.
            $table->string('cpf', 14)->unique();
            $table->string('cnh', 20);                       // número da CNH (o controller guarda só os números)
            $table->string('telefone', 20)->nullable();      // opcional; usado no botão de WhatsApp
            // ativo = false -> o motorista não consegue entrar no app (regra do AuthController)
            // e não aparece para ser escolhido como responsável de um caminhão.
            $table->boolean('ativo')->default(true);
            $table->timestamps();                            // created_at e updated_at
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('motoristas');
    }
};