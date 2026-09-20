<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_with_valid_credentials(): void
    {
        $user = User::factory()->create([
            'email' => 'diego@gfc.com.br',
            'password' => 'Senha123',
            'role' => User::ROLE_ADMIN,
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'diego@gfc.com.br',
            'password' => 'Senha123',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.name', $user->name)
            ->assertJsonStructure(['token', 'user']);
    }

    public function test_login_with_wrong_password_returns_generic_message(): void
    {
        User::factory()->create([
            'email' => 'diego@gfc.com.br',
            'password' => 'Senha123',
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'diego@gfc.com.br',
            'password' => 'errada',
        ]);

        $response->assertUnauthorized()
            ->assertJsonPath('message', 'E-mail ou senha inválidos. Verifique seus dados e tente novamente.');
    }

    public function test_unknown_email_does_not_reveal_account(): void
    {
        $response = $this->postJson('/api/login', [
            'email' => 'naoexiste@gfc.com.br',
            'password' => 'Senha123',
        ]);

        $response->assertUnauthorized()
            ->assertJsonPath('message', 'E-mail ou senha inválidos. Verifique seus dados e tente novamente.');
    }

    public function test_account_locks_after_five_failures(): void
    {
        User::factory()->create([
            'email' => 'diego@gfc.com.br',
            'password' => 'Senha123',
        ]);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/login', [
                'email' => 'diego@gfc.com.br',
                'password' => 'errada',
            ]);
        }

        $response = $this->postJson('/api/login', [
            'email' => 'diego@gfc.com.br',
            'password' => 'Senha123',
        ]);

        $response->assertStatus(423);
    }

    public function test_authenticated_user_can_change_password(): void
    {
        $user = User::factory()->create(['password' => 'Senha123']);
        Sanctum::actingAs($user);

        $this->putJson('/api/password', [
            'current_password' => 'Senha123',
            'password' => 'NovaSenha1',
            'password_confirmation' => 'NovaSenha1',
        ])->assertOk();

        $this->assertTrue(Hash::check('NovaSenha1', $user->fresh()->password));
    }
}
