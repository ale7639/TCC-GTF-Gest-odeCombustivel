<?php

// =====================================================================================
// MIGRATION: o "valor" da lavagem passa a ser OPCIONAL.
// Regra de negócio: a lavagem é feita na própria empresa, então não tem custo.
// Quem usa: LavagemController e MeuController gravam valor = null.
// =====================================================================================

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // As lavagens são feitas na própria empresa: não têm custo, só a data.
    // O campo "valor" continua existindo, mas passa a ser opcional (fica vazio nas lavagens novas).
    public function up(): void
    {
        // change() altera a coluna existente: de "obrigatória" para nullable (aceita vazio).
        Schema::table('lavagens', function (Blueprint $table) {
            $table->decimal('valor', 8, 2)->nullable()->change();
        });
    }

    public function down(): void
    {
        // Desfaz: volta a ser obrigatória, com 0 como valor padrão.
        Schema::table('lavagens', function (Blueprint $table) {
            $table->decimal('valor', 8, 2)->nullable(false)->default(0)->change();
        });
    }
};