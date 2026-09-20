<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;

class AuditLogController extends Controller
{
    public function index(): JsonResponse
    {
        $items = AuditLog::query()
            ->with('user:id,name')
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(fn (AuditLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'user' => $log->user?->name,
                'created_at' => $log->created_at->timezone(config('app.timezone'))->format('d/m/Y - H:i'),
            ]);

        return response()->json(['data' => $items]);
    }
}
