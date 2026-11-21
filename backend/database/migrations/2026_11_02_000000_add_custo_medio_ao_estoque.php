<?php

// =====================================================================================
// MIGRATION: colunas do CUSTO MÉDIO PONDERADO (a regra de negócio principal do sistema).
//
// Ideia: cada tanque sabe quantos litros tem (nivel_atual) e quanto VALEM em reais (valor_estoque).
//   custo médio por litro = valor_estoque ÷ nivel_atual
// Compra (entrada): soma litros e valor no tanque -> o custo médio muda.
// Abastecimento: sai litros × custo médio -> o custo médio do que sobra NÃO muda.
// Exemplo: 1.000 L valendo R$ 5.000 + compra de 2.000 L por R$ 12.000
//          = 3.000 L valendo R$ 17.000 -> R$ 5,6667 por litro.
//
// Quem usa: EntradaCombustivelController, AbastecimentoController, AprovacaoController.
// Esta migration também PREENCHE dados (o foreach no fim), não só cria colunas.
// =====================================================================================

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;       // DB = consultas diretas ao banco (usado para preencher os tanques antigos)
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Quanto vale, em reais, o combustível que está dentro do tanque agora.
        // O custo médio por litro é: valor_estoque ÷ nivel_atual.
        // decimal(14, 4) = 4 casas depois da vírgula: guarda centavos com precisão
        // para os arredondamentos não se acumularem a cada abastecimento.
        Schema::table('tanques', function (Blueprint $table) {
            $table->decimal('valor_estoque', 14, 4)->default(0)->after('nivel_atual');
        });

        // Custo médio do tanque logo depois de cada entrada (fica registrado no histórico).
        Schema::table('entradas_combustivel', function (Blueprint $table) {
            $table->decimal('custo_medio_apos', 10, 4)->nullable()->after('valor_total');
        });

        // Quanto custou o combustível de cada abastecimento (custo médio do tanque na hora).
        //   custo_litro = custo médio no momento; custo_total = litros × custo_litro.
        // Fora da base, na aprovação, o custo_total vira o valor pago no posto.
        // nullable: abastecimentos antigos (de antes desta migration) ficam sem custo gravado.
        Schema::table('abastecimentos', function (Blueprint $table) {
            $table->decimal('custo_litro', 10, 4)->nullable()->after('km');
            $table->decimal('custo_total', 14, 4)->nullable()->after('custo_litro');
        });

        // Tanques que já existem: estima o valor do estoque usando o preço médio de tudo o que já foi comprado.
        // (Sem isso, os tanques antigos ficariam com valor_estoque = 0 e o custo médio sairia zero.)
        foreach (DB::table('tanques')->get() as $tanque) {
            // Soma de litros e de valor de todas as compras deste tanque.
            $compras = DB::table('entradas_combustivel')
                ->where('tanque_id', $tanque->id)
                ->selectRaw('SUM(litros) AS litros, SUM(valor_total) AS valor')
                ->first();

            // Preço médio das compras (se nunca houve compra, fica 0).
            $precoMedio = ($compras && $compras->litros > 0) ? $compras->valor / $compras->litros : 0;

            // valor do estoque = litros que estão no tanque × preço médio.
            DB::table('tanques')
                ->where('id', $tanque->id)
                ->update(['valor_estoque' => round($tanque->nivel_atual * $precoMedio, 4)]);
        }
    }

    public function down(): void
    {
        // Desfaz removendo as colunas (os valores calculados se perdem junto).
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