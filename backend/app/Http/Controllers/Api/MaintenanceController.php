<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMaintenanceRequest;
use App\Models\AuditLog;
use App\Models\Maintenance;
use App\Models\Truck;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class MaintenanceController extends Controller
{
    public function index(Truck $truck): JsonResponse
    {
        Gate::authorize('view', $truck);
        $items = $truck->maintenances()->with('user')->orderByDesc('service_date')->get();
        $kmLeft = $truck->next_maintenance_km
            ? max(0, $truck->next_maintenance_km - $truck->current_km)
            : null;

        return response()->json([
            'truck' => [
                'id' => $truck->id,
                'plate' => $truck->plate,
                'model' => $truck->model,
                'current_km' => $truck->current_km,
                'next_maintenance_date' => $truck->next_maintenance_date?->toDateString(),
                'next_maintenance_km' => $truck->next_maintenance_km,
                'km_left' => $kmLeft,
            ],
            'data' => $items,
        ]);
    }

    public function store(StoreMaintenanceRequest $request, Truck $truck): JsonResponse
    {
        Gate::authorize('view', $truck);
        $maintenance = Maintenance::query()->create([
            'truck_id' => $truck->id,
            'user_id' => $request->user()->id,
            'service_date' => $request->date('service_date'),
            'km' => $request->integer('km'),
            'description' => $request->string('description'),
            'next_date' => $request->date('next_date'),
            'next_km' => $request->input('next_km'),
        ]);

        $truck->update([
            'current_km' => max($truck->current_km, $request->integer('km')),
            'next_maintenance_date' => $request->date('next_date'),
            'next_maintenance_km' => $request->input('next_km'),
        ]);

        AuditLog::record($request->user(), 'manutencao.criar', Maintenance::class, $maintenance->id, [
            'placa' => $truck->plate,
        ], $request->ip());

        return response()->json([
            'message' => 'Manutenção registrada. Checklist atualizado para Em Dia.',
            'data' => $maintenance->load('user'),
            'checklist' => $truck->fresh()->checklist(),
        ], 201);
    }
}
