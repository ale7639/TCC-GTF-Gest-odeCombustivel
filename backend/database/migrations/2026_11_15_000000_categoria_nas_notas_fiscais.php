<?php

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
            $table->string('categoria', 30)->nullable();
            $table->string('descricao')->nullable();
            $table->foreignId('caminhao_id')->nullable()->constrained('caminhoes')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('notas_fiscais', function (Blueprint $table) {
            $table->dropForeign(['caminhao_id']);
            $table->dropColumn(['categoria', 'descricao', 'caminhao_id']);
        });
    }
};