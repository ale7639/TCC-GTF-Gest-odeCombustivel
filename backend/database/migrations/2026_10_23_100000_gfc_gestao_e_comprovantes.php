<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 20)->default('motorista')->after('password');
            $table->boolean('is_active')->default(true)->after('role');
            $table->foreignId('motorista_id')->nullable()->unique()->after('is_active')
                ->constrained('motoristas')->nullOnDelete();
        });

        Schema::table('abastecimentos', function (Blueprint $table) {
            $table->dropForeign(['tanque_id']);
        });

        Schema::table('abastecimentos', function (Blueprint $table) {
            $table->unsignedBigInteger('tanque_id')->nullable()->change();
            $table->foreign('tanque_id')->references('id')->on('tanques')->nullOnDelete();
            $table->string('origem', 20)->default('base')->after('tanque_id');
            $table->string('posto')->nullable()->after('origem');
            $table->string('comprovante_path')->nullable()->after('posto');
            $table->foreignId('user_id')->nullable()->after('motorista_id')
                ->constrained('users')->nullOnDelete();
        });

        Schema::table('notas_fiscais', function (Blueprint $table) {
            $table->string('comprovante_path')->nullable()->after('chave_acesso');
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action');
            $table->string('entity_type')->nullable();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->json('payload')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');

        Schema::table('notas_fiscais', function (Blueprint $table) {
            $table->dropColumn('comprovante_path');
        });

        Schema::table('abastecimentos', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn(['origem', 'posto', 'comprovante_path', 'user_id']);
            $table->dropForeign(['tanque_id']);
        });

        Schema::table('abastecimentos', function (Blueprint $table) {
            $table->unsignedBigInteger('tanque_id')->nullable(false)->change();
            $table->foreign('tanque_id')->references('id')->on('tanques');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('motorista_id');
            $table->dropColumn(['role', 'is_active']);
        });
    }
};
