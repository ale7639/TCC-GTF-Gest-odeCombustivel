<?php

// =====================================================================================
// MIGRATION: tabela "abastecimentos" — combustível colocado nos CAMINHÕES.
//
// Cada linha = um caminhão abastecido. Na versão original, sempre saindo de um tanque da base.
// Quem usa: AbastecimentoController (admin), MeuController (motorista), AprovacaoController,
// relatórios (consumo km/L) e o painel.
// Migrations que mudaram esta tabela depois:
//   2026_11_02 -> "custo_litro" e "custo_total" (custo médio do tanque na hora);
//   2026_11_10 -> tanque passou a ser OPCIONAL (abastecimento fora da base, num posto)
//                 e entraram origem, posto, nota, valor pago, foto e status de aprovação.
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
        Schema::create('abastecimentos', function (Blueprint $table) {
            $table->id();
            // Três chaves estrangeiras: o banco só aceita ids que existam nas outras tabelas.
            $table->foreignId('caminhao_id')->constrained('caminhoes');   // qual caminhão
            $table->foreignId('motorista_id')->constrained('motoristas'); // quem era o responsável
            $table->foreignId('tanque_id')->constrained('tanques');       // de qual tanque saiu (depois virou opcional)
            $table->date('data');
            $table->decimal('litros', 8, 2);
            // Km do caminhão no momento do abastecimento. É com ele que se calcula o consumo:
            // km rodados entre dois abastecimentos ÷ litros.
            $table->unsignedInteger('km'); // km do caminhão no abastecimento
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('abastecimentos');
    }
};