<?php

namespace App\Support;

use App\Models\Caminhao;
use App\Models\ChecklistPreViagem;
use App\Models\ConciliacaoTanque;
use App\Models\Motorista;
use App\Models\Multa;
use App\Models\Pneu;
use App\Models\Tanque;
use App\Models\User;

/**
 * Gera alertas operacionais derivados do estado do sistema.
 * A inbox do sino usa estas chaves estáveis + tabela de leituras.
 */
class Alertas
{
    public static function paraUsuario(User $usuario): array
    {
        $inicio = now()->subDays(30)->toDateString();

        if ($usuario->isMotorista()) {
            return self::motorista($usuario->motorista_id);
        }

        return self::gestao($inicio);
    }

    private static function gestao(string $inicio): array
    {
        $alertas = [];

        foreach (Motorista::where('ativo', true)->whereNotNull('cnh_validade')->get() as $m) {
            $a = Documentos::alerta($m->cnh_validade?->toDateString());
            if ($a && in_array($a['nivel'], ['vencido', 'proximo'], true)) {
                $alertas[] = self::item(
                    'documento:cnh:'.$m->id.':'.$a['nivel'],
                    'documento',
                    $a['nivel'],
                    $a['nivel'] === 'vencido' ? 'CNH vencida' : 'CNH perto do vencimento',
                    $m->nome.' · '.($a['nivel'] === 'vencido' ? 'vencida há '.$a['dias'].' dias' : 'vence em '.$a['dias'].' dias'),
                    '/app/motoristas'
                );
            }
        }

        foreach (Caminhao::where('status', '!=', 'inativo')->get() as $c) {
            foreach ([['crlv_validade', 'CRLV'], ['seguro_validade', 'Seguro']] as [$campo, $label]) {
                $a = Documentos::alerta($c->{$campo}?->toDateString());
                if ($a && in_array($a['nivel'], ['vencido', 'proximo'], true)) {
                    $alertas[] = self::item(
                        'documento:'.$campo.':'.$c->id.':'.$a['nivel'],
                        'documento',
                        $a['nivel'],
                        $a['nivel'] === 'vencido' ? "$label vencido" : "$label perto do vencimento",
                        $c->placa.' · '.($a['nivel'] === 'vencido' ? 'vencido há '.$a['dias'].' dias' : 'vence em '.$a['dias'].' dias'),
                        '/app/frota/'.$c->id
                    );
                }
            }

            $oleo = Oleo::resumo($c);
            if (in_array($oleo['alerta'], ['atrasado', 'proximo', 'sem_registro'], true)) {
                $alertas[] = self::item(
                    'oleo:'.$c->id.':'.$oleo['alerta'],
                    'oleo',
                    $oleo['alerta'] === 'atrasado' ? 'vencido' : 'proximo',
                    $oleo['rotulo'],
                    $c->placa.($oleo['restante_km'] !== null ? ' · '.$oleo['restante_km'].' km restantes' : ''),
                    '/app/frota/'.$c->id.'/manutencao'
                );
            }

            $media = Consumo::mediaCaminhao($c);
            if ($media && $c->meta_km_l && $media < ((float) $c->meta_km_l * 0.9)) {
                $alertas[] = self::item(
                    'meta_km_l:'.$c->id,
                    'meta_km_l',
                    'proximo',
                    'Abaixo da meta km/L',
                    $c->placa.' · média '.$media.' (meta '.$c->meta_km_l.')',
                    '/app/frota/'.$c->id
                );
            }

            $trechos = Consumo::trechos(
                $c->abastecimentos()->orderBy('km')->orderBy('data')->orderBy('id')->get()
            );
            $ultimo = $trechos->last();
            if ($media && $ultimo && $ultimo['km_l'] < ($media * 0.75)) {
                $alertas[] = self::item(
                    'consumo_anomalo:'.$c->id.':'.($ultimo['abastecimento_id'] ?? $ultimo['km'] ?? 'x'),
                    'consumo_anomalo',
                    'vencido',
                    'Consumo anômalo',
                    $c->placa.' · último trecho '.$ultimo['km_l'].' km/L (média '.$media.')',
                    '/app/frota/'.$c->id
                );
            }
        }

        foreach (Tanque::orderBy('nome')->get() as $t) {
            $pct = $t->capacidade > 0 ? ($t->nivel_atual / $t->capacidade) * 100 : 0;
            if ($pct < 20) {
                $alertas[] = self::item(
                    'tanque_critico:'.$t->id,
                    'tanque',
                    'vencido',
                    'Tanque em nível crítico',
                    $t->nome.' · '.round($pct, 1).'% da capacidade',
                    '/app/tanques/'.$t->id
                );
            }
        }

        $pneus = Pneu::with('caminhao:id,placa,km_atual')->get()
            ->filter(fn ($p) => in_array($p->alerta, ['atrasado', 'proximo'], true));
        foreach ($pneus->take(12) as $p) {
            $nivel = $p->alerta === 'atrasado' ? 'vencido' : 'proximo';
            $alertas[] = self::item(
                'pneu:'.$p->id.':'.$p->alerta,
                'pneu',
                $nivel,
                $p->alerta === 'atrasado' ? 'Pneu atrasado' : 'Pneu próximo da troca',
                ($p->caminhao?->placa).' · posição '.$p->posicao,
                '/app/frota/'.($p->caminhao_id).'/pneus'
            );
        }

        foreach (ConciliacaoTanque::with('tanque:id,nome')->where('alerta', true)->where('data', '>=', $inicio)->orderByDesc('data')->limit(8)->get() as $c) {
            $alertas[] = self::item(
                'conciliacao:'.$c->id,
                'conciliacao',
                'vencido',
                'Variação no tanque',
                ($c->tanque?->nome).' · '.number_format((float) $c->variacao, 1, ',', '.').' L em '.$c->data->format('d/m'),
                '/app/tanques/'.$c->tanque_id
            );
        }

        foreach (Multa::with('caminhao:id,placa')->where('status', '!=', 'pago')->whereNotNull('prazo')->whereDate('prazo', '<=', now()->addDays(7))->limit(8)->get() as $m) {
            $alertas[] = self::item(
                'multa:'.$m->id.':'.($m->atrasada ? 'atrasada' : 'prazo'),
                'multa',
                $m->atrasada ? 'vencido' : 'proximo',
                $m->atrasada ? 'Multa atrasada' : 'Multa com prazo perto',
                ($m->caminhao?->placa).' · '.$m->descricao,
                '/app/multas'
            );
        }

        $naoAptos = ChecklistPreViagem::with('caminhao:id,placa')
            ->where('status', 'nao_apto')
            ->where('data', '>=', $inicio)
            ->orderByDesc('id')
            ->limit(8)
            ->get();
        foreach ($naoAptos as $ch) {
            $alertas[] = self::item(
                'checklist:'.$ch->id,
                'checklist',
                'vencido',
                'Saída não apta',
                ($ch->caminhao?->placa).' · checklist pré-viagem',
                '/app/saida'
            );
        }

        return self::ordenar($alertas);
    }

    private static function motorista(?int $motoristaId): array
    {
        if (! $motoristaId) {
            return [];
        }

        $alertas = [];
        $m = Motorista::find($motoristaId);
        if ($m?->cnh_validade) {
            $a = Documentos::alerta($m->cnh_validade->toDateString());
            if ($a && in_array($a['nivel'], ['vencido', 'proximo'], true)) {
                $alertas[] = self::item(
                    'documento:cnh:'.$m->id.':'.$a['nivel'],
                    'documento',
                    $a['nivel'],
                    $a['nivel'] === 'vencido' ? 'Sua CNH está vencida' : 'CNH perto do vencimento',
                    $a['nivel'] === 'vencido' ? 'Vencida há '.$a['dias'].' dias' : 'Vence em '.$a['dias'].' dias',
                    '/app/perfil'
                );
            }
        }

        $caminhao = Caminhao::where('motorista_id', $motoristaId)->where('status', '!=', 'inativo')->first();
        if ($caminhao) {
            $oleo = Oleo::resumo($caminhao);
            if (in_array($oleo['alerta'], ['atrasado', 'proximo', 'sem_registro'], true)) {
                $alertas[] = self::item(
                    'oleo:'.$caminhao->id.':'.$oleo['alerta'],
                    'oleo',
                    $oleo['alerta'] === 'atrasado' ? 'vencido' : 'proximo',
                    $oleo['rotulo'],
                    $caminhao->placa,
                    '/app/frota/'.$caminhao->id.'/manutencao'
                );
            }

            foreach ([['crlv_validade', 'CRLV'], ['seguro_validade', 'Seguro']] as [$campo, $label]) {
                $a = Documentos::alerta($caminhao->{$campo}?->toDateString());
                if ($a && in_array($a['nivel'], ['vencido', 'proximo'], true)) {
                    $alertas[] = self::item(
                        'documento:'.$campo.':'.$caminhao->id.':'.$a['nivel'],
                        'documento',
                        $a['nivel'],
                        $a['nivel'] === 'vencido' ? "$label vencido" : "$label perto do vencimento",
                        $caminhao->placa.' · '.($a['nivel'] === 'vencido' ? 'vencido há '.$a['dias'].' dias' : 'vence em '.$a['dias'].' dias'),
                        '/app/frota/'.$caminhao->id
                    );
                }
            }
        }

        return self::ordenar($alertas);
    }

    private static function item(string $chave, string $tipo, string $nivel, string $titulo, string $texto, string $link): array
    {
        return [
            'chave' => $chave,
            'tipo' => $tipo,
            'nivel' => $nivel,
            'titulo' => $titulo,
            'texto' => $texto,
            'link' => $link,
        ];
    }

    private static function ordenar(array $alertas): array
    {
        usort($alertas, function ($a, $b) {
            $peso = ['vencido' => 0, 'proximo' => 1];
            $pa = $peso[$a['nivel']] ?? 2;
            $pb = $peso[$b['nivel']] ?? 2;
            if ($pa !== $pb) {
                return $pa <=> $pb;
            }

            return strcmp($a['titulo'], $b['titulo']);
        });

        return array_values($alertas);
    }
}
