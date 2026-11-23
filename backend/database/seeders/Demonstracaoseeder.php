<?php

// =====================================================================================
// DemonstracaoSeeder — DADOS DE DEMONSTRAÇÃO para a apresentação.
//
// Cria 90 dias de operação de uma frota pequena: 2 tanques, 5 motoristas (4 com login),
// 5 caminhões, compras de combustível com nota, abastecimentos (na base e em postos),
// lavagens, manutenções, lançamentos pendentes/recusado e linhas no log de acesso.
//
// O mais importante: os eventos são gerados EM ORDEM DE DATA e fazem as MESMAS contas que o
// sistema faz (nível do tanque, valor do estoque, custo médio, km do caminhão). Por isso todas
// as telas batem entre si: o painel, os tanques, os relatórios e o consumo km/L fazem sentido.
//
// Quem chama: o DatabaseSeeder, depois do AdminSeeder.
// Uso (APAGA tudo e recria):  php artisan migrate:fresh --seed
//
// Login dos motoristas criados: pelo CPF e senha "motorista123". Os CPFs aparecem no terminal
// ao final do comando (e na tela Motoristas). Os e-mails gravados abaixo são de quando o motorista
// entrava por e-mail; hoje ele entra só pelo CPF (o e-mail ficou só para o log de acesso de exemplo).
// =====================================================================================

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
use Illuminate\Support\Carbon;             // datas
use Illuminate\Support\Facades\Hash;

// Dados de demonstração para a apresentação: 90 dias de operação de uma frota pequena.
// Os eventos são gerados em ordem de data e passam pela MESMA conta do sistema
// (nível e valor do tanque, custo médio, km do caminhão), então todas as telas batem entre si.
//
// Uso (APAGA tudo e recria):  php artisan migrate:fresh --seed
class DemonstracaoSeeder extends Seeder
{
    // Quantos dias de histórico são gerados (de 90 dias atrás até hoje).
    private const DIAS = 90;

    public function run(): void
    {
        // Proteção: se já há caminhões, não mistura dados novos com os antigos.
        // $this->command?->warn(...) = escreve um aviso amarelo no terminal.
        if (Caminhao::exists()) {
            $this->command?->warn('Já existem dados. Use "php artisan migrate:fresh --seed" para recriar do zero.');

            return;
        }

        // Semente fixa do sorteio: os números "aleatórios" saem SEMPRE iguais.
        // Assim os dados (e os CPFs) são os mesmos toda vez que o banco é recriado.
        mt_srand(2026); // sempre os mesmos dados
        // Primeiro dia da simulação: meia-noite de 90 dias atrás.
        $inicio = now()->startOfDay()->subDays(self::DIAS);

        // ---------------- Tanques ----------------
        // forceCreate porque valor_estoque e principal são controlados pelo sistema (não vêm da tela).
        // valor_estoque = litros × preço: é o ponto de partida do custo médio de cada tanque.
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
        // [nome, e-mail (null = sem login), telefone]
        $pessoas = [
            ['Carlos Eduardo Silva',  'carlos@frota.com',  '44 98751-3965'],
            ['João Pedro Almeida',    'joao@frota.com',    '44 99832-1470'],
            ['Marcos Vinícius Souza', 'marcos@frota.com',  '44 99104-2288'],
            ['Rafael Oliveira Costa', 'rafael@frota.com',  '44 98420-7731'],
            ['Antônio Ferreira Lima', null,                '44 99967-0154'],
        ];
        $motoristas = [];
        // "[$nome, $email, $telefone]" = desmonta cada linha do array em três variáveis.
        foreach ($pessoas as $i => [$nome, $email, $telefone]) {
            $m = Motorista::forceCreate([
                // cpf() e digitos() estão no fim do arquivo: CPF válido e CNH com 11 números.
                'nome' => $nome, 'cpf' => $this->cpf(), 'cnh' => $this->digitos(11),
                // $i < 4 = os 4 primeiros ativos; o 5º (Antônio) fica inativo.
                'telefone' => $telefone, 'ativo' => $i < 4,
            ]);
            $motoristas[] = $m;   // "[] =" acrescenta no fim do array

            // Quem tem e-mail na lista ganha LOGIN (tabela users) com perfil motorista.
            if ($email) {
                User::forceCreate([
                    'name' => $nome, 'email' => $email, 'password' => Hash::make('motorista123'),
                    'perfil' => 'motorista', 'motorista_id' => $m->id,
                ]);
            }
        }

        // ---------------- Caminhões ----------------
        // [placa, modelo, ano, capacidade do tanque, km no início, consumo médio km/L]
        // O consumo médio aqui NÃO vai para o banco: é usado só para calcular quantos litros
        // cada caminhão gasta na simulação (assim o km/L dos relatórios sai realista).
        $frota = [
            ['ABC1D23', 'Volvo FH 540',                      2021, 900, 412300, 2.6],
            ['BRA2E19', 'Scania R 450',                      2020, 700, 538900, 2.9],
            ['PRN4F56', 'Mercedes-Benz Actros 2651',         2022, 800, 196400, 2.4],
            ['UMU7G88', 'DAF XF 530',                        2019, 700, 641250, 2.75],
        ];
        $caminhoes = [];
        foreach ($frota as $i => [$placa, $modelo, $ano, $cap, $km, $consumo]) {
            // Guarda o caminhão criado e, ao lado, os números da simulação (km, consumo, capacidade).
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
        // Primeiro monta uma "agenda" com tudo o que vai acontecer; depois executa em ordem de data.
        // 'dia' = quantos dias depois do início; 'ordem' = no mesmo dia, quem vem primeiro
        // (0 = compra, 1 = abastecimento, 2 = lavagem/manutenção). A compra vem antes para o tanque ter estoque.
        $eventos = [];

        // Compras de combustível (com nota fiscal).
        // [dia, litros, preço por litro]: o preço varia, e é isso que faz o custo médio mudar.
        $compras = [[8, 8000, 5.85], [22, 8000, 5.92], [37, 8000, 6.05], [52, 8000, 5.98], [67, 8000, 6.12], [82, 8000, 6.09]];
        foreach ($compras as [$dia, $litros, $preco]) {
            $eventos[] = ['dia' => $dia, 'ordem' => 0, 'tipo' => 'entrada', 'tanque' => $principal, 'litros' => $litros, 'preco' => $preco];
        }

        foreach ($caminhoes as $c => $cam) {
            // Abastecimentos a cada 3 ou 4 dias.
            // mt_rand(3, 4) = sorteia 3 ou 4 (com a semente fixa, sempre a mesma sequência).
            for ($dia = 1 + $c; $dia <= self::DIAS - 3; $dia += mt_rand(3, 4)) {
                $eventos[] = ['dia' => $dia, 'ordem' => 1, 'tipo' => 'abastecimento', 'c' => $c];
            }
            // Lavagens a cada 10 a 12 dias.
            for ($dia = 4 + $c * 2; $dia <= self::DIAS; $dia += mt_rand(10, 12)) {
                $eventos[] = ['dia' => $dia, 'ordem' => 2, 'tipo' => 'lavagem', 'c' => $c];
            }
        }

        // Manutenções.
        // [dia, índice do caminhão, tipo, descrição, valor]
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

        // Ordena a agenda por dia e, no mesmo dia, pela ordem.
        // "<=>" (nave espacial) compara dois valores: devolve -1, 0 ou 1 (usado pelo usort).
        usort($eventos, fn ($a, $b) => [$a['dia'], $a['ordem']] <=> [$b['dia'], $b['ordem']]);

        // ---------------- Execução, em ordem de data ----------------
        $postos = ['Posto Trevo Umuarama', 'Auto Posto Rodovia PR-323', 'Posto Estrela Maringá', 'Posto do Caminhoneiro Cascavel'];
        $notaSeq = 18240;   // número da próxima nota fiscal de compra

        foreach ($eventos as $e) {
            // copy() = cópia da data (senão addDays mudaria o $inicio para todos os eventos).
            $data = $inicio->copy()->addDays($e['dia']);
            // Hora sorteada entre 6h e 17h59, para os registros parecerem reais.
            $hora = $data->copy()->setTime(mt_rand(6, 17), mt_rand(0, 59));

            // ---- Compra de combustível: mesma conta do EntradaCombustivelController ----
            if ($e['tipo'] === 'entrada') {
                $tanque = $e['tanque']->refresh();   // refresh = relê o tanque do banco (nível atualizado)
                // Compra só o que cabe no tanque; se couber menos de 500 L, pula esta compra.
                $litros = min($e['litros'], (float) $tanque->capacidade - (float) $tanque->nivel_atual);
                if ($litros < 500) continue;

                $valor = round($litros * $e['preco'], 2);
                $nota  = NotaFiscal::forceCreate([
                    'numero' => (string) $notaSeq++, 'fornecedor' => 'Distribuidora Paraná Combustíveis Ltda',
                    // Chave de acesso fictícia: "41" (código do Paraná) + 42 números = 44 dígitos.
                    'data_emissao' => $data->toDateString(), 'valor_total' => $valor,
                    'chave_acesso' => '41' . $this->digitos(42), 'created_at' => $hora, 'updated_at' => $hora,
                ]);
                // Custo médio ponderado: soma litros e valor; custo = valor ÷ litros.
                $nivel   = (float) $tanque->nivel_atual + $litros;
                $estoque = (float) $tanque->valor_estoque + $valor;
                EntradaCombustivel::forceCreate([
                    'tanque_id' => $tanque->id, 'nota_fiscal_id' => $nota->id, 'data' => $data->toDateString(),
                    'litros' => $litros, 'valor_total' => $valor, 'custo_medio_apos' => round($estoque / $nivel, 4),
                    'created_at' => $hora, 'updated_at' => $hora,
                ]);
                $tanque->forceFill(['nivel_atual' => $nivel, 'valor_estoque' => $estoque])->save();
                continue;   // vai para o próximo evento
            }

            // "&" = REFERÊNCIA: mexer em $cam muda o item dentro de $caminhoes (o km acumula).
            // Por isso, depois de usar, vem o unset($cam), que desfaz a referência.
            $cam       = &$caminhoes[$e['c']];
            $caminhao  = $cam['modelo'];
            $motorista = $caminhao->motorista_id;

            // ---- Lavagem: sem valor, já aprovada ----
            if ($e['tipo'] === 'lavagem') {
                Lavagem::forceCreate([
                    'caminhao_id' => $caminhao->id, 'motorista_id' => $motorista, 'data' => $data->toDateString(),
                    // 1 em cada 4 lavagens (sorteio) ganha uma observação.
                    'valor' => null, 'observacao' => mt_rand(1, 4) === 1 ? 'Lavagem completa com chassi' : null,
                    'status' => 'aprovado', 'created_at' => $hora, 'updated_at' => $hora,
                ]);
                unset($cam);
                continue;
            }

            // ---- Manutenção: usa o km que o caminhão tem naquele dia da simulação ----
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
            // Ex.: rodou 1.200 km com consumo 2,6 km/L -> 1.200 ÷ 2,6 = 462 L.
            $rodados = mt_rand(850, 1450);
            $cam['km'] += $rodados;
            // Variação de -0,15 a +0,15 km/L, para o consumo não sair sempre igual.
            $consumo = $cam['consumo'] + mt_rand(-15, 15) / 100;
            // floor($cap * 0.95) = no máximo 95% do tanque do caminhão.
            $litros  = min(round($rodados / $consumo), floor($cam['cap'] * 0.95));

            $this->abastecer($caminhao, $motorista, $data, $hora, $litros, $cam['km'], [$principal, $reserva], $postos);
            unset($cam);
        }

        // Km final de cada caminhão.
        // Grava no caminhão o km acumulado na simulação (o km do último abastecimento).
        foreach ($caminhoes as $cam) {
            $cam['modelo']->forceFill(['km_atual' => $cam['km']])->save();
        }

        // ---------------- Lançamentos para mostrar a aprovação ----------------
        // Ficam PENDENTES (não mexem em tanque nem em km até o admin aprovar na apresentação).
        $ontem = now()->subDay();
        // 1) Abastecimento NA BASE, pendente, de ontem (caminhão 1: ABC1D23).
        $c0 = $caminhoes[0];
        Abastecimento::forceCreate([
            'caminhao_id' => $c0['modelo']->id, 'motorista_id' => $c0['modelo']->motorista_id, 'tanque_id' => $principal->id,
            'data' => $ontem->toDateString(), 'litros' => 410, 'km' => $c0['km'] + 1060, 'origem' => 'base',
            'status' => 'pendente', 'created_at' => $ontem->copy()->setTime(15, 20), 'updated_at' => $ontem,
        ]);
        // 2) Abastecimento FORA DA BASE (posto), pendente, de hoje (caminhão 3: PRN4F56).
        $c2 = $caminhoes[2];
        Abastecimento::forceCreate([
            'caminhao_id' => $c2['modelo']->id, 'motorista_id' => $c2['modelo']->motorista_id, 'tanque_id' => null,
            'data' => now()->toDateString(), 'litros' => 380, 'km' => $c2['km'] + 920, 'origem' => 'externo',
            'posto' => 'Posto Estrela Maringá', 'nota_numero' => '553812', 'valor_total' => 2470.00,
            'status' => 'pendente', 'created_at' => now()->setTime(8, 45), 'updated_at' => now(),
        ]);
        // 3) Abastecimento RECUSADO, com motivo (aparece na aba Recusados e no app do motorista).
        $c1 = $caminhoes[1];
        Abastecimento::forceCreate([
            'caminhao_id' => $c1['modelo']->id, 'motorista_id' => $c1['modelo']->motorista_id, 'tanque_id' => null,
            'data' => now()->subDays(4)->toDateString(), 'litros' => 300, 'km' => $c1['km'], 'origem' => 'externo',
            'posto' => 'Posto do Caminhoneiro Cascavel', 'nota_numero' => '90217', 'valor_total' => 1950.00,
            'status' => 'recusado', 'motivo_recusa' => 'Nota fiscal ilegível. Envie a foto novamente.',
            'created_at' => now()->subDays(4)->setTime(19, 5), 'updated_at' => now()->subDays(3),
        ]);

        // ---------------- Log de acesso ----------------
        // [dias atrás, login digitado, sucesso, motivo da falha, IP, dispositivo]
        // Inclui falhas de propósito (senha incorreta, e-mail não cadastrado) para a tela de log ter o que mostrar.
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
                // value('id') = o id do usuário com esse e-mail (null se não existir, como o "gerente").
                'user_id' => User::where('email', $email)->value('id'), 'email' => $email, 'evento' => 'login',
                'sucesso' => $ok, 'motivo' => $motivo, 'ip' => $ip, 'dispositivo' => $dispositivo,
                'created_at' => $quando, 'updated_at' => $quando,
            ]);
        }

        // Mensagem verde no terminal ao terminar, com os logins para a apresentação.
        // O motorista entra pelo CPF, então a mensagem mostra o CPF de cada motorista que tem login.
        // filter(fn ($m, $i) ...) = fica só com quem tem e-mail na lista $pessoas (os que ganharam login);
        // map = transforma cada um em "Nome: CPF"; implode = junta tudo numa linha por motorista.
        $comLogin = collect($motoristas)
            ->filter(fn ($m, $i) => $pessoas[$i][1] !== null)
            ->map(fn ($m) => '  ' . $m->nome . ': ' . $m->cpf)
            ->implode(PHP_EOL);

        $this->command?->info('Dados de demonstração criados.');
        $this->command?->info('Admin: admin@frota.com | senha: admin123');
        $this->command?->info('Motoristas (entram com o CPF | senha: motorista123):' . PHP_EOL . $comLogin);
    }

    // Abastecimento aprovado: sai do tanque principal; se faltar, do reserva; se faltar nos dois
    // (ou em ~15% das vezes, de propósito), é feito num posto fora da base.
    // Faz a mesma conta do AbastecimentoController::store (custo médio na saída).
    private function abastecer(Caminhao $caminhao, int $motorista, Carbon $data, Carbon $hora, float $litros, int $km, array $tanques, array $postos): void
    {
        // Campos comuns aos dois casos (base e posto).
        $base = [
            'caminhao_id' => $caminhao->id, 'motorista_id' => $motorista, 'data' => $data->toDateString(),
            'litros' => $litros, 'km' => $km, 'status' => 'aprovado', 'created_at' => $hora, 'updated_at' => $hora,
        ];

        // Procura um tanque com combustível suficiente (o principal primeiro).
        // mt_rand(1, 100) > 15 = em 85% das vezes tenta a base; nos outros 15%, vai direto ao posto.
        $tanque = null;
        if (mt_rand(1, 100) > 15) {
            foreach ($tanques as $t) {
                if ((float) $t->refresh()->nivel_atual >= $litros) {
                    $tanque = $t;
                    break;   // achou: para de procurar
                }
            }
        }

        // Na base: custo médio = valor do estoque ÷ litros; o tanque perde litros e valor.
        if ($tanque) {
            $nivel      = (float) $tanque->nivel_atual;
            $custoLitro = (float) $tanque->valor_estoque / $nivel;
            $custoTotal = $litros * $custoLitro;
            $novoNivel  = $nivel - $litros;

            // "$base + [...]" = junta os campos comuns com os campos da base.
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

        // Fora da base: preço de posto entre R$ 6,29 e R$ 6,69; o custo é o valor pago (como na aprovação).
        $preco = mt_rand(629, 669) / 100;
        $valor = round($litros * $preco, 2);
        Abastecimento::forceCreate($base + [
            // array_rand = sorteia um dos postos da lista.
            'tanque_id' => null, 'origem' => 'externo', 'posto' => $postos[array_rand($postos)],
            'nota_numero' => (string) mt_rand(100000, 999999), 'valor_total' => $valor,
            'custo_litro' => round($preco, 4), 'custo_total' => $valor,
        ]);
    }

    // Texto com $n números sorteados (usado na CNH e na chave de acesso).
    private function digitos(int $n): string
    {
        $s = '';
        for ($i = 0; $i < $n; $i++) {
            $s .= mt_rand(0, 9);   // ".=" acrescenta no fim do texto
        }

        return $s;
    }

    // CPF fictício, mas com dígitos verificadores válidos, no formato 000.000.000-00.
    // Sorteia os 9 primeiros números e CALCULA os 2 últimos com o algoritmo oficial
    // (o mesmo que o MotoristaController::cpfValido confere). Assim o CPF passa na validação.
    private function cpf(): string
    {
        // str_split = separa o texto em caracteres; intval = transforma cada um em número.
        $n = array_map('intval', str_split($this->digitos(9)));
        for ($t = 9; $t < 11; $t++) {
            $soma = 0;
            for ($i = 0; $i < $t; $i++) {
                $soma += $n[$i] * (($t + 1) - $i);
            }
            $n[$t] = ((10 * $soma) % 11) % 10;
        }
        $d = implode('', $n);   // junta os 11 números num texto só

        return substr($d, 0, 3) . '.' . substr($d, 3, 3) . '.' . substr($d, 6, 3) . '-' . substr($d, 9, 2);
    }
}