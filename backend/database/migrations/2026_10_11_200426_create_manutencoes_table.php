<?php

// =====================================================================================
// MIGRATION: tabela "manutencoes" — manutenções dos caminhões (óleo, pneus, freios...).
//
// Quem usa: ManutencaoController (admin, CRUD completo), MeuController (motorista registra),
// relatórios e notas fiscais. Model App\Models\Manutencao.
// Migrations que acrescentaram colunas aqui depois:
//   2026_10_11_203707 -> "nota_fiscal_id" (nota da oficina, opcional);
//   2026_11_10        -> "status" e "motivo_recusa".
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
        Schema::create('manutencoes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('caminhao_id')->constrained('caminhoes');
            $table->foreignId('motorista_id')->constrained('motoristas');
            $table->date('data');
            $table->string('tipo'); // troca de óleo, pneus, freios...
            // text = texto longo (mais de 255 caracteres). nullable = opcional.
            $table->text('descricao')->nullable();
            // Valor gasto. Aceita 0 (serviço em garantia); o controller não aceita negativo.
            $table->decimal('valor', 10, 2);
            $table->unsignedInteger('km');                   // km do caminhão na manutenção
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('manutencoes');
    }
};