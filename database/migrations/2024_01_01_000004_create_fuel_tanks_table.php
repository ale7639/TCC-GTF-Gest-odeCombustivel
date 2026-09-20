<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fuel_tanks', function (Blueprint $table) {
            $table->id();
            $table->string('name')->default('Tanque Principal');
            $table->decimal('capacity_liters', 10, 2);
            $table->decimal('current_liters', 10, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fuel_tanks');
    }
};
