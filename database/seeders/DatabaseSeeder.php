<?php

namespace Database\Seeders;

use App\Models\Fueling;
use App\Models\FuelTank;
use App\Models\Maintenance;
use App\Models\Truck;
use App\Models\User;
use App\Models\Wash;
use App\Services\AlertService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (User::query()->exists()) {
            return;
        }

        $admin = User::query()->create([
            'name' => 'Diego Silva',
            'email' => 'diego@gfc.com.br',
            'password' => Hash::make('Senha123'),
            'role' => User::ROLE_ADMIN,
            'is_active' => true,
        ]);

        $supervisor = User::query()->create([
            'name' => 'Ana Souza',
            'email' => 'ana@gfc.com.br',
            'password' => Hash::make('Senha123'),
            'role' => User::ROLE_SUPERVISOR,
            'is_active' => true,
        ]);

        $driver = User::query()->create([
            'name' => 'João Santos',
            'email' => 'joao@gfc.com.br',
            'password' => Hash::make('Senha123'),
            'role' => User::ROLE_MOTORISTA,
            'is_active' => true,
        ]);

        FuelTank::query()->create([
            'name' => 'Tanque Principal',
            'capacity_liters' => 20000,
            'current_liters' => 12500,
        ]);

        $abc = Truck::query()->create([
            'plate' => 'ABC-1234',
            'name' => 'FH 01',
            'model' => 'Volvo FH',
            'fuel_type' => 'Diesel S10',
            'tank_capacity' => 1200,
            'current_liters' => 550,
            'current_km' => 128450,
            'sector' => 'Logística',
            'driver_id' => $driver->id,
            'wash_frequency_days' => 7,
            'next_maintenance_date' => now()->addDays(40),
            'next_maintenance_km' => 135000,
            'crlv_expires_at' => now()->addMonths(8),
            'insurance_expires_at' => now()->addMonths(6),
            'license_expires_at' => now()->addMonths(10),
            'status' => 'ativo',
            'last_verified_at' => now()->subHours(6),
            'last_verified_by' => $admin->id,
        ]);

        $def = Truck::query()->create([
            'plate' => 'DEF-5678',
            'name' => 'R450 02',
            'model' => 'Scania R450',
            'fuel_type' => 'Diesel S10',
            'tank_capacity' => 1200,
            'current_liters' => 780,
            'current_km' => 98210,
            'sector' => 'Distribuição',
            'driver_id' => $driver->id,
            'wash_frequency_days' => 7,
            'next_maintenance_date' => now()->addDays(20),
            'next_maintenance_km' => 102000,
            'crlv_expires_at' => now()->addMonths(4),
            'insurance_expires_at' => now()->addMonths(5),
            'license_expires_at' => now()->addMonths(4),
            'status' => 'ativo',
        ]);

        $ghj = Truck::query()->create([
            'plate' => 'GHJ-9100',
            'name' => 'Actros 03',
            'model' => 'Mercedes-Benz Actros',
            'fuel_type' => 'Diesel S10',
            'tank_capacity' => 1100,
            'current_liters' => 310,
            'current_km' => 210340,
            'sector' => 'Longa Distância',
            'wash_frequency_days' => 7,
            'next_maintenance_date' => now()->subDays(2),
            'next_maintenance_km' => 209000,
            'crlv_expires_at' => now()->addMonths(3),
            'insurance_expires_at' => now()->addMonths(2),
            'license_expires_at' => now()->addMonths(3),
            'status' => 'ativo',
        ]);

        $jkl = Truck::query()->create([
            'plate' => 'JKL-1111',
            'name' => 'Constellation 04',
            'model' => 'VW Constellation',
            'fuel_type' => 'Diesel S10',
            'tank_capacity' => 1000,
            'current_liters' => 640,
            'current_km' => 76400,
            'sector' => 'Coleta',
            'wash_frequency_days' => 7,
            'next_maintenance_date' => now()->addDays(15),
            'next_maintenance_km' => 80000,
            'crlv_expires_at' => now()->addDays(10),
            'insurance_expires_at' => now()->addMonths(2),
            'license_expires_at' => now()->addMonths(2),
            'status' => 'ativo',
        ]);

        $mno = Truck::query()->create([
            'plate' => 'MNO-2222',
            'name' => 'S-Way 05',
            'model' => 'Iveco S-Way',
            'fuel_type' => 'Diesel S10',
            'tank_capacity' => 1150,
            'current_liters' => 180,
            'current_km' => 54320,
            'sector' => 'Logística',
            'wash_frequency_days' => 7,
            'next_maintenance_date' => now()->addDays(25),
            'next_maintenance_km' => 60000,
            'crlv_expires_at' => now()->addMonths(7),
            'insurance_expires_at' => now()->addMonths(7),
            'license_expires_at' => now()->addMonths(7),
            'status' => 'ativo',
        ]);

        foreach ([$abc, $def, $jkl] as $truck) {
            Wash::query()->create([
                'truck_id' => $truck->id,
                'user_id' => $driver->id,
                'washed_at' => now()->subDays(2),
            ]);
        }

        Wash::query()->create([
            'truck_id' => $ghj->id,
            'user_id' => $driver->id,
            'washed_at' => now()->subDays(3),
        ]);

        Wash::query()->create([
            'truck_id' => $mno->id,
            'user_id' => $driver->id,
            'washed_at' => now()->subDays(10),
        ]);

        Maintenance::query()->create([
            'truck_id' => $abc->id,
            'user_id' => $supervisor->id,
            'service_date' => now()->subDays(50),
            'km' => 123000,
            'description' => 'Revisão preventiva 120 mil km',
            'next_date' => now()->addDays(40),
            'next_km' => 135000,
        ]);

        $this->seedFuelings($abc, $def, $ghj, $jkl, $mno, $driver, $supervisor);

        app(AlertService::class)->generateDaily();
    }

    private function seedFuelings(Truck $abc, Truck $def, Truck $ghj, Truck $jkl, Truck $mno, User $driver, User $supervisor): void
    {
        $rows = [
            [$abc, 300, 8],
            [$abc, 280, 6],
            [$abc, 250, 3],
            [$def, 320, 7],
            [$def, 290, 4],
            [$ghj, 260, 5],
            [$jkl, 180, 2],
            [$mno, 220, 1],
            [$abc, 200, 0],
        ];

        foreach ($rows as [$truck, $qty, $daysAgo]) {
            Fueling::query()->create([
                'truck_id' => $truck->id,
                'user_id' => $daysAgo % 2 === 0 ? $driver->id : $supervisor->id,
                'quantity_liters' => $qty,
                'tank_before' => 12500 + $qty,
                'tank_after' => 12500,
                'truck_before' => max(0, $truck->current_liters - $qty),
                'truck_after' => $truck->current_liters,
                'km_at_fueling' => $truck->current_km,
                'ip_address' => '127.0.0.1',
                'created_at' => now()->subDays($daysAgo)->setTime(10, 30),
                'updated_at' => now()->subDays($daysAgo)->setTime(10, 30),
            ]);
        }
    }
}
