<?php

namespace Tests\Feature;

use App\Models\FuelTank;
use App\Models\Truck;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DriverTruckScopeTest extends TestCase
{
    use RefreshDatabase;

    public function test_driver_lists_only_assigned_trucks(): void
    {
        $driver = User::factory()->create(['role' => User::ROLE_MOTORISTA]);
        $other = User::factory()->create(['role' => User::ROLE_MOTORISTA]);
        FuelTank::query()->create([
            'name' => 'Tanque Principal',
            'capacity_liters' => 20000,
            'current_liters' => 8000,
        ]);

        $mine = Truck::query()->create([
            'plate' => 'ABC-1234',
            'name' => 'FH 01',
            'model' => 'Volvo FH',
            'fuel_type' => 'Diesel S10',
            'tank_capacity' => 1200,
            'current_liters' => 200,
            'current_km' => 1000,
            'sector' => 'Logística',
            'driver_id' => $driver->id,
            'status' => 'ativo',
        ]);
        $theirs = Truck::query()->create([
            'plate' => 'DEF-5678',
            'name' => 'R450 02',
            'model' => 'Scania R450',
            'fuel_type' => 'Diesel S10',
            'tank_capacity' => 1200,
            'current_liters' => 200,
            'current_km' => 1000,
            'sector' => 'Logística',
            'driver_id' => $other->id,
            'status' => 'ativo',
        ]);

        Sanctum::actingAs($driver);

        $this->getJson('/api/trucks')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $mine->id);

        $this->getJson('/api/trucks/'.$mine->id)->assertOk();
        $this->getJson('/api/trucks/'.$theirs->id)->assertForbidden();
    }
}
