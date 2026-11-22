<?php

// =====================================================================================
// MIGRATION: acrescenta a coluna "principal" na tabela "tanques".
//
// Exemplo de migration que ALTERA uma tabela existente (Schema::table) em vez de criar.
// Vantagem: o banco evolui sem apagar os dados que já existem.
// Quem usa: TanqueController (ao marcar um tanque como principal, desmarca os outros),
// DashboardController (mostra o principal em destaque no painel).
// =====================================================================================

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Marca qual é o tanque principal da base (só um tanque pode ser o principal).
        // A regra "só um" é garantida pelo TanqueController, não pelo banco.
        Schema::table('tanques', function (Blueprint $table) {
            // boolean = verdadeiro/falso (no MySQL vira TINYINT 0 ou 1).
            // default(false) = os tanques que já existiam ficam como "não principal".
            // after('nivel_atual') = só a posição da coluna na tabela.
            $table->boolean('principal')->default(false)->after('nivel_atual');
        });
    }

    public function down(): void
    {
        // Desfaz: remove a coluna.
        Schema::table('tanques', function (Blueprint $table) {
            $table->dropColumn('principal');
        });
    }
};