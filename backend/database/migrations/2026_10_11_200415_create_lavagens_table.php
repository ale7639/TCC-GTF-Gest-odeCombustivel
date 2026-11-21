<?php

// =====================================================================================
// MIGRATION: tabela "lavagens" — lavagens dos caminhões.
//
// Quem usa: LavagemController (admin, CRUD completo), MeuController (motorista registra),
// relatórios. Model App\Models\Lavagem.
// Migrations que mudaram esta tabela depois:
//   2026_11_10 -> "status" e "motivo_recusa" (aprovação);
//   2026_11_12 -> "valor" passou a ser opcional (a lavagem é feita na empresa, sem custo).
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
        Schema::create('lavagens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('caminhao_id')->constrained('caminhoes');   // qual caminhão foi lavado
            $table->foreignId('motorista_id')->constrained('motoristas'); // responsável pelo caminhão na data
            $table->date('data');
            // Na criação era obrigatório; a migration 2026_11_12 deixou opcional (hoje fica vazio).
            $table->decimal('valor', 8, 2);
            $table->string('observacao')->nullable();                     // texto livre opcional
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lavagens');
    }
};