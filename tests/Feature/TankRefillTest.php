<?php

namespace Tests\Feature;

use App\Models\FuelTank;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TankRefillTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_refill_central_tank(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        FuelTank::query()->create([
            'name' => 'Tanque Principal',
            'capacity_liters' => 20000,
            'current_liters' => 1000,
        ]);

        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/tank/refill', ['quantity' => 500]);

        $response->assertOk()
            ->assertJsonPath('tank.current', 1500);
        $this->assertEquals(1500, (float) FuelTank::query()->first()->current_liters);
    }

    public function test_refill_cannot_exceed_capacity(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        FuelTank::query()->create([
            'name' => 'Tanque Principal',
            'capacity_liters' => 1000,
            'current_liters' => 900,
        ]);

        Sanctum::actingAs($admin);

        $this->postJson('/api/tank/refill', ['quantity' => 200])->assertStatus(422);
        $this->assertEquals(900, (float) FuelTank::query()->first()->current_liters);
    }

    public function test_driver_cannot_refill_tank(): void
    {
        $driver = User::factory()->create(['role' => User::ROLE_MOTORISTA]);
        FuelTank::query()->create([
            'name' => 'Tanque Principal',
            'capacity_liters' => 20000,
            'current_liters' => 1000,
        ]);

        Sanctum::actingAs($driver);

        $this->postJson('/api/tank/refill', ['quantity' => 100])->assertForbidden();
    }
}
