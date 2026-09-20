<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTruckRequest;
use App\Http\Requests\UpdateTruckRequest;
use App\Models\AuditLog;
use App\Models\Truck;
use App\Services\ChecklistService;
use App\Support\Plate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TruckController extends Controller
{
    public function __construct(private ChecklistService $checklist)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = Truck::query()
            ->where('status', 'ativo')
            ->with(['driver', 'verifier'])
            ->orderBy('plate');

        if ($request->user()?->isMotorista()) {
            $query->where('driver_id', $request->user()->id);
        }

        if ($search = trim((string) $request->query('q', ''))) {
            $normalized = Plate::normalize($search);
            $query->where(function ($builder) use ($search, $normalized) {
                $builder->where('plate', 'like', '%'.$normalized.'%')
                    ->orWhere('plate', 'like', '%'.$search.'%')
                    ->orWhere('model', 'like', '%'.$search.'%')
                    ->orWhere('name', 'like', '%'.$search.'%');
            });
        }

        $trucks = $query->get()->map(fn (Truck $truck) => $this->payload($truck, $request->boolean('with_checklist')));

        if ($request->filled('status')) {
            $status = $request->string('status')->toString();
            $trucks = $trucks->filter(fn ($item) => ($item['checklist']['result'] ?? null) === $status)->values();
        }

        return response()->json(['data' => $trucks]);
    }

    public function store(StoreTruckRequest $request): JsonResponse
    {
        $truck = Truck::query()->create([
            ...$request->validated(),
            'current_liters' => 0,
            'status' => 'ativo',
            'wash_frequency_days' => $request->integer('wash_frequency_days') ?: 7,
        ]);

        AuditLog::record($request->user(), 'caminhao.criar', Truck::class, $truck->id, [
            'placa' => $truck->plate,
        ], $request->ip());

        return response()->json(['data' => $this->payload($truck->fresh(['driver']), true)], 201);
    }

    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'max:1024'],
        ]);

        $handle = fopen($request->file('file')->getRealPath(), 'r');
        $imported = 0;
        $errors = [];
        $rowNumber = 0;

        while (($row = fgetcsv($handle, 0, ';')) !== false) {
            $rowNumber++;
            if ($rowNumber === 1 && isset($row[0]) && str_contains(mb_strtolower($row[0]), 'placa')) {
                continue;
            }
            if (count($row) < 7 || blank($row[0])) {
                continue;
            }

            $plate = Plate::normalize($row[0]);
            if (! Plate::isValid($plate) || Truck::withTrashed()->where('plate', $plate)->exists()) {
                $errors[] = 'Linha '.$rowNumber.': placa inválida ou já cadastrada.';
                continue;
            }

            Truck::query()->create([
                'plate' => $plate,
                'name' => $row[1],
                'model' => $row[2],
                'fuel_type' => $row[3] ?: 'Diesel S10',
                'tank_capacity' => (float) str_replace(',', '.', $row[4]),
                'current_km' => (int) $row[5],
                'sector' => $row[6],
                'current_liters' => 0,
                'status' => 'ativo',
                'wash_frequency_days' => 7,
            ]);
            $imported++;
        }
        fclose($handle);

        AuditLog::record($request->user(), 'caminhao.importar', Truck::class, null, [
            'importados' => $imported,
        ], $request->ip());

        return response()->json([
            'message' => $imported.' caminhão(ões) importado(s).',
            'imported' => $imported,
            'errors' => $errors,
        ]);
    }

    public function show(Truck $truck): JsonResponse
    {
        Gate::authorize('view', $truck);
        $truck->load(['driver', 'verifier']);

        return response()->json(['data' => $this->payload($truck, true, true)]);
    }

    public function update(UpdateTruckRequest $request, Truck $truck): JsonResponse
    {
        $truck->update($request->validated());

        AuditLog::record($request->user(), 'caminhao.editar', Truck::class, $truck->id, $request->validated(), $request->ip());

        return response()->json(['data' => $this->payload($truck->fresh(['driver', 'verifier']), true)]);
    }

    public function destroy(Request $request, Truck $truck): JsonResponse
    {
        Gate::authorize('delete', $truck);

        if ($truck->fuelings()->exists()) {
            $truck->update(['status' => 'inativo']);
            $truck->delete();

            AuditLog::record($request->user(), 'caminhao.desativar', Truck::class, $truck->id, [
                'motivo' => 'possui abastecimentos',
            ], $request->ip());

            return response()->json([
                'message' => 'Caminhão com abastecimentos registrados foi desativado e removido da listagem.',
            ]);
        }

        $truck->update(['status' => 'inativo']);
        $truck->delete();

        AuditLog::record($request->user(), 'caminhao.excluir', Truck::class, $truck->id, [
            'placa' => $truck->plate,
        ], $request->ip());

        return response()->json(['message' => 'Caminhão desativado com sucesso.']);
    }

    public function checkPlate(Request $request): JsonResponse
    {
        $plate = Plate::normalize((string) $request->query('plate', ''));

        if (! Plate::isValid($plate)) {
            return response()->json([
                'valid' => false,
                'available' => false,
                'message' => 'Placa deve seguir o formato AAA-9999 ou AAA9A99.',
            ], 422);
        }

        $exists = Truck::withTrashed()
            ->where('plate', $plate)
            ->when($request->integer('ignore_id'), fn ($query, $id) => $query->where('id', '!=', $id))
            ->exists();

        return response()->json([
            'valid' => true,
            'available' => ! $exists,
            'plate' => $plate,
            'message' => $exists
                ? 'Placa já cadastrada — Este caminhão já está registrado no sistema.'
                : 'Placa disponível.',
        ]);
    }

    public function checklist(Request $request, Truck $truck): JsonResponse
    {
        Gate::authorize('view', $truck);
        $truck->load('verifier');
        $check = $this->checklist->forTruck($truck);

        if ($request->user()->canManageFleet()) {
            $this->checklist->recordVerification($truck, $request->user());
            $truck->refresh()->load('verifier');
        }

        return response()->json([
            'data' => [
                'truck' => $this->payload($truck, false),
                'checklist' => $check,
                'verified_at' => $truck->last_verified_at?->toIso8601String(),
                'verified_by' => $truck->verifier?->name,
            ],
        ]);
    }

    public function status(Truck $truck): JsonResponse
    {
        Gate::authorize('view', $truck);
        $truck->load('verifier');
        $check = $this->checklist->forTruck($truck);
        $pending = collect($check['items'])->filter(fn ($item) => $item['status'] !== 'ok')->values();

        return response()->json([
            'data' => [
                'plate' => $truck->plate,
                'model' => $truck->model,
                'result' => $check['result'],
                'label' => $check['ready'] ? 'APTO — Pronto para Escala' : 'NÃO APTO',
                'pending_items' => $pending,
                'verified_at' => $truck->last_verified_at?->toIso8601String(),
                'verified_by' => $truck->verifier?->name,
            ],
        ]);
    }

    private function payload(Truck $truck, bool $withChecklist = false, bool $full = false): array
    {
        $data = [
            'id' => $truck->id,
            'plate' => $truck->plate,
            'name' => $truck->name,
            'model' => $truck->model,
            'fuel_type' => $truck->fuel_type,
            'tank_capacity' => (float) $truck->tank_capacity,
            'current_liters' => (float) $truck->current_liters,
            'remaining_capacity' => $truck->remainingCapacity(),
            'current_km' => (int) $truck->current_km,
            'sector' => $truck->sector,
            'driver' => $truck->driver ? [
                'id' => $truck->driver->id,
                'name' => $truck->driver->name,
            ] : null,
            'wash_frequency_days' => (int) $truck->wash_frequency_days,
            'photo_url' => $truck->photo_url,
            'status' => $truck->status,
        ];

        if ($full) {
            $data['next_maintenance_date'] = $truck->next_maintenance_date?->toDateString();
            $data['next_maintenance_km'] = $truck->next_maintenance_km;
            $data['crlv_expires_at'] = $truck->crlv_expires_at?->toDateString();
            $data['insurance_expires_at'] = $truck->insurance_expires_at?->toDateString();
            $data['license_expires_at'] = $truck->license_expires_at?->toDateString();
            $data['last_verified_at'] = $truck->last_verified_at?->toIso8601String();
            $data['last_verified_by'] = $truck->verifier?->name;
        }

        if ($withChecklist) {
            $data['checklist'] = $this->checklist->forTruck($truck);
        }

        return $data;
    }
}
