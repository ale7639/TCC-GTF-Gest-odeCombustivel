<?php

// =====================================================================================
// MIGRATION: tabela "caminhoes" — a FROTA.
//
// Quem usa: CaminhaoController (CRUD, tela Gestão de frota), Model App\Models\Caminhao.
// Esta migration roda DEPOIS da de motoristas (a data no nome é maior), porque
// "motorista_id" aponta para a tabela motoristas, que precisa existir antes.
// =====================================================================================

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('caminhoes', function (Blueprint $table) {
            $table->id();
            // Placa sem repetir. 8 caracteres cabe "ABC-1234"; o controller grava sem traço (ABC1234 ou ABC1D23).
            $table->string('placa', 8)->unique();
            $table->string('modelo');                                    // ex.: "Volvo FH 540"
            // unsignedSmallInteger = número inteiro pequeno e sem sinal (0 a 65.535): suficiente para um ano.
            $table->unsignedSmallInteger('ano');
            // decimal(8, 2) = até 8 dígitos no total, 2 depois da vírgula (ex.: 450.00).
            // Usado para impedir abastecimento com mais litros do que cabe no caminhão.
            $table->decimal('capacidade_tanque', 8, 2); // litros
            // Km atual do caminhão. "unsigned" = não aceita negativo. Começa em 0.
            // É atualizado pelos abastecimentos e manutenções (e nunca diminui).
            $table->unsignedInteger('km_atual')->default(0);
            // Situação do caminhão. Só caminhão "ativo" recebe abastecimento.
            $table->string('status')->default('ativo'); // ativo, manutencao, inativo
            // Motorista responsável (chave estrangeira):
            //   foreignId       -> cria a coluna motorista_id (BIGINT);
            //   nullable        -> o caminhão pode ficar sem motorista;
            //   unique          -> o mesmo motorista não pode ser responsável por dois caminhões;
            //   constrained     -> o banco só aceita um id que exista em "motoristas";
            //   nullOnDelete    -> se o motorista for apagado, o caminhão fica com motorista_id = NULL
            //                      (o caminhão continua existindo).
            $table->foreignId('motorista_id')->nullable()->unique()
                  ->constrained('motoristas')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('caminhoes');
    }
};