<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fuelings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('truck_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->decimal('quantity_liters', 8, 2);
            $table->decimal('tank_before', 10, 2);
            $table->decimal('tank_after', 10, 2);
            $table->decimal('truck_before', 8, 2);
            $table->decimal('truck_after', 8, 2);
            $table->unsignedInteger('km_at_fueling')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fuelings');
    }
};
