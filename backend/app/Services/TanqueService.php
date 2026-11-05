<?php

namespace App\Services;

use App\Models\EntradaCombustivel;
use App\Models\NotaFiscal;
use App\Models\Tanque;
use App\Support\Auditoria;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TanqueService
{
    public function registrarEntrada(Tanque $tanque, array $dados, ?UploadedFile $foto = null): EntradaCombustivel
    {
        return DB::transaction(function () use ($tanque, $dados, $foto) {
            $tanque = Tanque::whereKey($tanque->id)->lockForUpdate()->firstOrFail();
            $litros = (float) $dados['litros'];
            $novoNivel = (float) $tanque->nivel_atual + $litros;

            if ($novoNivel - (float) $tanque->capacidade > 0.01) {
                throw ValidationException::withMessages([
                    'litros' => 'Essa entrada estoura a capacidade do tanque ('.$tanque->capacidade.' L).',
                ]);
            }

            $comprovante = $foto?->store('comprovantes/notas', 'public');

            $nota = NotaFiscal::create([
                'numero' => $dados['numero'],
                'fornecedor' => $dados['fornecedor'],
                'data_emissao' => $dados['data'] ?? now()->toDateString(),
                'valor_total' => $dados['valor_total'],
                'chave_acesso' => $dados['chave_acesso'] ?? null,
                'comprovante_path' => $comprovante,
            ]);

            $entrada = EntradaCombustivel::create([
                'tanque_id' => $tanque->id,
                'nota_fiscal_id' => $nota->id,
                'data' => $dados['data'] ?? now()->toDateString(),
                'litros' => $litros,
                'valor_total' => $dados['valor_total'],
            ]);

            $tanque->nivel_atual = $novoNivel;
            $tanque->save();

            Auditoria::registrar('tanque.entrada', $entrada, [
                'tanque' => $tanque->nome,
                'litros' => $litros,
                'nf' => $nota->numero,
            ]);

            return $entrada->load(['tanque', 'notaFiscal']);
        });
    }
}
