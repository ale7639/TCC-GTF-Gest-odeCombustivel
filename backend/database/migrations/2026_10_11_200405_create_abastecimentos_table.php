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
        Schema::create('abastecimentos', function (Blueprint $table) {
    $table->id();
    $table->foreignId('caminhao_id')->constrained('caminhoes');
    $table->foreignId('motorista_id')->constrained('motoristas');
    $table->foreignId('tanque_id')->constrained('tanques');
    $table->date('data');
    $table->decimal('litros', 8, 2);
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
