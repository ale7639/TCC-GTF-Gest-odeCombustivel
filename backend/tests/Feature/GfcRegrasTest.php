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
            'email' => $user->email,
            'password' => 'Senha123',
        ])->assertOk()
            ->assertJsonPath('user.role', 'administrador')
            ->assertJsonStructure(['token', 'usuario' => ['nome', 'email']]);
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
            'status' => 'agendada',
            'data_prevista' => now()->addDays(2)->toDateString(),
            'tipo' => 'Revisão preventiva',
            'descricao' => 'Ruído na suspensão dianteira.',
            'valor' => 0,
            'km' => 100000,
            'checklist' => ['Suspensão', 'Pneus'],
            'marcar_caminhao_manutencao' => true,
        ])->assertCreated()->assertJsonPath('manutencao.status', 'agendada');

        $this->assertSame('manutencao', $frota['caminhao']->fresh()->status);

        $this->actingAs($admin, 'sanctum')->postJson('/api/caminhoes/'.$frota['caminhao']->id.'/manutencoes', [
            'status' => 'concluida',
            'data_prevista' => now()->toDateString(),
            'data_realizada' => now()->toDateString(),
            'tipo' => 'Troca de óleo',
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
}
