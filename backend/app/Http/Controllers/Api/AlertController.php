<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Services\AlertService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AlertController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $alerts = Alert::query()
            ->with('truck')
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(fn (Alert $alert) => [
                'id' => $alert->id,
                'type' => $alert->type,
                'title' => $alert->title,
                'description' => $alert->description,
                'truck' => $alert->truck ? [
                    'id' => $alert->truck->id,
                    'plate' => $alert->truck->plate,
                ] : null,
                'is_read' => $alert->is_read,
                'relative' => $this->relative($alert->created_at),
                'created_at' => $alert->created_at->toIso8601String(),
            ]);

        return response()->json([
            'unread' => Alert::query()->where('is_read', false)->count(),
            'data' => $alerts,
        ]);
    }

    public function markRead(Alert $alert): JsonResponse
    {
        $alert->update(['is_read' => true]);

        return response()->json(['data' => $alert]);
    }

    public function markAllRead(): JsonResponse
    {
        Alert::query()->where('is_read', false)->update(['is_read' => true]);

        return response()->json(['message' => 'Alertas marcados como lidos.']);
    }

    public function generate(AlertService $service): JsonResponse
    {
        $created = $service->generateDaily();

        return response()->json(['created' => $created]);
    }

    private function relative(Carbon $date): string
    {
        $days = $date->startOfDay()->diffInDays(Carbon::today());

        if ($days === 0) {
            return 'Hoje';
        }

        if ($days === 1) {
            return 'Há 1 dia';
        }

        return 'Há '.$days.' dias';
    }
}
