<?php

namespace Tests\Feature;

use App\Models\Truck;
use App\Services\ChecklistService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChecklistDocsTest extends TestCase
{
    use RefreshDatabase;

    public function test_documentation_due_today_is_still_ok(): void
    {
        $truck = Truck::query()->create([
            'plate' => 'ABC-1234',
            'name' => 'FH 01',
            'model' => 'Volvo FH',
            'fuel_type' => 'Diesel S10',
            'tank_capacity' => 1200,
            'current_liters' => 400,
            'current_km' => 1000,
            'sector' => 'Logística',
            'status' => 'ativo',
            'crlv_expires_at' => now()->toDateString(),
            'insurance_expires_at' => now()->addMonth()->toDateString(),
            'license_expires_at' => now()->addMonth()->toDateString(),
        ]);

        $check = app(ChecklistService::class)->forTruck($truck);

        $this->assertSame('ok', $check['items']['documentacao']['status']);
    }
}
