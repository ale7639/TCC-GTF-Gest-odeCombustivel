<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Truck;
use App\Models\Wash;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class WashController extends Controller
{
    public function show(Truck $truck): JsonResponse
    {
        Gate::authorize('view', $truck);
        $last = $truck->washes()->with('user')->orderByDesc('washed_at')->first();
        $check = $truck->checklist()['items']['lavagem'];

        return response()->json([
            'truck' => [
                'id' => $truck->id,
                'plate' => $truck->plate,
                'model' => $truck->model,
                'wash_frequency_days' => $truck->wash_frequency_days,
            ],
            'last' => $last,
            'days_since' => $check['days_since'] ?? null,
            'status' => $check['status'],
            'next_due' => $last
                ? $last->washed_at->copy()->addDays($truck->wash_frequency_days)->toDateString()
                : null,
            'history' => $truck->washes()->with('user')->orderByDesc('washed_at')->limit(10)->get(),
        ]);
    }

    public function store(Request $request, Truck $truck): JsonResponse
    {
        Gate::authorize('view', $truck);
        $wash = Wash::query()->create([
            'truck_id' => $truck->id,
            'user_id' => $request->user()->id,
            'washed_at' => now(),
            'notes' => $request->input('notes'),
        ]);

        AuditLog::record($request->user(), 'lavagem.criar', Wash::class, $wash->id, [
            'placa' => $truck->plate,
        ], $request->ip());

        return response()->json([
            'message' => 'Lavagem registrada. Próxima em '.$truck->wash_frequency_days.' dias.',
            'data' => $wash->load('user'),
            'checklist' => $truck->fresh()->checklist(),
        ], 201);
    }

    public function updateFrequency(Request $request, Truck $truck): JsonResponse
    {
        if (! $request->user()->isAdmin()) {
            return response()->json(['message' => 'Acesso não autorizado para seu perfil.'], 403);
        }

        $request->validate([
            'wash_frequency_days' => ['required', 'integer', 'min:1', 'max:30'],
        ]);

        $truck->update(['wash_frequency_days' => $request->integer('wash_frequency_days')]);

        return response()->json(['data' => $truck->fresh()]);
    }
}
