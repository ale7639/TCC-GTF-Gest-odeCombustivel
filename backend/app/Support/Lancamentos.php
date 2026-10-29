<?php

namespace App\Support;

use App\Models\Abastecimento;
use App\Models\Caminhao;
use App\Models\Lavagem;
use App\Models\Manutencao;
use App\Models\Motorista;
use App\Models\Tanque;
use Illuminate\Support\Carbon;

// Junta abastecimentos, lavagens e manutenções num formato único, usado na tela de aprovações
// (admin) e no histórico do motorista.
class Lancamentos
{
    public const TIPOS = ['abastecimento', 'lavagem', 'manutencao'];

    public static function modelo(string $tipo): string
    {
        return match ($tipo) {
            'abastecimento' => Abastecimento::class,
            'lavagem'       => Lavagem::class,
            'manutencao'    => Manutencao::class,
        };
    }

    // Nomes de placas, motoristas e tanques, buscados uma vez só.
    public static function mapas(): array
    {
        return [
            'placas'  => Caminhao::pluck('placa', 'id')->all(),
            'nomes'   => Motorista::pluck('nome', 'id')->all(),
            'tanques' => Tanque::pluck('nome', 'id')->all(),
        ];
    }

    public static function contarPendentes(): int
    {
        $total = 0;
        foreach (self::TIPOS as $tipo) {
            $total += self::modelo($tipo)::where('status', 'pendente')->count();
        }

        return $total;
    }

    private static function moeda($v): string
    {
        return 'R$ ' . number_format((float) $v, 2, ',', '.');
    }

    private static function litros($v): string
    {
        return rtrim(rtrim(number_format((float) $v, 2, ',', '.'), '0'), ',');
    }

    public static function apresentar(string $tipo, $m, array $mapas): array
    {
        $data = Carbon::parse($m->data);
        $km   = $m->km !== null ? number_format((int) $m->km, 0, ',', '.') . ' km' : null;

        if ($tipo === 'abastecimento') {
            $externo = $m->origem === 'externo';
            $titulo  = 'Abastecimento · ' . self::litros($m->litros) . ' L';
            $linhas  = array_values(array_filter([
                $externo
                    ? 'Fora da base · ' . ($m->posto ?: 'posto não informado')
                    : 'Na base · ' . ($mapas['tanques'][$m->tanque_id] ?? 'tanque'),
                $km,
                $externo ? 'Valor pago: ' . self::moeda($m->valor_total) : null,
                ($externo && $m->nota_numero) ? 'NF ' . $m->nota_numero : null,
            ]));
        } elseif ($tipo === 'lavagem') {
            $titulo = 'Lavagem · ' . self::moeda($m->valor);
            $linhas = array_values(array_filter([$m->observacao]));
        } else {
            $titulo = 'Manutenção · ' . $m->tipo . ' · ' . self::moeda($m->valor);
            $linhas = array_values(array_filter([$m->descricao, $km]));
        }

        return [
            'tipo'          => $tipo,
            'id'            => $m->id,
            'status'        => $m->status,
            'motivo_recusa' => $m->motivo_recusa,
            'data'          => $data->toDateString(),
            'data_br'       => $data->format('d/m/Y'),
            'placa'         => $mapas['placas'][$m->caminhao_id] ?? '—',
            'motorista'     => $mapas['nomes'][$m->motorista_id] ?? '—',
            'titulo'        => $titulo,
            'linhas'        => $linhas,
            'foto_url'      => $tipo === 'abastecimento' ? $m->fotoUrl() : null,
            'ordem'         => $m->created_at?->timestamp ?? 0,
        ];
    }
}