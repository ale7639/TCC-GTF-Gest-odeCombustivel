<?php

namespace App\Services;

use App\Models\Maintenance;
use App\Models\Truck;
use App\Models\Wash;
use Carbon\Carbon;

class ChecklistService
{
    public function forTruck(Truck $truck): array
    {
        $items = [
            'combustivel' => $this->fuelStatus($truck),
            'manutencao' => $this->maintenanceStatus($truck),
            'lavagem' => $this->washStatus($truck),
            'documentacao' => $this->docsStatus($truck),
        ];

        $pending = collect($items)->filter(fn ($item) => $item['status'] !== 'ok')->values();
        $blocking = collect($items)->filter(fn ($item) => $item['blocks'] ?? false)->isNotEmpty();

        if ($pending->isEmpty()) {
            $result = 'apto';
            $label = 'Pronto para Escala';
        } elseif ($blocking) {
            $result = 'nao_apto';
            $label = 'Não Apto';
        } else {
            $result = 'pendente';
            $label = 'Pendente Atenção';
        }

        return [
            'items' => $items,
            'result' => $result,
            'label' => $label,
            'ready' => $result === 'apto',
        ];
    }

    private function fuelStatus(Truck $truck): array
    {
        $percent = $truck->tank_capacity > 0
            ? round(((float) $truck->current_liters / (float) $truck->tank_capacity) * 100, 1)
            : 0;

        $ok = $percent >= 20;

        return [
            'key' => 'combustivel',
            'label' => 'Combustível',
            'status' => $ok ? 'ok' : 'pendente',
            'detail' => $ok
                ? number_format((float) $truck->current_liters, 0, ',', '.').' L no tanque'
                : 'Nível abaixo de 20% ('.$percent.'%)',
            'blocks' => false,
        ];
    }

    private function maintenanceStatus(Truck $truck): array
    {
        $dateOk = $truck->next_maintenance_date === null || $truck->next_maintenance_date->isFuture();
        $kmOk = $truck->next_maintenance_km === null || $truck->current_km < $truck->next_maintenance_km;
        $ok = $dateOk && $kmOk && $truck->next_maintenance_date !== null;

        $detail = 'Sem revisão programada';
        if ($truck->next_maintenance_date) {
            $kmLeft = max(0, (int) $truck->next_maintenance_km - (int) $truck->current_km);
            $detail = $ok
                ? 'Próxima em '.$truck->next_maintenance_date->format('d/m/Y').' · Faltam '.$kmLeft.' km'
                : 'Revisão vencida';
        }

        return [
            'key' => 'manutencao',
            'label' => 'Manutenção',
            'status' => $ok ? 'ok' : 'pendente',
            'detail' => $detail,
            'blocks' => ! $ok,
        ];
    }

    private function washStatus(Truck $truck): array
    {
        $last = Wash::query()
            ->where('truck_id', $truck->id)
            ->orderByDesc('washed_at')
            ->first();

        $days = (int) $truck->wash_frequency_days;
        $ok = false;
        $detail = 'Nenhuma lavagem registrada';

        if ($last) {
            $elapsed = $last->washed_at->startOfDay()->diffInDays(Carbon::today());
            $ok = $elapsed <= $days;
            $detail = $ok
                ? 'Última há '.$elapsed.' dia(s) · frequência '.$days.' dias'
                : 'Atrasada — última há '.$elapsed.' dia(s)';
        }

        return [
            'key' => 'lavagem',
            'label' => 'Lavagem',
            'status' => $ok ? 'ok' : 'pendente',
            'detail' => $detail,
            'blocks' => false,
            'last_wash' => $last?->washed_at?->toIso8601String(),
            'days_since' => $last ? $last->washed_at->startOfDay()->diffInDays(Carbon::today()) : null,
            'frequency' => $days,
        ];
    }

    private function docsStatus(Truck $truck): array
    {
        $dates = collect([
            'CRLV' => $truck->crlv_expires_at,
            'Seguro' => $truck->insurance_expires_at,
            'Licenciamento' => $truck->license_expires_at,
        ]);

        $expired = $dates->filter(fn ($date) => $date === null || $date->lt(Carbon::today()));

        if ($expired->isEmpty()) {
            $next = $dates->sort()->first();

            return [
                'key' => 'documentacao',
                'label' => 'Documentação',
                'status' => 'ok',
                'detail' => 'Em dia · próximo vencimento '.$next->format('d/m/Y'),
                'blocks' => false,
            ];
        }

        return [
            'key' => 'documentacao',
            'label' => 'Documentação',
            'status' => 'pendente',
            'detail' => 'Pendente: '.$expired->keys()->implode(', '),
            'blocks' => true,
        ];
    }

    public function recordVerification(Truck $truck, $user): Truck
    {
        $truck->last_verified_at = now();
        $truck->last_verified_by = $user->id;
        $truck->save();

        return $truck->fresh(['verifier']);
    }
}
