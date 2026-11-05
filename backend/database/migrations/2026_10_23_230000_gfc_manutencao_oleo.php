<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('caminhoes', function (Blueprint $table) {
            $table->date('oleo_ultima_data')->nullable()->after('km_atual');
            $table->unsignedInteger('oleo_ultima_km')->nullable()->after('oleo_ultima_data');
            $table->unsignedInteger('oleo_intervalo_km')->default(10000)->after('oleo_ultima_km');
            $table->date('oleo_proxima_data')->nullable()->after('oleo_intervalo_km');
        });

        Schema::table('manutencoes', function (Blueprint $table) {
            $table->string('status', 20)->default('concluida')->after('tipo');
            $table->date('data_prevista')->nullable()->after('data');
            $table->date('data_realizada')->nullable()->after('data_prevista');
            $table->json('checklist')->nullable()->after('descricao');
        });

        // Registros existentes: concluídos na data já gravada
        DB::table('manutencoes')->update([
            'status' => 'concluida',
            'data_realizada' => DB::raw('data'),
            'data_prevista' => DB::raw('data'),
        ]);
    }

    public function down(): void
    {
        Schema::table('manutencoes', function (Blueprint $table) {
            $table->dropColumn(['status', 'data_prevista', 'data_realizada', 'checklist']);
        });

        Schema::table('caminhoes', function (Blueprint $table) {
            $table->dropColumn([
                'oleo_ultima_data',
                'oleo_ultima_km',
                'oleo_intervalo_km',
                'oleo_proxima_data',
            ]);
        });
    }
};
