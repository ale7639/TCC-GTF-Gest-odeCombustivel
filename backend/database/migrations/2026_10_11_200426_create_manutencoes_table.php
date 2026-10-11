<?php

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
    $table->text('descricao')->nullable();
    $table->decimal('valor', 10, 2);
    $table->unsignedInteger('km');
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
