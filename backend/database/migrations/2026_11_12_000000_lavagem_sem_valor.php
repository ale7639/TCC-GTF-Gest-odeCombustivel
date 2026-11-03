<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // As lavagens são feitas na própria empresa: não têm custo, só a data.
    // O campo "valor" continua existindo, mas passa a ser opcional (fica vazio nas lavagens novas).
    public function up(): void
    {
        Schema::table('lavagens', function (Blueprint $table) {
            $table->decimal('valor', 8, 2)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('lavagens', function (Blueprint $table) {
            $table->decimal('valor', 8, 2)->nullable(false)->default(0)->change();
        });
    }
};