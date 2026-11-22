<?php

// =====================================================================================
// MIGRATION: tabela "tanques" — os tanques de combustível da PRÓPRIA EMPRESA (a base).
//
// Quem usa: TanqueController (CRUD), Model App\Models\Tanque, e as regras de estoque
// em EntradaCombustivelController (compra: entra combustível) e AbastecimentoController
// (abastecimento: sai combustível).
// Migrations que acrescentaram colunas aqui depois:
//   2026_10_30 -> "principal" (o tanque que aparece em destaque no painel);
//   2026_11_02 -> "valor_estoque" (base do CUSTO MÉDIO).
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
        Schema::create('tanques', function (Blueprint $table) {
            $table->id();
            $table->string('nome');                                  // ex.: "Tanque 1"
            $table->string('tipo_combustivel'); // diesel S10, diesel S500...
            $table->decimal('capacidade', 10, 2);   // litros (quanto cabe no máximo)
            // Quantos litros tem dentro AGORA. Começa em 0.
            // Sobe com as entradas (compras) e desce com os abastecimentos.
            // Não é editado pela tela: só muda por esses lançamentos.
            $table->decimal('nivel_atual', 10, 2)->default(0); // litros
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tanques');
    }
};