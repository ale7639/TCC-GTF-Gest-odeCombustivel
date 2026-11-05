<?php

namespace Database\Seeders;

use App\Models\Caminhao;
use App\Models\ChecklistPreViagem;
use App\Models\ConciliacaoTanque;
use App\Models\Manutencao;
use App\Models\Motorista;
use App\Models\Multa;
use App\Models\Pneu;
use App\Models\Tanque;
use Illuminate\Database\Seeder;

/** Preenche documentos, metas, pneus, multas e amostras das ideias faltantes (idempotente). */
class IdeiasFaltantesSeeder extends Seeder
{
    public function run(): void
    {
        $motoristas = Motorista::orderBy('id')->get();
        foreach ($motoristas as $i => $m) {
            $m->update([
                'cnh_validade' => $m->cnh_validade ?: now()->addDays([45, -5, 12, 90, 20][$i % 5])->toDateString(),
                'limite_litros_dia' => $m->limite_litros_dia ?? [400, 350, 300, 450, 380][$i % 5],
                'credito_litros_mes' => $m->credito_litros_mes ?? [4000, 3500, 3000, 4500, 3800][$i % 5],
            ]);
        }

        $caminhoes = Caminhao::orderBy('id')->get();
        foreach ($caminhoes as $i => $c) {
            $c->update([
                'crlv_validade' => $c->crlv_validade ?: now()->addDays([60, 8, -3, 120, 25, 40][$i % 6])->toDateString(),
                'seguro_validade' => $c->seguro_validade ?: now()->addDays([90, 15, 50, -2, 70, 30][$i % 6])->toDateString(),
                'meta_km_l' => $c->meta_km_l ?? [2.8, 3.0, 2.6, 2.5, 3.2, 2.4][$i % 6],
            ]);

            if ($c->pneus()->count() === 0 && $i < 3) {
                foreach (['DE', 'DD', 'TE', 'TD'] as $j => $pos) {
                    Pneu::create([
                        'caminhao_id' => $c->id,
                        'posicao' => $pos,
                        'data_troca' => now()->subDays(120 + $j * 10)->toDateString(),
                        'km_troca' => max(0, $c->km_atual - [55000, 62000, 10000, 58000][$j]),
                        'intervalo_km' => 60000,
                    ]);
                }
            }
        }

        // Manutenções antigas → OS
        Manutencao::where('status', 'agendada')->update(['status' => 'aberto']);
        Manutencao::where('status', 'concluida')->update(['status' => 'fechado']);
        Manutencao::whereNull('oficina')->where('status', '!=', 'fechado')
            ->update(['oficina' => 'Oficina parceira UNIALFA']);

        if (ChecklistPreViagem::query()->doesntExist() && $caminhoes->first()) {
            $c = $caminhoes->first();
            ChecklistPreViagem::create([
                'caminhao_id' => $c->id,
                'motorista_id' => $c->motorista_id,
                'data' => now()->subDay()->toDateString(),
                'status' => 'apto',
                'itens' => collect([
                    'freios', 'luzes', 'pneus', 'oleo_agua', 'extintor', 'documentos', 'para_brisas', 'estepe',
                ])->map(fn ($k) => ['chave' => $k, 'rotulo' => $k, 'ok' => true])->all(),
            ]);
        }

        $tanque = Tanque::first();
        if ($tanque && ConciliacaoTanque::query()->doesntExist()) {
            ConciliacaoTanque::create([
                'tanque_id' => $tanque->id,
                'data' => now()->subDay()->toDateString(),
                'nivel_informado' => (float) $tanque->nivel_atual - 20,
                'entradas_dia' => 0,
                'saidas_dia' => 200,
                'nivel_calculado' => (float) $tanque->nivel_atual,
                'variacao' => -20,
                'alerta' => false,
                'observacao' => 'Fechamento de turno demo',
            ]);
        }

        if (Multa::query()->doesntExist() && $caminhoes->first()) {
            Multa::create([
                'caminhao_id' => $caminhoes->first()->id,
                'motorista_id' => $caminhoes->first()->motorista_id,
                'data' => now()->subDays(10)->toDateString(),
                'valor' => 195.23,
                'descricao' => 'Excesso de velocidade — radar municipal',
                'prazo' => now()->addDays(5)->toDateString(),
                'status' => 'pendente',
            ]);
            if ($caminhoes->count() > 1) {
                Multa::create([
                    'caminhao_id' => $caminhoes[1]->id,
                    'motorista_id' => $caminhoes[1]->motorista_id,
                    'data' => now()->subDays(40)->toDateString(),
                    'valor' => 130.16,
                    'descricao' => 'Estacionamento proibido',
                    'prazo' => now()->subDays(2)->toDateString(),
                    'status' => 'indicado',
                ]);
            }
        }
    }
}
