<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\FuelTank;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class FuelTankController extends Controller
{
    public function refill(Request $request): JsonResponse
    {
        $data = $request->validate([
            'quantity' => ['required', 'numeric', 'min:1'],
        ], [
            'quantity.min' => 'Informe uma quantidade positiva em litros.',
        ]);

        $tank = FuelTank::query()->firstOrFail();
        $quantity = (float) $data['quantity'];
        $space = $tank->remainingCapacity();

        if ($quantity > $space) {
            throw ValidationException::withMessages([
                'quantity' => 'Máximo que cabe no tanque central: '.number_format($space, 0, ',', '.').' L.',
                'max' => $space,
            ]);
        }

        $tank->current_liters = (float) $tank->current_liters + $quantity;
        $tank->save();

        AuditLog::record($request->user(), 'tanque.reabastecer', FuelTank::class, $tank->id, [
            'litros' => $quantity,
        ], $request->ip());

        return response()->json([
            'message' => 'Tanque central atualizado.',
            'tank' => [
                'name' => $tank->name,
                'capacity' => (float) $tank->capacity_liters,
                'current' => (float) $tank->current_liters,
                'percent' => $tank->percent(),
                'critical' => $tank->isCritical(),
            ],
        ]);
    }
}
