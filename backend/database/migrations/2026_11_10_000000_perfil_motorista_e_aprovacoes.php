<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1) Usuários: "perfil" diz se é admin ou motorista; motorista_id liga o login ao cadastro do motorista.
        //    Quem já existe (o admin) fica com perfil 'admin' automaticamente.
        Schema::table('users', function (Blueprint $table) {
            $table->string('perfil', 20)->default('admin')->after('password');
            $table->foreignId('motorista_id')->nullable()->unique()->after('perfil')
                ->constrained('motoristas')->nullOnDelete();
        });

        // 2) Abastecimentos: o tanque passa a ser opcional (abastecimento fora da base não sai de tanque nenhum).
        Schema::disableForeignKeyConstraints();
        Schema::table('abastecimentos', function (Blueprint $table) {
            $table->unsignedBigInteger('tanque_id')->nullable()->change();
        });
        Schema::enableForeignKeyConstraints();

        Schema::table('abastecimentos', function (Blueprint $table) {
            $table->string('origem', 10)->default('base');       // 'base' ou 'externo'
            $table->string('posto')->nullable();                 // nome do posto (só externo)
            $table->string('nota_numero', 30)->nullable();       // número da nota fiscal (só externo)
            $table->decimal('valor_total', 10, 2)->nullable();   // quanto foi pago (só externo)
            $table->string('foto')->nullable();                  // foto da nota/bomba (opcional)
            $table->string('status', 10)->default('aprovado');   // 'pendente', 'aprovado' ou 'recusado'
            $table->string('motivo_recusa')->nullable();
        });

        // 3) Lavagens e manutenções também passam por aprovação.
        //    Os registros que já existem ficam 'aprovado' (é o valor padrão).
        foreach (['lavagens', 'manutencoes'] as $tabela) {
            Schema::table($tabela, function (Blueprint $table) {
                $table->string('status', 10)->default('aprovado');
                $table->string('motivo_recusa')->nullable();
            });
        }
    }

    public function down(): void
    {
        foreach (['lavagens', 'manutencoes'] as $tabela) {
            Schema::table($tabela, function (Blueprint $table) {
                $table->dropColumn(['status', 'motivo_recusa']);
            });
        }

        Schema::table('abastecimentos', function (Blueprint $table) {
            $table->dropColumn(['origem', 'posto', 'nota_numero', 'valor_total', 'foto', 'status', 'motivo_recusa']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['motorista_id']);
            $table->dropColumn(['perfil', 'motorista_id']);
        });
    }
};