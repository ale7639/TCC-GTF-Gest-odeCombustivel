<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Quanto vale, em reais, o combustível que está dentro do tanque agora.
        // O custo médio por litro é: valor_estoque ÷ nivel_atual.
        Schema::table('tanques', function (Blueprint $table) {
            $table->decimal('valor_estoque', 14, 4)->default(0)->after('nivel_atual');
        });

        // Custo médio do tanque logo depois de cada entrada (fica registrado no histórico).
        Schema::table('entradas_combustivel', function (Blueprint $table) {
            $table->decimal('custo_medio_apos', 10, 4)->nullable()->after('valor_total');
        });

        // Quanto custou o combustível de cada abastecimento (custo médio do tanque na hora).
        Schema::table('abastecimentos', function (Blueprint $table) {
            $table->decimal('custo_litro', 10, 4)->nullable()->after('km');
            $table->decimal('custo_total', 14, 4)->nullable()->after('custo_litro');
        });

        // Tanques que já existem: estima o valor do estoque usando o preço médio de tudo o que já foi comprado.
        foreach (DB::table('tanques')->get() as $tanque) {
            $compras = DB::table('entradas_combustivel')
                ->where('tanque_id', $tanque->id)
                ->selectRaw('SUM(litros) AS litros, SUM(valor_total) AS valor')
                ->first();

            $precoMedio = ($compras && $compras->litros > 0) ? $compras->valor / $compras->litros : 0;

            DB::table('tanques')
                ->where('id', $tanque->id)
                ->update(['valor_estoque' => round($tanque->nivel_atual * $precoMedio, 4)]);
        }
    }

    public function down(): void
    {
        Schema::table('abastecimentos', function (Blueprint $table) {
            $table->dropColumn(['custo_litro', 'custo_total']);
        });

        Schema::table('entradas_combustivel', function (Blueprint $table) {
            $table->dropColumn('custo_medio_apos');
        });

        Schema::table('tanques', function (Blueprint $table) {
            $table->dropColumn('valor_estoque');
        });
    }
};