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
        Schema::create('caminhoes', function (Blueprint $table) {
    $table->id();
    $table->string('placa', 8)->unique();
    $table->string('modelo');
    $table->unsignedSmallInteger('ano');
    $table->decimal('capacidade_tanque', 8, 2); // litros
    $table->unsignedInteger('km_atual')->default(0);
    $table->string('status')->default('ativo'); // ativo, manutencao, inativo
    $table->foreignId('motorista_id')->nullable()->unique()
          ->constrained('motoristas')->nullOnDelete();
    $table->timestamps();
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('caminhoes');
    }
};
