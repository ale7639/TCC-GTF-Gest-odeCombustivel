<?php

// =====================================================================================
// MIGRATION: tabela "entradas_combustivel" — as COMPRAS de combustível para os tanques.
//
// Cada linha = um caminhão-tanque da distribuidora descarregando combustível num tanque da base.
// Quem usa: EntradaCombustivelController (tela "Entradas"), Model App\Models\EntradaCombustivel.
// Ao registrar uma entrada, o controller soma os litros e o valor no tanque e calcula o custo médio.
// Migrations que acrescentaram colunas aqui depois:
//   2026_10_11_203707 -> "nota_fiscal_id" (nota da compra, opcional);
//   2026_11_02        -> "custo_medio_apos" (custo médio do tanque logo depois desta compra).
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
        Schema::create('entradas_combustivel', function (Blueprint $table) {
            $table->id();
            // Em qual tanque o combustível entrou. constrained = só aceita tanque que existe.
            // Sem nullOnDelete: o banco NÃO deixa apagar um tanque que tem entradas
            // (o TanqueController também confere isso antes e avisa o usuário).
            $table->foreignId('tanque_id')->constrained('tanques');
            $table->date('data');                            // date = só a data, sem hora
            $table->decimal('litros', 10, 2);                // quantos litros entraram
            $table->decimal('valor_total', 10, 2);           // quanto foi pago na compra (R$)
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('entradas_combustivel');
    }
};