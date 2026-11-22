<?php

// =====================================================================================
// MIGRATION: LOGIN DO MOTORISTA e FLUXO DE APROVAÇÃO.
// É a migration que mais mudou o sistema; mexe em quatro tabelas.
//
//   users          -> "perfil" (admin ou motorista) e "motorista_id" (liga o login ao cadastro);
//   abastecimentos -> tanque opcional (fora da base), dados do posto, foto e status;
//   lavagens e manutencoes -> status e motivo de recusa.
//
// Quem usa: AuthController (login), middlewares ApenasAdmin/ApenasMotorista,
// MeuController (o motorista lança), AprovacaoController (o admin aprova ou recusa).
// =====================================================================================

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
        // 1) Usuários: "perfil" diz se é admin ou motorista; motorista_id liga o login ao cadastro do motorista.
        //    Quem já existe (o admin) fica com perfil 'admin' automaticamente.
        //    unique em motorista_id: um motorista tem no máximo UM login.
        //    nullOnDelete: se o cadastro do motorista sumir, o login fica sem vínculo.
        Schema::table('users', function (Blueprint $table) {
            $table->string('perfil', 20)->default('admin')->after('password');
            $table->foreignId('motorista_id')->nullable()->unique()->after('perfil')
                ->constrained('motoristas')->nullOnDelete();
        });

        // 2) Abastecimentos: o tanque passa a ser opcional (abastecimento fora da base não sai de tanque nenhum).
        //    ->change() altera uma coluna que já existe.
        //    As chaves estrangeiras são desligadas só durante a alteração, porque o MySQL
        //    não deixa mudar uma coluna que participa de uma chave estrangeira; depois são religadas.
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
            // Caminho do arquivo da foto no armazenamento PRIVADO do Laravel (não é público).
            // O admin abre a foto por um endereço assinado.
            $table->string('foto')->nullable();                  // foto da nota/bomba (opcional)
            // Os abastecimentos que já existiam ficam 'aprovado' (valor padrão).
            // O motorista grava como 'pendente'; só ao aprovar o combustível sai do tanque.
            $table->string('status', 10)->default('aprovado');   // 'pendente', 'aprovado' ou 'recusado'
            $table->string('motivo_recusa')->nullable();         // explicação opcional do admin ao recusar
        });

        // 3) Lavagens e manutenções também passam por aprovação.
        //    Os registros que já existem ficam 'aprovado' (é o valor padrão).
        //    (Na regra atual, as do motorista já são gravadas como 'aprovado', porque não mexem no estoque.)
        //    O foreach faz a mesma alteração nas duas tabelas sem repetir código.
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
        // Desfaz na ordem inversa do up().
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

        // Primeiro tira a chave estrangeira, depois a coluna (o banco exige essa ordem).
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['motorista_id']);
            $table->dropColumn(['perfil', 'motorista_id']);
        });
    }
};
