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
        Schema::create('lavagens', function (Blueprint $table) {
    $table->id();
    $table->foreignId('caminhao_id')->constrained('caminhoes');
    $table->foreignId('motorista_id')->constrained('motoristas');
    $table->date('data');
    $table->decimal('valor', 8, 2);
    $table->string('observacao')->nullable();
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
