<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trucks', function (Blueprint $table) {
            $table->id();
            $table->string('plate', 8)->unique();
            $table->string('name');
            $table->string('model');
            $table->string('fuel_type')->default('Diesel S10');
            $table->decimal('tank_capacity', 8, 2);
            $table->decimal('current_liters', 8, 2)->default(0);
            $table->unsignedInteger('current_km')->default(0);
            $table->string('sector')->nullable();
            $table->foreignId('driver_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedSmallInteger('wash_frequency_days')->default(7);
            $table->date('next_maintenance_date')->nullable();
            $table->unsignedInteger('next_maintenance_km')->nullable();
            $table->date('crlv_expires_at')->nullable();
            $table->date('insurance_expires_at')->nullable();
            $table->date('license_expires_at')->nullable();
            $table->string('photo_url')->nullable();
            $table->string('status', 20)->default('ativo');
            $table->timestamp('last_verified_at')->nullable();
            $table->foreignId('last_verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trucks');
    }
};
