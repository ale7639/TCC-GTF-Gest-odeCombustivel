<?php

namespace Tests\Feature;

use App\Models\NotificacaoLeitura;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PerfilNotificacoesTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create([
            'role' => 'administrador',
            'is_active' => true,
            'password' => 'Senha123',
            'name' => 'Diego Silva',
            'email' => 'diego@test.gfc',
        ]);
    }

    public function test_me_devolve_perfil_e_permite_atualizar(): void
    {
        $user = $this->admin();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('email', 'diego@test.gfc')
            ->assertJsonStructure(['name', 'role', 'telefone', 'motorista', 'caminhao']);

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/me', ['name' => 'Diego GFC', 'telefone' => '(62) 99999-1111'])
            ->assertOk()
            ->assertJsonPath('name', 'Diego GFC')
            ->assertJsonPath('telefone', '(62) 99999-1111');
    }

    public function test_alterar_senha_exige_senha_atual(): void
    {
        $user = $this->admin();

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/me/senha', [
                'senha_atual' => 'errada',
                'password' => 'NovaSenha1',
                'password_confirmation' => 'NovaSenha1',
            ])
            ->assertStatus(422);

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/me/senha', [
                'senha_atual' => 'Senha123',
                'password' => 'NovaSenha1',
                'password_confirmation' => 'NovaSenha1',
            ])
            ->assertOk();
    }

    public function test_notificacoes_podem_ser_marcadas_como_lidas(): void
    {
        $user = $this->admin();

        $lista = $this->actingAs($user, 'sanctum')
            ->getJson('/api/notificacoes')
            ->assertOk()
            ->json();

        $this->assertIsArray($lista['itens']);
        $this->assertArrayHasKey('nao_lidas', $lista);

        if (count($lista['itens']) === 0) {
            $this->actingAs($user, 'sanctum')
                ->postJson('/api/notificacoes/ler-todas')
                ->assertOk();

            return;
        }

        $chave = $lista['itens'][0]['chave'];
        $this->actingAs($user, 'sanctum')
            ->postJson('/api/notificacoes/ler', ['chave' => $chave])
            ->assertOk();

        $this->assertDatabaseHas('notificacao_leituras', [
            'user_id' => $user->id,
            'chave' => $chave,
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/notificacoes/ler-todas')
            ->assertOk();

        $this->assertGreaterThan(
            0,
            NotificacaoLeitura::where('user_id', $user->id)->count()
        );
    }
}
