<?php

// =====================================================================================
// MIGRATION: tabela "notas_fiscais" + ligação dela com as compras de combustível e as manutenções.
//
// Quem usa: NotaFiscalController (tela Notas fiscais), EntradaCombustivelController e
// ManutencaoController (criam a nota junto com o lançamento). Model App\Models\NotaFiscal.
// Relação: uma nota pode estar ligada a entradas de combustível e/ou manutenções
// (elas é que guardam o "nota_fiscal_id").
// A migration 2026_11_15 acrescentou categoria, descrição e caminhão (notas de outras despesas).
// =====================================================================================

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
       /**
     * Cria a tabela de notas fiscais e liga ela às compras de combustível
     * e às manutenções.
     */
    public function up(): void
    {
        // 1) Tabela principal: guarda os dados da nota fiscal em si.
        Schema::create('notas_fiscais', function (Blueprint $table) {
            $table->id();
            $table->string('numero', 20);                // número impresso na nota
            $table->string('fornecedor');                // quem emitiu (posto, distribuidora, oficina)
            $table->date('data_emissao');                // data em que a nota foi emitida
            $table->decimal('valor_total', 10, 2);       // valor total da nota em reais

            // Chave de acesso da NF-e: sempre tem 44 caracteres.
            // É "unique" para impedir cadastrar a mesma nota duas vezes.
            // É "nullable" porque nem toda nota (ex.: nota de papel) tem chave.
            // (O sistema confere só o formato e a repetição; não consulta a SEFAZ.)
            $table->string('chave_acesso', 44)->nullable()->unique();

            $table->timestamps();
        });

        // 2) Altera uma tabela que JÁ EXISTE (Schema::table, e não Schema::create)
        //    para acrescentar a coluna que aponta para a nota fiscal.
        Schema::table('entradas_combustivel', function (Blueprint $table) {
            $table->foreignId('nota_fiscal_id')
                  ->nullable()                           // a nota pode ser anexada depois
                  ->after('tanque_id')                   // só organiza a posição da coluna
                  ->constrained('notas_fiscais')         // cria a chave estrangeira para notas_fiscais
                  ->nullOnDelete();                      // se a nota for apagada, a entrada continua existindo
        });

        // 3) Mesma ideia para as manutenções.
        Schema::table('manutencoes', function (Blueprint $table) {
            $table->foreignId('nota_fiscal_id')
                  ->nullable()
                  ->after('motorista_id')
                  ->constrained('notas_fiscais')
                  ->nullOnDelete();
        });
    }

    /**
     * Desfaz tudo o que o up() fez, na ORDEM INVERSA.
     * Primeiro remove as colunas que dependem da nota; só depois
     * a tabela pode ser apagada (senão o banco recusa por causa das chaves estrangeiras).
     */
    public function down(): void
    {
        Schema::table('manutencoes', function (Blueprint $table) {
            // Remove a chave estrangeira e a coluna de uma vez.
            $table->dropConstrainedForeignId('nota_fiscal_id');
        });

        Schema::table('entradas_combustivel', function (Blueprint $table) {
            $table->dropConstrainedForeignId('nota_fiscal_id');
        });

        Schema::dropIfExists('notas_fiscais');
    }
};