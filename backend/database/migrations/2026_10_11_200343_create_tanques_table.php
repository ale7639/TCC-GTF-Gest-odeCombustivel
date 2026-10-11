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
       Schema::create('tanques', function (Blueprint $table) {
    $table->id();
    $table->string('nome');
    $table->string('tipo_combustivel'); // diesel S10, diesel S500...
    $table->decimal('capacidade', 10, 2);   // litros
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
