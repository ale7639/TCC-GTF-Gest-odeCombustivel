<?php

namespace App\Services;

use App\Models\Abastecimento;
use App\Models\Caminhao;
use App\Models\Tanque;
use App\Models\User;
use App\Support\Auditoria;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AbastecimentoService
{
    public function registrar(User $usuario, array $dados, ?UploadedFile $foto = null): Abastecimento
    {
        return DB::transaction(function () use ($usuario, $dados, $foto) {
            $caminhao = Caminhao::whereKey($dados['caminhao_id'])->lockForUpdate()->firstOrFail();

            if ($caminhao->status === 'inativo') {
                throw ValidationException::withMessages([
                    'caminhao_id' => 'Este caminhão está inativo.',
                ]);
            }

            $origem = $dados['origem'];
            $litros = (float) $dados['litros'];
            $km = (int) $dados['km'];

            if ($km < (int) $caminhao->km_atual) {
                throw ValidationException::withMessages([
                    'km' => 'O KM não pode ser menor que o KM atual do caminhão ('.$caminhao->km_atual.').',
                ]);
            }

            $motoristaId = $caminhao->motorista_id;
            if ($usuario->isMotorista()) {
                $motoristaId = $usuario->motorista_id ?: $caminhao->motorista_id;
            }
            if (! $motoristaId) {
                throw ValidationException::withMessages([
                    'motorista_id' => 'Este caminhão não tem motorista vinculado.',
                ]);
            }

            $tanqueId = null;
            $posto = $dados['posto'] ?? null;
            $comprovante = null;

            if ($origem === 'base') {
                if (empty($dados['tanque_id'])) {
                    throw ValidationException::withMessages([
                        'tanque_id' => 'Escolha o tanque da base.',
                    ]);
                }
                $tanque = Tanque::whereKey($dados['tanque_id'])->lockForUpdate()->firstOrFail();
                if ((float) $tanque->nivel_atual < $litros) {
                    throw ValidationException::withMessages([
                        'litros' => 'O tanque '.$tanque->nome.' tem só '.$tanque->nivel_atual.' L.',
                    ]);
                }
                $tanque->nivel_atual = (float) $tanque->nivel_atual - $litros;
                $tanque->save();
                $tanqueId = $tanque->id;
            } else {
                if (! $foto) {
                    throw ValidationException::withMessages([
                        'comprovante' => 'Envie a foto do cupom do posto.',
                    ]);
                }
                $comprovante = $foto->store('comprovantes/abastecimentos', 'public');
                $posto = $dados['posto'] ?? 'Posto externo';
            }

            $abastecimento = Abastecimento::create([
                'caminhao_id' => $caminhao->id,
                'motorista_id' => $motoristaId,
                'user_id' => $usuario->id,
                'tanque_id' => $tanqueId,
                'origem' => $origem,
                'posto' => $posto,
                'comprovante_path' => $comprovante,
                'data' => $dados['data'] ?? now()->toDateString(),
                'litros' => $litros,
                'km' => $km,
            ]);

            if ($km > (int) $caminhao->km_atual) {
                $caminhao->km_atual = $km;
                $caminhao->save();
            }

            Auditoria::registrar('abastecimento.criar', $abastecimento, [
                'origem' => $origem,
                'litros' => $litros,
                'placa' => $caminhao->placa,
            ]);

            return $abastecimento->load(['caminhao:id,placa,km_atual', 'motorista:id,nome,telefone', 'tanque:id,nome,tipo_combustivel']);
        });
    }
}
