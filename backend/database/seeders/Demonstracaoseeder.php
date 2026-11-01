<?php

namespace Database\Seeders;

use App\Models\Abastecimento;
use App\Models\Caminhao;
use App\Models\EntradaCombustivel;
use App\Models\Lavagem;
use App\Models\LogAcesso;
use App\Models\Manutencao;
use App\Models\Motorista;
use App\Models\NotaFiscal;
use App\Models\Tanque;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

// Dados de demonstração para a apresentação: 90 dias de operação de uma frota pequena.
// Os eventos são gerados em ordem de data e passam pela MESMA conta do sistema
// (nível e valor do tanque, custo médio, km do caminhão), então todas as telas batem entre si.
//
// Uso (APAGA tudo e recria):  php artisan migrate:fresh --seed
class DemonstracaoSeeder extends Seeder
{
    private const DIAS = 90;

    public function run(): void
    {
        if (Caminhao::exists()) {
            $this->command?->warn('Já existem dados. Use "php artisan migrate:fresh --seed" para recriar do zero.');

            return;
        }

        mt_srand(2026); // sempre os mesmos dados
        $inicio = now()->startOfDay()->subDays(self::DIAS);

        // ---------------- Tanques ----------------
        $principal = Tanque::forceCreate([
            'nome' => 'Tanque Principal', 'tipo_combustivel' => 'Diesel S10', 'capacidade' => 15000,
            'nivel_atual' => 6000, 'valor_estoque' => 6000 * 5.79, 'principal' => true,
        ]);
        $reserva = Tanque::forceCreate([
            'nome' => 'Tanque Reserva', 'tipo_combustivel' => 'Diesel S10', 'capacidade' => 5000,
            // Começa baixo de propósito: a demonstração mostra o alerta de NÍVEL BAIXO.
            'nivel_atual' => 800, 'valor_estoque' => 800 * 5.99, 'principal' => false,
        ]);

        // ---------------- Motoristas (4 com login, 1 inativo) ----------------
        $pessoas = [
            ['Carlos Eduardo Silva',  'carlos@frota.com',  '44 98751-3965'],
            ['João Pedro Almeida',    'joao@frota.com',    '44 99832-1470'],
            ['Marcos Vinícius Souza', 'marcos@frota.com',  '44 99104-2288'],
            ['Rafael Oliveira Costa', 'rafael@frota.com',  '44 98420-7731'],
            ['Antônio Ferreira Lima', null,                '44 99967-0154'],
        ];
        $motoristas = [];
        foreach ($pessoas as $i => [$nome, $email, $telefone]) {
            $m = Motorista::forceCreate([
                'nome' => $nome, 'cpf' => $this->cpf(), 'cnh' => $this->digitos(11),
                'telefone' => $telefone, 'ativo' => $i < 4,
            ]);
            $motoristas[] = $m;

            if ($email) {
                User::forceCreate([
                    'name' => $nome, 'email' => $email, 'password' => Hash::make('motorista123'),
                    'perfil' => 'motorista', 'motorista_id' => $m->id,
                ]);
            }
        }

        // ---------------- Caminhões ----------------
        // [placa, modelo, ano, capacidade do tanque, km no início, consumo médio km/L]
        $frota = [
            ['ABC1D23', 'Volvo FH 540',                      2021, 900, 412300, 2.6],
            ['BRA2E19', 'Scania R 450',                      2020, 700, 538900, 2.9],
            ['PRN4F56', 'Mercedes-Benz Actros 2651',         2022, 800, 196400, 2.4],
            ['UMU7G88', 'DAF XF 530',                        2019, 700, 641250, 2.75],
        ];
        $caminhoes = [];
        foreach ($frota as $i => [$placa, $modelo, $ano, $cap, $km, $consumo]) {
            $caminhoes[] = [
                'modelo'  => Caminhao::forceCreate([
                    'placa' => $placa, 'modelo' => $modelo, 'ano' => $ano, 'capacidade_tanque' => $cap,
                    'km_atual' => $km, 'status' => 'ativo', 'motorista_id' => $motoristas[$i]->id,
                ]),
                'km'      => $km,
                'consumo' => $consumo,
                'cap'     => $cap,
            ];
        }
        // Um caminhão parado na oficina, sem motorista.
        Caminhao::forceCreate([
            'placa' => 'QWE5H21', 'modelo' => 'Volkswagen Constellation 24.280', 'ano' => 2018,
            'capacidade_tanque' => 400, 'km_atual' => 702880, 'status' => 'manutencao', 'motorista_id' => null,
        ]);

        // ---------------- Agenda de eventos ----------------
        $eventos = [];

        // Compras de combustível (com nota fiscal).
        $compras = [[8, 8000, 5.85], [22, 8000, 5.92], [37, 8000, 6.05], [52, 8000, 5.98], [67, 8000, 6.12], [82, 8000, 6.09]];
        foreach ($compras as [$dia, $litros, $preco]) {
            $eventos[] = ['dia' => $dia, 'ordem' => 0, 'tipo' => 'entrada', 'tanque' => $principal, 'litros' => $litros, 'preco' => $preco];
        }

        foreach ($caminhoes as $c => $cam) {
            // Abastecimentos a cada 3 ou 4 dias.
            for ($dia = 1 + $c; $dia <= self::DIAS - 3; $dia += mt_rand(3, 4)) {
                $eventos[] = ['dia' => $dia, 'ordem' => 1, 'tipo' => 'abastecimento', 'c' => $c];
            }
            // Lavagens a cada 10 a 12 dias.
            for ($dia = 4 + $c * 2; $dia <= self::DIAS; $dia += mt_rand(10, 12)) {
                $eventos[] = ['dia' => $dia, 'ordem' => 2, 'tipo' => 'lavagem', 'c' => $c];
            }
        }

        // Manutenções.
        $servicos = [
            [18, 0, 'Troca de óleo', 'Óleo do motor e filtros', 1280.00],
            [33, 1, 'Pneus', 'Troca dos 2 pneus dianteiros', 4860.00],
            [49, 2, 'Freios', 'Pastilhas e lonas do eixo traseiro', 1950.00],
            [61, 3, 'Revisão', 'Revisão dos 640 mil km', 3420.00],
            [74, 0, 'Pneus', 'Rodízio e alinhamento', 680.00],
            [86, 1, 'Troca de óleo', null, 1315.00],
        ];
        foreach ($servicos as [$dia, $c, $tipo, $descricao, $valor]) {
            $eventos[] = ['dia' => $dia, 'ordem' => 2, 'tipo' => 'manutencao', 'c' => $c,
                'servico' => $tipo, 'descricao' => $descricao, 'valor' => $valor];
        }

        usort($eventos, fn ($a, $b) => [$a['dia'], $a['ordem']] <=> [$b['dia'], $b['ordem']]);

        // ---------------- Execução, em ordem de data ----------------
        $postos = ['Posto Trevo Umuarama', 'Auto Posto Rodovia PR-323', 'Posto Estrela Maringá', 'Posto do Caminhoneiro Cascavel'];
        $notaSeq = 18240;

        foreach ($eventos as $e) {
            $data = $inicio->copy()->addDays($e['dia']);
            $hora = $data->copy()->setTime(mt_rand(6, 17), mt_rand(0, 59));

            if ($e['tipo'] === 'entrada') {
                $tanque = $e['tanque']->refresh();
                $litros = min($e['litros'], (float) $tanque->capacidade - (float) $tanque->nivel_atual);
                if ($litros < 500) continue;

                $valor = round($litros * $e['preco'], 2);
                $nota  = NotaFiscal::forceCreate([
                    'numero' => (string) $notaSeq++, 'fornecedor' => 'Distribuidora Paraná Combustíveis Ltda',
                    'data_emissao' => $data->toDateString(), 'valor_total' => $valor,
                    'chave_acesso' => '41' . $this->digitos(42), 'created_at' => $hora, 'updated_at' => $hora,
                ]);
                $nivel   = (float) $tanque->nivel_atual + $litros;
                $estoque = (float) $tanque->valor_estoque + $valor;
                EntradaCombustivel::forceCreate([
                    'tanque_id' => $tanque->id, 'nota_fiscal_id' => $nota->id, 'data' => $data->toDateString(),
                    'litros' => $litros, 'valor_total' => $valor, 'custo_medio_apos' => round($estoque / $nivel, 4),
                    'created_at' => $hora, 'updated_at' => $hora,
                ]);
                $tanque->forceFill(['nivel_atual' => $nivel, 'valor_estoque' => $estoque])->save();
                continue;
            }

            $cam       = &$caminhoes[$e['c']];
            $caminhao  = $cam['modelo'];
            $motorista = $caminhao->motorista_id;

            if ($e['tipo'] === 'lavagem') {
                Lavagem::forceCreate([
                    'caminhao_id' => $caminhao->id, 'motorista_id' => $motorista, 'data' => $data->toDateString(),
                    'valor' => null, 'observacao' => mt_rand(1, 4) === 1 ? 'Lavagem completa com chassi' : null,
                    'status' => 'aprovado', 'created_at' => $hora, 'updated_at' => $hora,
                ]);
                unset($cam);
                continue;
            }

            if ($e['tipo'] === 'manutencao') {
                Manutencao::forceCreate([
                    'caminhao_id' => $caminhao->id, 'motorista_id' => $motorista, 'data' => $data->toDateString(),
                    'tipo' => $e['servico'], 'descricao' => $e['descricao'], 'valor' => $e['valor'], 'km' => $cam['km'],
                    'status' => 'aprovado', 'created_at' => $hora, 'updated_at' => $hora,
                ]);
                unset($cam);
                continue;
            }

            // Abastecimento: o caminhão rodou desde o último e enche o tanque.
            // Litros = km rodados ÷ consumo do caminhão (com uma pequena variação), sem passar do tanque dele.
            $rodados = mt_rand(850, 1450);
            $cam['km'] += $rodados;
            $consumo = $cam['consumo'] + mt_rand(-15, 15) / 100;
            $litros  = min(round($rodados / $consumo), floor($cam['cap'] * 0.95));

            $this->abastecer($caminhao, $motorista, $data, $hora, $litros, $cam['km'], [$principal, $reserva], $postos);
            unset($cam);
        }

        // Km final de cada caminhão.
        foreach ($caminhoes as $cam) {
            $cam['modelo']->forceFill(['km_atual' => $cam['km']])->save();
        }

        // ---------------- Lançamentos para mostrar a aprovação ----------------
        $ontem = now()->subDay();
        $c0 = $caminhoes[0];
        Abastecimento::forceCreate([
            'caminhao_id' => $c0['modelo']->id, 'motorista_id' => $c0['modelo']->motorista_id, 'tanque_id' => $principal->id,
            'data' => $ontem->toDateString(), 'litros' => 410, 'km' => $c0['km'] + 1060, 'origem' => 'base',
            'status' => 'pendente', 'created_at' => $ontem->copy()->setTime(15, 20), 'updated_at' => $ontem,
        ]);
        $c2 = $caminhoes[2];
        Abastecimento::forceCreate([
            'caminhao_id' => $c2['modelo']->id, 'motorista_id' => $c2['modelo']->motorista_id, 'tanque_id' => null,
            'data' => now()->toDateString(), 'litros' => 380, 'km' => $c2['km'] + 920, 'origem' => 'externo',
            'posto' => 'Posto Estrela Maringá', 'nota_numero' => '553812', 'valor_total' => 2470.00,
            'status' => 'pendente', 'created_at' => now()->setTime(8, 45), 'updated_at' => now(),
        ]);
        $c1 = $caminhoes[1];
        Abastecimento::forceCreate([
            'caminhao_id' => $c1['modelo']->id, 'motorista_id' => $c1['modelo']->motorista_id, 'tanque_id' => null,
            'data' => now()->subDays(4)->toDateString(), 'litros' => 300, 'km' => $c1['km'], 'origem' => 'externo',
            'posto' => 'Posto do Caminhoneiro Cascavel', 'nota_numero' => '90217', 'valor_total' => 1950.00,
            'status' => 'recusado', 'motivo_recusa' => 'Nota fiscal ilegível. Envie a foto novamente.',
            'created_at' => now()->subDays(4)->setTime(19, 5), 'updated_at' => now()->subDays(3),
        ]);

        // ---------------- Log de acesso ----------------
        $acessos = [
            [6, 'admin@frota.com', true, null, '177.54.12.90', 'Chrome · Windows'],
            [5, 'carlos@frota.com', true, null, '191.36.140.22', 'Chrome · Android'],
            [4, 'joao@frota.com', false, 'Senha incorreta', '189.12.77.3', 'Chrome · Android'],
            [4, 'joao@frota.com', true, null, '189.12.77.3', 'Chrome · Android'],
            [3, 'admin@frota.com', true, null, '177.54.12.90', 'Chrome · Windows'],
            [2, 'gerente@frota.com', false, 'E-mail não cadastrado', '45.170.2.11', 'Firefox · Linux'],
            [2, 'admin@frota.com', false, 'Senha incorreta', '45.170.2.11', 'Firefox · Linux'],
            [1, 'marcos@frota.com', true, null, '200.150.8.40', 'Safari · iOS'],
            [0, 'admin@frota.com', true, null, '177.54.12.90', 'Chrome · Windows'],
        ];
        foreach ($acessos as [$diasAtras, $email, $ok, $motivo, $ip, $dispositivo]) {
            $quando = now()->subDays($diasAtras)->setTime(mt_rand(7, 19), mt_rand(0, 59));
            LogAcesso::forceCreate([
                'user_id' => User::where('email', $email)->value('id'), 'email' => $email, 'evento' => 'login',
                'sucesso' => $ok, 'motivo' => $motivo, 'ip' => $ip, 'dispositivo' => $dispositivo,
                'created_at' => $quando, 'updated_at' => $quando,
            ]);
        }

        $this->command?->info('Dados de demonstração criados. Motoristas: carlos@frota.com, joao@frota.com, marcos@frota.com, rafael@frota.com (senha: motorista123).');
    }

    // Abastecimento aprovado: sai do tanque principal; se faltar, do reserva; se faltar nos dois
    // (ou em ~15% das vezes, de propósito), é feito num posto fora da base.
    private function abastecer(Caminhao $caminhao, int $motorista, Carbon $data, Carbon $hora, float $litros, int $km, array $tanques, array $postos): void
    {
        $base = [
            'caminhao_id' => $caminhao->id, 'motorista_id' => $motorista, 'data' => $data->toDateString(),
            'litros' => $litros, 'km' => $km, 'status' => 'aprovado', 'created_at' => $hora, 'updated_at' => $hora,
        ];

        $tanque = null;
        if (mt_rand(1, 100) > 15) {
            foreach ($tanques as $t) {
                if ((float) $t->refresh()->nivel_atual >= $litros) {
                    $tanque = $t;
                    break;
                }
            }
        }

        if ($tanque) {
            $nivel      = (float) $tanque->nivel_atual;
            $custoLitro = (float) $tanque->valor_estoque / $nivel;
            $custoTotal = $litros * $custoLitro;
            $novoNivel  = $nivel - $litros;

            Abastecimento::forceCreate($base + [
                'tanque_id' => $tanque->id, 'origem' => 'base',
                'custo_litro' => round($custoLitro, 4), 'custo_total' => round($custoTotal, 4),
            ]);
            $tanque->forceFill([
                'nivel_atual'   => $novoNivel,
                'valor_estoque' => $novoNivel > 0.0001 ? max(0, (float) $tanque->valor_estoque - $custoTotal) : 0,
            ])->save();

            return;
        }

        $preco = mt_rand(629, 669) / 100;
        $valor = round($litros * $preco, 2);
        Abastecimento::forceCreate($base + [
            'tanque_id' => null, 'origem' => 'externo', 'posto' => $postos[array_rand($postos)],
            'nota_numero' => (string) mt_rand(100000, 999999), 'valor_total' => $valor,
            'custo_litro' => round($preco, 4), 'custo_total' => $valor,
        ]);
    }

    private function digitos(int $n): string
    {
        $s = '';
        for ($i = 0; $i < $n; $i++) {
            $s .= mt_rand(0, 9);
        }

        return $s;
    }

    // CPF fictício, mas com dígitos verificadores válidos, no formato 000.000.000-00.
    private function cpf(): string
    {
        $n = array_map('intval', str_split($this->digitos(9)));
        for ($t = 9; $t < 11; $t++) {
            $soma = 0;
            for ($i = 0; $i < $t; $i++) {
                $soma += $n[$i] * (($t + 1) - $i);
            }
            $n[$t] = ((10 * $soma) % 11) % 10;
        }
        $d = implode('', $n);

        return substr($d, 0, 3) . '.' . substr($d, 3, 3) . '.' . substr($d, 6, 3) . '-' . substr($d, 9, 2);
    }
}