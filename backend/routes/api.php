<?php

use App\Http\Controllers\AbastecimentoController;
use App\Http\Controllers\AprovacaoController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CaminhaoController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\EntradaCombustivelController;
use App\Http\Controllers\LavagemController;
use App\Http\Controllers\LogAcessoController;
use App\Http\Controllers\ManutencaoController;
use App\Http\Controllers\MeuController;
use App\Http\Controllers\MotoristaController;
use App\Http\Controllers\NotaFiscalController;
use App\Http\Controllers\RelatorioController;
use App\Http\Controllers\TanqueController;
use App\Http\Middleware\ApenasAdmin;
use App\Http\Middleware\ApenasMotorista;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

// AUTH — rotas públicas (login / esqueci senha). throttle:5,1 por IP.
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
Route::post('/senha/esqueci', [AuthController::class, 'esqueciSenha'])->middleware('throttle:5,1');

// Foto de um abastecimento fora da base. Pública, mas só abre com o endereço assinado
// (que a API entrega, por 2 horas, a quem tem permissão de ver o lançamento).
Route::get('/fotos/abastecimentos/{abastecimento}', [AprovacaoController::class, 'foto'])
    ->name('abastecimentos.foto')
    ->middleware('signed');

// Foto da nota fiscal (entrada de combustível / NF da empresa). Mesma ideia: só com URL assinada.
Route::get('/fotos/notas-fiscais/{nota}', [EntradaCombustivelController::class, 'foto'])
    ->name('notas-fiscais.foto')
    ->middleware('signed');

// Tudo aqui dentro só funciona com um token válido.
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);

    // ADMIN — motorista recebe 403 em tudo isto
    Route::middleware(ApenasAdmin::class)->group(function () {
        // PAINEL
        Route::get('/dashboard', [DashboardController::class, 'index']);

        // Cada apiResource cria as rotas de listar, ver, cadastrar, alterar e excluir.
        // O parameters() diz que o {id} da URL vira a variável $caminhao no controller.
        Route::apiResource('caminhoes', CaminhaoController::class)
            ->parameters(['caminhoes' => 'caminhao']);
        Route::apiResource('motoristas', MotoristaController::class);
        Route::apiResource('tanques', TanqueController::class);

        // Login do motorista: criado junto com o cadastro (CPF); ADM redefine senha ou remove acesso.
        Route::put('/motoristas/{motorista}/senha', [MotoristaController::class, 'alterarSenha']);
        Route::delete('/motoristas/{motorista}/acesso', [MotoristaController::class, 'removerAcesso']);
        Route::get('/solicitacoes-senha', [MotoristaController::class, 'solicitacoesSenha']);

        // ABASTECIMENTO — listar, registrar e excluir (corrigir erros).
        Route::apiResource('abastecimentos', AbastecimentoController::class)
            ->only(['index', 'store', 'destroy']);

        // Entradas de combustível (compras com nota fiscal): só listar, registrar e excluir.
        Route::apiResource('entradas', EntradaCombustivelController::class)
            ->only(['index', 'store', 'destroy']);

        // Lavagens e manutenções: listar, registrar e excluir.
        Route::get('/lavagens', [LavagemController::class, 'index']);
        Route::post('/lavagens', [LavagemController::class, 'store']);
        Route::delete('/lavagens/{id}', [LavagemController::class, 'destroy'])->whereNumber('id');
        Route::get('/manutencoes', [ManutencaoController::class, 'index']);
        Route::post('/manutencoes', [ManutencaoController::class, 'store']);
        Route::delete('/manutencoes/{id}', [ManutencaoController::class, 'destroy'])->whereNumber('id');

        // Aprovação dos lançamentos feitos pelos motoristas.
        Route::get('/aprovacoes', [AprovacaoController::class, 'index']);
        Route::post('/aprovacoes/{tipo}/{id}/aprovar', [AprovacaoController::class, 'aprovar'])
            ->whereIn('tipo', ['abastecimento', 'lavagem', 'manutencao'])->whereNumber('id');
        Route::post('/aprovacoes/{tipo}/{id}/recusar', [AprovacaoController::class, 'recusar'])
            ->whereIn('tipo', ['abastecimento', 'lavagem', 'manutencao'])->whereNumber('id');

        // RELATORIO
        Route::get('/relatorios/abastecimentos', [RelatorioController::class, 'abastecimentos']);
        Route::get('/relatorios/abastecimentos/exportar', [RelatorioController::class, 'exportarAbastecimentos']);
        Route::get('/relatorios/notas-fiscais/exportar', [RelatorioController::class, 'exportarNotasFiscais']);
        Route::get('/relatorios/motoristas', [RelatorioController::class, 'motoristas']);
        Route::get('/relatorios/motoristas/{motorista}', [RelatorioController::class, 'motoristaHistorico']);
        Route::get('/relatorios/motoristas/{motorista}/exportar', [RelatorioController::class, 'exportarMotorista']);
        Route::get('/relatorios/caminhoes/{caminhao}', [RelatorioController::class, 'caminhaoHistorico']);
        Route::get('/relatorios/caminhoes/{caminhao}/exportar', [RelatorioController::class, 'exportarCaminhao']);
        Route::get('/notas-fiscais', [NotaFiscalController::class, 'index']);
        Route::post('/notas-fiscais', [NotaFiscalController::class, 'store']);
        Route::delete('/notas-fiscais/{id}', [NotaFiscalController::class, 'destroy'])->whereNumber('id');

        // Log de acesso (quem entrou, quando e de onde).
        Route::get('/logs-acesso', [LogAcessoController::class, 'index']);
    });

    // MEU / MOTORISTA — só ele, e só o caminhão dele
    Route::middleware(ApenasMotorista::class)->prefix('meu')->group(function () {
        Route::get('/painel', [MeuController::class, 'painel']);
        Route::get('/perfil', [MeuController::class, 'perfil']);
        Route::put('/perfil', [MeuController::class, 'atualizarPerfil']);
        Route::put('/senha', [MeuController::class, 'alterarSenha']);
        Route::get('/tanques', [MeuController::class, 'tanques']);
        Route::post('/abastecimentos', [MeuController::class, 'abastecer']);
        Route::post('/lavagens', [MeuController::class, 'lavar']);
        Route::post('/manutencoes', [MeuController::class, 'manter']);
    });
});