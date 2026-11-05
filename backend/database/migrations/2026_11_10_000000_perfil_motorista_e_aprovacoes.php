<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Wallace: aprovações + campos de abastecimento externo.
 * Idempotente com o schema Diego (já tem role/is_active/motorista_id/origem/posto).
 */
return new class extends Migration
{
    public function up(): void
    {
        // users.perfil só se ainda não existir (Diego usa role; perfil é opcional/legado).
        if (Schema::hasTable('users') && ! Schema::hasColumn('users', 'perfil')) {
            Schema::table('users', function (Blueprint $table) {
                $after = Schema::hasColumn('users', 'password') ? 'password' : null;
                $col = $table->string('perfil', 20)->default('admin');
                if ($after) {
                    $col->after($after);
                }
            });
        }

        if (Schema::hasTable('users') && ! Schema::hasColumn('users', 'motorista_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->foreignId('motorista_id')->nullable()->unique()
                    ->constrained('motoristas')->nullOnDelete();
            });
        }

        if (Schema::hasTable('abastecimentos')) {
            Schema::disableForeignKeyConstraints();
            try {
                Schema::table('abastecimentos', function (Blueprint $table) {
                    $table->unsignedBigInteger('tanque_id')->nullable()->change();
                });
            } catch (\Throwable) {
                // doctrine/dbal pode faltar; ignora se já nullable.
            }
            Schema::enableForeignKeyConstraints();

            Schema::table('abastecimentos', function (Blueprint $table) {
                if (! Schema::hasColumn('abastecimentos', 'origem')) {
                    $table->string('origem', 10)->default('base');
                }
                if (! Schema::hasColumn('abastecimentos', 'posto')) {
                    $table->string('posto')->nullable();
                }
                if (! Schema::hasColumn('abastecimentos', 'nota_numero')) {
                    $table->string('nota_numero', 30)->nullable();
                }
                if (! Schema::hasColumn('abastecimentos', 'valor_total')) {
                    $table->decimal('valor_total', 10, 2)->nullable();
                }
                if (! Schema::hasColumn('abastecimentos', 'foto')) {
                    $table->string('foto')->nullable();
                }
                if (! Schema::hasColumn('abastecimentos', 'status')) {
                    $table->string('status', 10)->default('aprovado');
                }
                if (! Schema::hasColumn('abastecimentos', 'motivo_recusa')) {
                    $table->string('motivo_recusa')->nullable();
                }
            });
        }

        foreach (['lavagens', 'manutencoes'] as $tabela) {
            if (! Schema::hasTable($tabela)) {
                continue;
            }
            Schema::table($tabela, function (Blueprint $table) use ($tabela) {
                if (! Schema::hasColumn($tabela, 'status')) {
                    $table->string('status', 10)->default('aprovado');
                }
                if (! Schema::hasColumn($tabela, 'motivo_recusa')) {
                    $table->string('motivo_recusa')->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        // Não remove role/motorista_id/origem do schema Diego.
        foreach (['lavagens', 'manutencoes'] as $tabela) {
            if (! Schema::hasTable($tabela)) {
                continue;
            }
            Schema::table($tabela, function (Blueprint $table) use ($tabela) {
                $drop = [];
                if (Schema::hasColumn($tabela, 'status')) {
                    $drop[] = 'status';
                }
                if (Schema::hasColumn($tabela, 'motivo_recusa')) {
                    $drop[] = 'motivo_recusa';
                }
                if ($drop) {
                    $table->dropColumn($drop);
                }
            });
        }

        if (Schema::hasTable('abastecimentos')) {
            Schema::table('abastecimentos', function (Blueprint $table) {
                $drop = [];
                foreach (['nota_numero', 'valor_total', 'foto', 'status', 'motivo_recusa'] as $col) {
                    if (Schema::hasColumn('abastecimentos', $col)) {
                        $drop[] = $col;
                    }
                }
                if ($drop) {
                    $table->dropColumn($drop);
                }
            });
        }

        if (Schema::hasTable('users') && Schema::hasColumn('users', 'perfil')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('perfil');
            });
        }
    }
};
