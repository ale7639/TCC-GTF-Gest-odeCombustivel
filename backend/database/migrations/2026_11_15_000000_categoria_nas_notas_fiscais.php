<?php

// =====================================================================================
// MIGRATION: notas fiscais de OUTRAS DESPESAS (além de combustível e manutenção).
// Quem usa: NotaFiscalController (tela Notas fiscais, botão "+ Nova nota"),
// RelatorioCaminhaoController (as notas do caminhão entram no gasto total dele).
// Categorias aceitas pelo controller: Compra de veículo, Peças, Pneus, Serviços, Outros.
// =====================================================================================

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Notas fiscais de outras despesas (compra de veículo, peças, pneus...):
    // categoria, uma descrição e, se for o caso, o caminhão a que a despesa se refere.
    public function up(): void
    {
        Schema::table('notas_fiscais', function (Blueprint $table) {
            $table->string('categoria', 30)->nullable();     // ex.: "Peças"
            $table->string('descricao')->nullable();         // ex.: "chave inglesa, jogo de relação"
            // Caminhão da despesa (opcional). Se o caminhão for apagado, a nota fica sem caminhão.
            $table->foreignId('caminhao_id')->nullable()->constrained('caminhoes')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('notas_fiscais', function (Blueprint $table) {
            $table->dropForeign(['caminhao_id']);            // primeiro a chave estrangeira
            $table->dropColumn(['categoria', 'descricao', 'caminhao_id']);
        });
    }
};