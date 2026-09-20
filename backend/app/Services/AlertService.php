<?php

namespace App\Services;

use App\Models\Alert;
use App\Models\FuelTank;
use App\Models\Truck;
use Carbon\Carbon;

class AlertService
{
    public function generateDaily(): int
    {
        $created = 0;
        $created += $this->fuelAlert();

        Truck::query()->where('status', 'ativo')->get()->each(function (Truck $truck) use (&$created) {
            $created += $this->maintenanceAlert($truck);
            $created += $this->washAlert($truck);
            $created += $this->docsAlert($truck);
        });

        return $created;
    }

    private function fuelAlert(): int
    {
        $tank = FuelTank::query()->first();
        if (! $tank || ! $tank->isCritical()) {
            return 0;
        }

        $percent = $tank->percent();

        return $this->upsert(
            Alert::TYPE_FUEL,
            null,
            'Combustível Baixo',
            'Tanque Principal — Apenas '.$percent.'% disponível',
            ['percent' => $percent]
        );
    }

    private function maintenanceAlert(Truck $truck): int
    {
        $dateOverdue = $truck->next_maintenance_date && $truck->next_maintenance_date->isPast();
        $kmOverdue = $truck->next_maintenance_km && $truck->current_km >= $truck->next_maintenance_km;
        $kmSoon = $truck->next_maintenance_km && ($truck->next_maintenance_km - $truck->current_km) < 500;
        $dateSoon = $truck->next_maintenance_date && $truck->next_maintenance_date->lte(Carbon::today()->addDays(7));

        if (! $dateOverdue && ! $kmOverdue && ! $kmSoon && ! $dateSoon) {
            return 0;
        }

        $title = ($dateOverdue || $kmOverdue) ? 'Manutenção Vencida' : 'Manutenção Próxima';
        $detail = $dateOverdue
            ? 'Revisão atrasada'
            : 'Revisão se aproximando';

        return $this->upsert(
            Alert::TYPE_MAINTENANCE,
            $truck->id,
            $title,
            'Caminhão '.$truck->plate.' — '.$detail,
            ['plate' => $truck->plate]
        );
    }

    private function washAlert(Truck $truck): int
    {
        $checklist = $truck->checklist();
        $wash = $checklist['items']['lavagem'];

        if ($wash['status'] === 'ok') {
            return 0;
        }

        return $this->upsert(
            Alert::TYPE_WASH,
            $truck->id,
            'Lavagem Atrasada',
            'Caminhão '.$truck->plate.' — '.$wash['detail'],
            ['plate' => $truck->plate]
        );
    }

    private function docsAlert(Truck $truck): int
    {
        $limit = Carbon::today()->addDays(10);
        $docs = [
            'CRLV' => $truck->crlv_expires_at,
            'Seguro' => $truck->insurance_expires_at,
            'Licenciamento' => $truck->license_expires_at,
        ];

        $created = 0;

        foreach ($docs as $name => $date) {
            if (! $date) {
                $created += $this->upsert(
                    Alert::TYPE_DOCS,
                    $truck->id,
                    'Documentação pendente',
                    'Caminhão '.$truck->plate.' — '.$name.' sem data de vencimento',
                    ['plate' => $truck->plate, 'doc' => $name]
                );
                continue;
            }

            if ($date->gt($limit)) {
                continue;
            }

            $created += $this->upsert(
                Alert::TYPE_DOCS,
                $truck->id,
                'Documentação a Vencer',
                'Caminhão '.$truck->plate.' — '.$name.' vence em '.$date->format('d/m/Y'),
                ['plate' => $truck->plate, 'doc' => $name]
            );
        }

        return $created;
    }

    private function upsert(string $type, ?int $truckId, string $title, string $description, array $meta): int
    {
        $existing = Alert::query()
            ->where('type', $type)
            ->where('truck_id', $truckId)
            ->where('is_read', false)
            ->whereDate('created_at', Carbon::today())
            ->first();

        if ($existing) {
            $existing->update(compact('title', 'description', 'meta'));

            return 0;
        }

        Alert::query()->create([
            'type' => $type,
            'title' => $title,
            'description' => $description,
            'truck_id' => $truckId,
            'is_read' => false,
            'meta' => $meta,
        ]);

        return 1;
    }
}
