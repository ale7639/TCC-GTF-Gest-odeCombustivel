<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Fueling;
use App\Models\Truck;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function consumption(Request $request): JsonResponse
    {
        [$start, $end] = $this->period($request);
        $fuelings = $this->fuelings($request, $start, $end);
        $total = (float) $fuelings->sum('quantity_liters');
        $days = max(1, $start->diffInDays($end) + 1);
        $economy = $this->economy($fuelings);

        $byDay = $fuelings
            ->groupBy(fn (Fueling $item) => $item->created_at->timezone(config('app.timezone'))->toDateString())
            ->map(fn ($group, $day) => [
                'date' => $day,
                'liters' => (float) $group->sum('quantity_liters'),
                'count' => $group->count(),
            ])
            ->values();

        $ranking = $fuelings
            ->groupBy('truck_id')
            ->map(function ($group) use ($economy) {
                /** @var Fueling $first */
                $first = $group->first();
                $truckId = $first->truck_id;

                return [
                    'truck_id' => $truckId,
                    'plate' => $first->truck?->plate,
                    'model' => $first->truck?->model,
                    'liters' => (float) $group->sum('quantity_liters'),
                    'km_per_liter' => $economy['by_truck'][$truckId] ?? null,
                ];
            })
            ->sortByDesc('liters')
            ->values();

        return response()->json([
            'period' => [
                'start' => $start->toDateString(),
                'end' => $end->toDateString(),
                'label' => $start->translatedFormat('F/Y'),
            ],
            'total_liters' => $total,
            'daily_average' => round($total / $days, 1),
            'km_per_liter' => $economy['average'],
            'count' => $fuelings->count(),
            'by_day' => $byDay,
            'ranking' => $ranking,
            'empty' => $fuelings->isEmpty(),
        ]);
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        [$start, $end] = $this->period($request);
        $query = Fueling::query()
            ->with(['truck', 'user'])
            ->whereBetween('created_at', [$start, $end])
            ->orderBy('created_at');

        if ($request->filled('truck_id')) {
            $query->where('truck_id', $request->integer('truck_id'));
        }

        $filename = 'gfc-consumo-'.$start->format('Y-m').'.csv';

        return response()->streamDownload(function () use ($query) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['Data', 'Placa', 'Modelo', 'Litros', 'Nível antes', 'Nível depois', 'Responsável', 'KM'], ';');

            $query->chunk(200, function ($rows) use ($handle) {
                foreach ($rows as $row) {
                    fputcsv($handle, [
                        $row->created_at->timezone(config('app.timezone'))->format('d/m/Y H:i'),
                        $row->truck?->plate,
                        $row->truck?->model,
                        number_format((float) $row->quantity_liters, 2, ',', '.'),
                        number_format((float) $row->truck_before, 1, ',', '.'),
                        number_format((float) $row->truck_after, 1, ',', '.'),
                        $row->user?->name,
                        $row->km_at_fueling,
                    ], ';');
                }
            });

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function fuelings(Request $request, Carbon $start, Carbon $end): Collection
    {
        $query = Fueling::query()
            ->with(['truck', 'user'])
            ->whereBetween('created_at', [$start, $end]);

        if ($request->filled('truck_id')) {
            $query->where('truck_id', $request->integer('truck_id'));
        }

        return $query->orderBy('created_at')->get();
    }

    private function economy(Collection $fuelings): array
    {
        $byTruck = [];

        foreach ($fuelings->groupBy('truck_id') as $truckId => $group) {
            $ordered = $group->sortBy(fn (Fueling $item) => $item->km_at_fueling ?: $item->created_at->timestamp)->values();
            $samples = [];

            for ($i = 1; $i < $ordered->count(); $i++) {
                $previous = $ordered[$i - 1];
                $current = $ordered[$i];
                $kmDiff = (int) $current->km_at_fueling - (int) $previous->km_at_fueling;
                $consumed = (float) $previous->truck_after - (float) $current->truck_before;

                if ($kmDiff > 0 && $consumed > 0.5) {
                    $samples[] = $kmDiff / $consumed;
                }
            }

            if ($samples) {
                $byTruck[$truckId] = round(array_sum($samples) / count($samples), 2);
            }
        }

        $all = array_values($byTruck);

        return [
            'average' => $all ? round(array_sum($all) / count($all), 2) : null,
            'by_truck' => $byTruck,
        ];
    }

    private function period(Request $request): array
    {
        $month = (int) $request->query('month', now()->month);
        $year = (int) $request->query('year', now()->year);
        $start = Carbon::create($year, $month, 1)->startOfDay();
        $end = $start->copy()->endOfMonth();

        return [$start, $end];
    }
}
