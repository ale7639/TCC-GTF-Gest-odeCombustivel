<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'telefone')) {
                $table->string('telefone', 32)->nullable()->after('email');
            }
        });

        Schema::create('notificacao_leituras', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('chave', 160);
            $table->timestamp('lida_em');
            $table->timestamps();

            $table->unique(['user_id', 'chave']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notificacao_leituras');

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'telefone')) {
                $table->dropColumn('telefone');
            }
        });
    }
};
