<?php

namespace Tests\Feature;

use App\Models\Caminhao;
use App\Models\Motorista;
use App\Models\Tanque;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class GfcRegrasTest extends TestCase
{
    use RefreshDatabase;

    private function usuario(string $role, ?int $motoristaId = null): User
    {
        return User::factory()->create([
            'role' => $role,
            'is_active' => true,
            'motorista_id' => $motoristaId,
            'password' => 'Senha123',
        ]);
    }

    private function frota(): array
    {
        $motorista = Motorista::create([
            'nome' => 'Carlos Silva',
            'cpf' => '111.111.111-11',
            'cnh' => '12345678901',
            'telefone' => '(44) 99999-0001',
            'ativo' => true,
        ]);

        $caminhao = Caminhao::create([
            'placa' => 'ABC1D23',
            'modelo' => 'Volvo FH',
            'ano' => 2020,
            'capacidade_tanque' => 600,
            'km_atual' => 100000,
            'status' => 'ativo',
            'motorista_id' => $motorista->id,
        ]);

        $tanque = Tanque::create([
            'nome' => 'Tanque Diesel',
            'tipo_combustivel' => 'Diesel S10',
            'capacidade' => 10000,
            'nivel_atual' => 4000,
        ]);

        return compact('motorista', 'caminhao', 'tanque');
    }

    public function test_login_devolve_papel_e_token(): void
    {
        $this->usuario('administrador');
        $user = User::first();

        $this->postJson('/api/login', [
            'login' => $user->email,
            'password' => 'Senha123',
        ])->assertOk()
            ->assertJsonPath('user.role', 'administrador')
            ->assertJsonStructure(['token', 'usuario' => ['nome', 'email']]);
    }

    public function test_motorista_entra_com_cpf_e_senha_igual_ao_cpf(): void
    {
        $frota = $this->frota();
        $user = $this->usuario('motorista', $frota['motorista']->id);
        $user->password = '11111111111';
        $user->save();

        $this->postJson('/api/login', [
            'login' => '111.111.111-11',
            'password' => '11111111111',
        ])->assertOk()
            ->assertJsonPath('user.role', 'motorista');

        $this->postJson('/api/login', [
            'login' => '11111111111',
            'password' => '11111111111',
        ])->assertOk()
            ->assertJsonPath('user.role', 'motorista');

        // E-mail de motorista não autentica — Diego pediu CPF.
        $this->postJson('/api/login', [
            'login' => $user->email,
            'password' => '11111111111',
        ])->assertStatus(401);
    }

    public function test_esqueci_senha_notifica_admin_e_admin_redefine(): void
    {
        $frota = $this->frota();
        $motoristaUser = $this->usuario('motorista', $frota['motorista']->id);
        $motoristaUser->password = '11111111111';
        $motoristaUser->save();
        $admin = $this->usuario('administrador');

        $this->postJson('/api/senha/esqueci', ['cpf' => '111.111.111-11'])
            ->assertOk()
            ->assertJsonPath('message', 'Se o CPF estiver cadastrado, o administrador receberá o pedido.');

        // CPF inexistente: mesma mensagem (não vaza).
        $this->postJson('/api/senha/esqueci', ['cpf' => '999.999.999-99'])
            ->assertOk()
            ->assertJsonPath('message', 'Se o CPF estiver cadastrado, o administrador receberá o pedido.');

        $notif = $this->actingAs($admin, 'sanctum')->getJson('/api/notificacoes')->assertOk()->json();
        $pedido = collect($notif['itens'])->first(fn ($i) => str_starts_with($i['chave'], 'senha:'));
        $this->assertNotNull($pedido);
        $this->assertStringContainsString($frota['motorista']->nome, $pedido['texto']);
        $this->assertStringContainsString('111.111.111-11', $pedido['texto']);

        $this->actingAs($admin, 'sanctum')->putJson('/api/motoristas/'.$frota['motorista']->id.'/senha', [
            'password' => 'NovaSenha99',
            'password_confirmation' => 'NovaSenha99',
        ])->assertOk();

        // Resposta não traz a senha.
        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/motoristas/'.$frota['motorista']->id)
            ->assertOk()
            ->assertJsonMissingPath('password');

        $this->postJson('/api/login', [
            'login' => '111.111.111-11',
            'password' => 'NovaSenha99',
        ])->assertOk();

        $notif2 = $this->actingAs($admin, 'sanctum')->getJson('/api/notificacoes')->assertOk()->json();
        $ainda = collect($notif2['itens'])->first(fn ($i) => str_starts_with($i['chave'], 'senha:'));
        $this->assertNull($ainda);
    }

    public function test_motorista_nao_ve_relatorios(): void
    {
        $motorista = $this->usuario('motorista');

        $this->actingAs($motorista, 'sanctum')
            ->getJson('/api/relatorios/consumo')
            ->assertForbidden();
    }

    public function test_motorista_so_ve_o_caminhao_dele(): void
    {
        $frota = $this->frota();
        Motorista::create([
            'nome' => 'Outro', 'cpf' => '222.222.222-22', 'cnh' => '1', 'ativo' => true,
        ]);
        Caminhao::create([
            'placa' => 'XYZ9A99', 'modelo' => 'Scania', 'ano' => 2019,
            'capacidade_tanque' => 500, 'km_atual' => 1, 'status' => 'ativo',
        ]);

        $user = $this->usuario('motorista', $frota['motorista']->id);

        $lista = $this->actingAs($user, 'sanctum')->getJson('/api/caminhoes')->assertOk()->json();
        $this->assertCount(1, $lista);
        $this->assertSame('ABC1D23', $lista[0]['placa']);
    }

    public function test_abastecimento_na_base_desconta_tanque(): void
    {
        $frota = $this->frota();
        $admin = $this->usuario('administrador');

        $this->actingAs($admin, 'sanctum')->postJson('/api/abastecimentos', [
            'caminhao_id' => $frota['caminhao']->id,
            'origem' => 'base',
            'tanque_id' => $frota['tanque']->id,
            'litros' => 200,
            'km' => 100500,
            'data' => now()->toDateString(),
        ])->assertCreated();

        $this->assertEquals(3800, (float) $frota['tanque']->fresh()->nivel_atual);
        $this->assertEquals(100500, (int) $frota['caminhao']->fresh()->km_atual);
    }

    public function test_abastecimento_externo_exige_foto_e_nao_desconta_tanque(): void
    {
        Storage::fake('public');
        $frota = $this->frota();
        $user = $this->usuario('motorista', $frota['motorista']->id);

        $this->actingAs($user, 'sanctum')->postJson('/api/abastecimentos', [
            'caminhao_id' => $frota['caminhao']->id,
            'origem' => 'externo',
            'posto' => 'Posto Ipiranga',
            'litros' => 80,
            'km' => 100200,
            'data' => now()->toDateString(),
        ])->assertStatus(422);

        $this->actingAs($user, 'sanctum')->post('/api/abastecimentos', [
            'caminhao_id' => $frota['caminhao']->id,
            'origem' => 'externo',
            'posto' => 'Posto Ipiranga',
            'litros' => 80,
            'km' => 100200,
            'data' => now()->toDateString(),
            'comprovante' => UploadedFile::fake()->create('cupom.jpg', 80, 'image/jpeg'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $this->assertEquals(4000, (float) $frota['tanque']->fresh()->nivel_atual);
        $this->assertDatabaseHas('abastecimentos', ['origem' => 'externo', 'posto' => 'Posto Ipiranga']);
    }

    public function test_motorista_nao_cria_tanque_supervisor_cria(): void
    {
        $motorista = $this->usuario('motorista');
        $this->actingAs($motorista, 'sanctum')->postJson('/api/tanques', [
            'nome' => 'Gasolina',
            'tipo_combustivel' => 'Gasolina',
            'capacidade' => 5000,
            'nivel_atual' => 0,
        ])->assertForbidden();

        $supervisor = $this->usuario('supervisor');
        $this->actingAs($supervisor, 'sanctum')->postJson('/api/tanques', [
            'nome' => 'Gasolina',
            'tipo_combustivel' => 'Gasolina',
            'capacidade' => 5000,
            'nivel_atual' => 100,
        ])->assertCreated()->assertJsonPath('nome', 'Gasolina');
    }

    public function test_entrada_no_tanque_com_nota_e_foto(): void
    {
        Storage::fake('public');
        $frota = $this->frota();
        $admin = $this->usuario('administrador');

        $this->actingAs($admin, 'sanctum')->post('/api/tanques/'.$frota['tanque']->id.'/entradas', [
            'data' => now()->toDateString(),
            'litros' => 500,
            'valor_total' => 2945,
            'numero' => 'NF-9001',
            'fornecedor' => 'Distribuidora Paraná',
            'comprovante' => UploadedFile::fake()->create('nf.jpg', 80, 'image/jpeg'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $this->assertEquals(4500, (float) $frota['tanque']->fresh()->nivel_atual);
        $this->assertDatabaseHas('notas_fiscais', ['numero' => 'NF-9001']);
    }

    public function test_manutencao_agendada_e_troca_de_oleo(): void
    {
        $frota = $this->frota();
        $admin = $this->usuario('administrador');

        $this->actingAs($admin, 'sanctum')->postJson('/api/caminhoes/'.$frota['caminhao']->id.'/manutencoes', [
            'status' => 'aberto',
            'data_prevista' => now()->addDays(2)->toDateString(),
            'tipo' => 'Revisão preventiva',
            'oficina' => 'Oficina parceira',
            'descricao' => 'Ruído na suspensão dianteira.',
            'valor' => 0,
            'km' => 100000,
            'checklist' => ['Suspensão', 'Pneus'],
            'marcar_caminhao_manutencao' => true,
        ])->assertCreated()->assertJsonPath('manutencao.status', 'aberto');

        $this->assertSame('manutencao', $frota['caminhao']->fresh()->status);

        $this->actingAs($admin, 'sanctum')->postJson('/api/caminhoes/'.$frota['caminhao']->id.'/manutencoes', [
            'status' => 'fechado',
            'data_prevista' => now()->toDateString(),
            'data_realizada' => now()->toDateString(),
            'tipo' => 'Troca de óleo',
            'oficina' => 'Oficina parceira',
            'descricao' => 'Troca de óleo S15 15W40 e filtro.',
            'valor' => 850,
            'km' => 100200,
            'checklist' => ['Óleo e filtros'],
            'oleo_intervalo_km' => 10000,
        ])->assertCreated();

        $caminhao = $frota['caminhao']->fresh();
        $this->assertSame(100200, (int) $caminhao->oleo_ultima_km);
        $this->assertSame(10000, (int) $caminhao->oleo_intervalo_km);
        $this->assertSame('ok', $caminhao->oleo['alerta']);
        $this->assertSame(110200, $caminhao->oleo['proxima_km']);

        $hub = $this->actingAs($admin, 'sanctum')->getJson('/api/manutencao')->assertOk()->json();
        $this->assertNotEmpty($hub['caminhoes']);
    }

    public function test_primeira_manutencao_fechada_em_caminhao_sem_oleo(): void
    {
        $motorista = Motorista::create([
            'nome' => 'Novo Motorista',
            'cpf' => '333.333.333-33',
            'cnh' => '98765432100',
            'telefone' => '(44) 98888-0002',
            'ativo' => true,
        ]);

        $caminhao = Caminhao::create([
            'placa' => 'NEW1A11',
            'modelo' => 'VW Novo',
            'ano' => 2024,
            'capacidade_tanque' => 400,
            'km_atual' => 1500,
            'status' => 'ativo',
            'motorista_id' => $motorista->id,
            'oleo_ultima_data' => null,
            'oleo_ultima_km' => null,
            'oleo_proxima_data' => null,
        ]);

        $this->assertSame('sem_registro', $caminhao->oleo['alerta']);

        $admin = $this->usuario('administrador');

        $this->actingAs($admin, 'sanctum')->postJson('/api/caminhoes/'.$caminhao->id.'/manutencoes', [
            'status' => 'fechado',
            'data_prevista' => now()->toDateString(),
            'data_realizada' => now()->toDateString(),
            'tipo' => 'Troca de óleo',
            'oficina' => 'Oficina parceira',
            'descricao' => 'Primeira troca de óleo do caminhão novo.',
            'valor' => 500,
            'km' => 1500,
            'checklist' => ['Óleo e filtros'],
            'oleo_intervalo_km' => 10000,
        ])->assertCreated()
            ->assertJsonPath('manutencao.status', 'fechado')
            ->assertJsonPath('caminhao.oleo.alerta', 'ok');

        $this->actingAs($admin, 'sanctum')->postJson('/api/caminhoes/'.$caminhao->id.'/manutencoes', [
            'status' => 'fechado',
            'data_prevista' => now()->toDateString(),
            'data_realizada' => now()->addDay()->toDateString(),
            'tipo' => 'Troca de filtros',
            'oficina' => 'Oficina parceira',
            'descricao' => 'Data futura inválida.',
            'valor' => 100,
            'km' => 1500,
        ])->assertStatus(422)
            ->assertJsonPath('message', 'A data em que foi feita não pode ser posterior a hoje.')
            ->assertJsonPath('errors.data_realizada.0', 'A data em que foi feita não pode ser posterior a hoje.');
    }

    public function test_media_km_l_aparece_no_caminhao(): void
    {
        Storage::fake('public');
        $frota = $this->frota();
        $admin = $this->usuario('administrador');

        $this->actingAs($admin, 'sanctum');
        $this->postJson('/api/abastecimentos', [
            'caminhao_id' => $frota['caminhao']->id,
            'origem' => 'base',
            'tanque_id' => $frota['tanque']->id,
            'litros' => 200,
            'km' => 100000,
            'data' => now()->subDay()->toDateString(),
        ])->assertCreated();

        $this->postJson('/api/abastecimentos', [
            'caminhao_id' => $frota['caminhao']->id,
            'origem' => 'base',
            'tanque_id' => $frota['tanque']->id,
            'litros' => 100,
            'km' => 100300,
            'data' => now()->toDateString(),
        ])->assertCreated();

        $this->getJson('/api/caminhoes/'.$frota['caminhao']->id)
            ->assertOk()
            ->assertJsonPath('media_km_l', 3);
    }

    public function test_abastecimento_acima_do_limite_sem_motivo_nao_bloqueia(): void
    {
        $frota = $this->frota();
        $frota['motorista']->update([
            'limite_litros_dia' => 50,
            'credito_litros_mes' => 200,
        ]);
        $user = $this->usuario('motorista', $frota['motorista']->id);

        $this->actingAs($user, 'sanctum')->postJson('/api/abastecimentos', [
            'caminhao_id' => $frota['caminhao']->id,
            'origem' => 'base',
            'tanque_id' => $frota['tanque']->id,
            'litros' => 80,
            'km' => 100050,
            'data' => now()->toDateString(),
        ])->assertCreated()
            ->assertJsonPath('litros', 80);

        $this->assertNull($frota['caminhao']->fresh()->abastecimentos()->latest('id')->first()->motivo_excesso);
    }

    public function test_checklist_saida_expira_apos_24_horas(): void
    {
        $frota = $this->frota();
        $user = $this->usuario('motorista', $frota['motorista']->id);

        $this->actingAs($user, 'sanctum')->postJson('/api/checklists', [
            'caminhao_id' => $frota['caminhao']->id,
            'data' => now()->toDateString(),
            'itens' => [
                ['chave' => 'freios', 'ok' => true],
                ['chave' => 'luzes', 'ok' => true],
                ['chave' => 'pneus', 'ok' => true],
                ['chave' => 'oleo_agua', 'ok' => true],
                ['chave' => 'extintor', 'ok' => true],
                ['chave' => 'documentos', 'ok' => true],
                ['chave' => 'para_brisas', 'ok' => true],
                ['chave' => 'estepe', 'ok' => true],
            ],
        ])->assertCreated()->assertJsonPath('status', 'apto');

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/checklists/vigencia')
            ->assertOk()
            ->assertJsonPath('valido', true)
            ->assertJsonPath('pendente', false);

        $checklist = \App\Models\ChecklistPreViagem::query()->latest('id')->first();
        $checklist->created_at = now()->subHours(25);
        $checklist->save();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/checklists/vigencia')
            ->assertOk()
            ->assertJsonPath('valido', false)
            ->assertJsonPath('expirado', true)
            ->assertJsonPath('pendente', true);

        $dash = $this->actingAs($user, 'sanctum')->getJson('/api/dashboard')->assertOk()->json();
        $this->assertTrue($dash['checklist_saida']['pendente']);
        $this->assertSame($frota['caminhao']->placa, $dash['meu_caminhao']['placa']);
        $this->assertSame([], $dash['tanques']);
    }
}
