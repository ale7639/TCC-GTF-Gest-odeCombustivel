<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Marca qual é o tanque principal da base (só um tanque pode ser o principal).
        Schema::table('tanques', function (Blueprint $table) {
            $table->boolean('principal')->default(false)->after('nivel_atual');
        });
    }

    public function down(): void
    {
        Schema::table('tanques', function (Blueprint $table) {
            $table->dropColumn('principal');
        });
    }
};