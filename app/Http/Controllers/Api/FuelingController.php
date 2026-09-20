<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFuelingRequest;
use App\Models\FuelTank;
use App\Models\Truck;
use App\Services\FuelingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class FuelingController extends Controller
{
    public function __construct(private FuelingService $fuelings)
    {
    }

    public function index(Truck $truck): JsonResponse
    {
        Gate::authorize('view', $truck);

        $items = $truck->fuelings()
            ->with('user')
            ->orderByDesc('created_at')
            ->limit(20)
            ->get()
            ->map(fn ($fueling) => [
                'id' => $fueling->id,
                'quantity' => (float) $fueling->quantity_liters,
                'level_before' => (float) $fueling->truck_before,
                'level_after' => (float) $fueling->truck_after,
                'km' => $fueling->km_at_fueling,
                'responsible' => $fueling->user?->name,
                'created_at' => $fueling->created_at->timezone(config('app.timezone'))->format('d/m/Y - H:i'),
            ]);

        return response()->json(['data' => $items]);
    }

    public function limits(Request $request): JsonResponse
    {
        $request->validate(['truck_id' => ['required', 'exists:trucks,id']]);

        $truck = Truck::query()->findOrFail($request->integer('truck_id'));
        Gate::authorize('view', $truck);
        $tank = FuelTank::query()->firstOrFail();
        $remaining = $truck->remainingCapacity();
        $max = min((float) $tank->current_liters, $remaining);

        return response()->json([
            'tank_available' => (float) $tank->current_liters,
            'truck_remaining' => $remaining,
            'max' => $max,
            'truck' => [
                'id' => $truck->id,
                'plate' => $truck->plate,
                'model' => $truck->model,
                'current_liters' => (float) $truck->current_liters,
                'tank_capacity' => (float) $truck->tank_capacity,
                'current_km' => (int) $truck->current_km,
                'status' => $truck->status,
            ],
        ]);
    }

    public function store(StoreFuelingRequest $request): JsonResponse
    {
        $truck = Truck::query()->findOrFail($request->integer('truck_id'));
        Gate::authorize('view', $truck);

        $fueling = $this->fuelings->register(
            $truck,
            $request->user(),
            (float) $request->input('quantity'),
            $request->has('current_km') ? $request->integer('current_km') : null,
            (string) $request->ip(),
            $request->has('current_liters') ? (float) $request->input('current_liters') : null,
        );

        $percentBefore = $fueling->truck->tank_capacity > 0
            ? round(((float) $fueling->truck_before / (float) $fueling->truck->tank_capacity) * 100)
            : 0;
        $percentAfter = $fueling->truck->tank_capacity > 0
            ? round(((float) $fueling->truck_after / (float) $fueling->truck->tank_capacity) * 100)
            : 0;

        return response()->json([
            'message' => 'Abastecimento registrado com sucesso.',
            'data' => [
                'id' => $fueling->id,
                'truck' => $fueling->truck->plate.' | '.$fueling->truck->model,
                'plate' => $fueling->truck->plate,
                'model' => $fueling->truck->model,
                'quantity' => (float) $fueling->quantity_liters,
                'level_before' => (float) $fueling->truck_before,
                'level_after' => (float) $fueling->truck_after,
                'percent_before' => $percentBefore,
                'percent_after' => $percentAfter,
                'responsible' => $fueling->user->name,
                'created_at' => $fueling->created_at->timezone(config('app.timezone'))->format('d/m/Y - H:i'),
            ],
        ], 201);
    }
}
