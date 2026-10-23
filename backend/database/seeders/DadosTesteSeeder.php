<?php

namespace Database\Seeders;

use App\Models\Abastecimento;
use App\Models\Caminhao;
use App\Models\EntradaCombustivel;
use App\Models\Lavagem;
use App\Models\Manutencao;
use App\Models\Motorista;
use App\Models\NotaFiscal;
use App\Models\Tanque;
use Illuminate\Database\Seeder;

class DadosTesteSeeder extends Seeder
{
    public function run(): void
    {
        if (Motorista::query()->exists()) {
            return;
        }

        // 1) Motoristas
        $motoristas = collect([
            ['nome' => 'João Santos',     'cpf' => '111.111.111-11', 'cnh' => '12345678901', 'telefone' => '(44) 99999-0001'],
            ['nome' => 'Carlos Silva',    'cpf' => '222.222.222-22', 'cnh' => '12345678902', 'telefone' => '(44) 99999-0002'],
            ['nome' => 'Marcos Oliveira', 'cpf' => '333.333.333-33', 'cnh' => '12345678903', 'telefone' => '(44) 99999-0003'],
            ['nome' => 'Rafael Santos',   'cpf' => '444.444.444-44', 'cnh' => '12345678904', 'telefone' => '(44) 99999-0004'],
            ['nome' => 'André Costa',     'cpf' => '555.555.555-55', 'cnh' => '12345678905', 'telefone' => '(44) 99999-0005'],
        ])->map(fn ($dados, $i) => Motorista::create([
            ...$dados,
            'cnh_validade' => now()->addDays([45, -5, 12, 90, 20][$i])->toDateString(),
            'limite_litros_dia' => [400, 350, 300, 450, 380][$i],
            'credito_litros_mes' => [4000, 3500, 3000, 4500, 3800][$i],
        ]));

        // 2) Caminhões: os 5 primeiros recebem um motorista; o 6º fica sem motorista, em manutenção
        $caminhoes = collect([
            ['ABC1D23', 'Volvo FH 540',          2020, 600, 185000, 'ativo'],
            ['BCD2E34', 'Scania R 450',          2019, 550, 230000, 'ativo'],
            ['CDE3F45', 'Mercedes-Benz Actros',  2021, 600, 120000, 'ativo'],
            ['DEF4G56', 'DAF XF 530',            2018, 500, 310000, 'ativo'],
            ['EFG5H67', 'Iveco Hi-Way',          2022, 450,  80000, 'ativo'],
            ['FGH6I78', 'Volkswagen Constellation', 2017, 400, 350000, 'manutencao'],
        ])->map(fn ($c, $i) => Caminhao::create([
            'placa'             => $c[0],
            'modelo'            => $c[1],
            'ano'               => $c[2],
            'capacidade_tanque' => $c[3],
            'km_atual'          => $c[4],
            'status'            => $c[5],
            'motorista_id'      => $motoristas->get($i)?->id, // null para o 6º caminhão
            'oleo_intervalo_km' => 10000,
            'oleo_ultima_km'    => $i < 5 ? $c[4] - [12000, 800, 4500, 11000, 2000][$i] : null,
            'oleo_ultima_data'  => $i < 5 ? now()->subDays([90, 20, 45, 100, 30][$i])->toDateString() : null,
            'oleo_proxima_data' => $i < 5 ? now()->addDays([20, 5, 40, -10, 25][$i])->toDateString() : null,
            'crlv_validade' => now()->addDays([60, 8, -3, 120, 25, 40][$i])->toDateString(),
            'seguro_validade' => now()->addDays([90, 15, 50, -2, 70, 30][$i])->toDateString(),
            'meta_km_l' => [2.8, 3.0, 2.6, 2.5, 3.2, 2.4][$i],
        ]));

        // 3) Tanques da empresa (o nível já é definido aqui; o segundo está baixo de propósito,
        //    para o dashboard poder mostrar um alerta)
        $tanques = collect([
            ['nome' => 'Tanque 1', 'tipo_combustivel' => 'Diesel S10',  'capacidade' => 15000, 'nivel_atual' => 9000],
            ['nome' => 'Tanque 2', 'tipo_combustivel' => 'Diesel S500', 'capacidade' => 10000, 'nivel_atual' => 1800],
        ])->map(fn ($dados) => Tanque::create($dados));

        // 4) Compras de combustível: cada uma tem sua nota fiscal
        $compras = [
            ['tanque' => 0, 'litros' => 10000, 'dias' => 25],
            ['tanque' => 1, 'litros' => 6000,  'dias' => 15],
            ['tanque' => 0, 'litros' => 8000,  'dias' => 5],
        ];

        foreach ($compras as $i => $compra) {
            $valor = $compra['litros'] * 5.89;

            $nota = NotaFiscal::create([
                'numero'       => (string) (1000 + $i),
                'fornecedor'   => 'Distribuidora Paraná Combustíveis',
                'data_emissao' => now()->subDays($compra['dias']),
                'valor_total'  => $valor,
            ]);

            EntradaCombustivel::create([
                'tanque_id'      => $tanques[$compra['tanque']]->id,
                'nota_fiscal_id' => $nota->id,
                'data'           => now()->subDays($compra['dias']),
                'litros'         => $compra['litros'],
                'valor_total'    => $valor,
            ]);
        }

        // 5) Abastecimentos dos últimos 30 dias (só caminhões que têm motorista)
        $comMotorista = $caminhoes->whereNotNull('motorista_id');

        for ($i = 0; $i < 25; $i++) {
            $caminhao = $comMotorista->random();

            Abastecimento::create([
                'caminhao_id'  => $caminhao->id,
                'motorista_id' => $caminhao->motorista_id,
                'tanque_id'    => $tanques->random()->id,
                'data'         => now()->subDays(rand(0, 30)),
                'litros'       => rand(150, 400),
                'km'           => $caminhao->km_atual - rand(100, 5000),
            ]);
        }

        // 6) Lavagens
        foreach ([0, 1, 2, 3] as $i) {
            Lavagem::create([
                'caminhao_id'  => $caminhoes[$i]->id,
                'motorista_id' => $caminhoes[$i]->motorista_id,
                'data'         => now()->subDays(rand(1, 30)),
                'valor'        => 80,
                'observacao'   => 'Lavagem completa',
            ]);
        }

        // 7) Manutenções (histórico + uma agendada)
        foreach ([[0, 'Troca de óleo', 850], [1, 'Troca de pneus', 4200], [2, 'Revisão de freios', 1300]] as [$i, $tipo, $valor]) {
            $data = now()->subDays(rand(1, 30))->toDateString();
            Manutencao::create([
                'caminhao_id'    => $caminhoes[$i]->id,
                'motorista_id'   => $caminhoes[$i]->motorista_id,
                'data'           => $data,
                'data_prevista'  => $data,
                'data_realizada' => $data,
                'status'         => 'fechado',
                'tipo'           => $tipo,
                'oficina'        => 'Oficina parceira UNIALFA',
                'descricao'      => $tipo.' realizada na oficina parceira.',
                'checklist'      => ['Filtros conferidos', 'Nível de fluidos ok', 'Teste de estrada'],
                'valor'          => $valor,
                'km'             => $caminhoes[$i]->km_atual - rand(100, 3000),
            ]);
        }

        Manutencao::create([
            'caminhao_id'   => $caminhoes[0]->id,
            'motorista_id'  => $caminhoes[0]->motorista_id,
            'data'          => now()->addDays(3)->toDateString(),
            'data_prevista' => now()->addDays(3)->toDateString(),
            'status'        => 'aberto',
            'tipo'          => 'Revisão preventiva',
            'oficina'       => 'Oficina parceira UNIALFA',
            'descricao'     => 'Revisão de suspensão e alinhamento antes da viagem longa.',
            'checklist'     => ['Suspensão', 'Alinhamento', 'Pneus'],
            'valor'         => 0,
            'km'            => $caminhoes[0]->km_atual,
        ]);
    }
}