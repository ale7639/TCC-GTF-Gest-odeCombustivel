<?php

namespace App\Console\Commands;

use App\Services\AlertService;
use Illuminate\Console\Command;

class GenerateDailyAlerts extends Command
{
    protected $signature = 'gfc:gerar-alertas';

    protected $description = 'Gera alertas diários de manutenção, lavagem, combustível e documentação';

    public function handle(AlertService $alerts): int
    {
        $created = $alerts->generateDaily();
        $this->info("Alertas processados. Novos registros: {$created}");

        return self::SUCCESS;
    }
}
