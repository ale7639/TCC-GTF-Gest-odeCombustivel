<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('motoristas', function (Blueprint $table) {
            $table->date('cnh_validade')->nullable()->after('cnh');
            $table->decimal('limite_litros_dia', 10, 2)->nullable()->after('telefone');
            $table->decimal('credito_litros_mes', 10, 2)->nullable()->after('limite_litros_dia');
        });

        Schema::table('caminhoes', function (Blueprint $table) {
            $table->date('crlv_validade')->nullable()->after('status');
            $table->date('seguro_validade')->nullable()->after('crlv_validade');
            $table->decimal('meta_km_l', 8, 2)->nullable()->after('seguro_validade');
        });

        Schema::table('abastecimentos', function (Blueprint $table) {
            $table->string('motivo_excesso', 255)->nullable()->after('km');
        });

        Schema::table('manutencoes', function (Blueprint $table) {
            $table->string('oficina', 120)->nullable()->after('tipo');
        });

        // OS: aberto / em_andamento / fechado (mantém valores antigos mapeados)
        DB::table('manutencoes')->where('status', 'agendada')->update(['status' => 'aberto']);
        DB::table('manutencoes')->where('status', 'concluida')->update(['status' => 'fechado']);

        Schema::create('checklists_pre_viagem', function (Blueprint $table) {
            $table->id();
            $table->foreignId('caminhao_id')->constrained('caminhoes')->cascadeOnDelete();
            $table->foreignId('motorista_id')->nullable()->constrained('motoristas')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('data');
            $table->string('status', 20); // apto | nao_apto
            $table->json('itens');
            $table->string('foto_path')->nullable();
            $table->text('observacao')->nullable();
            $table->foreignId('manutencao_id')->nullable()->constrained('manutencoes')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('conciliacoes_tanque', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tanque_id')->constrained('tanques')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('data');
            $table->decimal('nivel_informado', 12, 2);
            $table->decimal('entradas_dia', 12, 2)->default(0);
            $table->decimal('saidas_dia', 12, 2)->default(0);
            $table->decimal('nivel_calculado', 12, 2);
            $table->decimal('variacao', 12, 2);
            $table->boolean('alerta')->default(false);
            $table->text('observacao')->nullable();
            $table->timestamps();
            $table->unique(['tanque_id', 'data']);
        });

        Schema::create('pneus', function (Blueprint $table) {
            $table->id();
            $table->foreignId('caminhao_id')->constrained('caminhoes')->cascadeOnDelete();
            $table->string('posicao', 40);
            $table->date('data_troca')->nullable();
            $table->unsignedInteger('km_troca')->nullable();
            $table->unsignedInteger('intervalo_km')->default(60000);
            $table->text('observacao')->nullable();
            $table->timestamps();
            $table->unique(['caminhao_id', 'posicao']);
        });

        Schema::create('multas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('caminhao_id')->constrained('caminhoes')->cascadeOnDelete();
            $table->foreignId('motorista_id')->nullable()->constrained('motoristas')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('data');
            $table->decimal('valor', 12, 2)->default(0);
            $table->string('descricao', 255);
            $table->date('prazo')->nullable();
            $table->string('status', 20)->default('pendente'); // pendente | indicado | pago
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('multas');
        Schema::dropIfExists('pneus');
        Schema::dropIfExists('conciliacoes_tanque');
        Schema::dropIfExists('checklists_pre_viagem');

        DB::table('manutencoes')->where('status', 'aberto')->update(['status' => 'agendada']);
        DB::table('manutencoes')->where('status', 'fechado')->update(['status' => 'concluida']);
        DB::table('manutencoes')->where('status', 'em_andamento')->update(['status' => 'agendada']);

        Schema::table('manutencoes', function (Blueprint $table) {
            $table->dropColumn('oficina');
        });

        Schema::table('abastecimentos', function (Blueprint $table) {
            $table->dropColumn('motivo_excesso');
        });

        Schema::table('caminhoes', function (Blueprint $table) {
            $table->dropColumn(['crlv_validade', 'seguro_validade', 'meta_km_l']);
        });

        Schema::table('motoristas', function (Blueprint $table) {
            $table->dropColumn(['cnh_validade', 'limite_litros_dia', 'credito_litros_mes']);
        });
    }
};
