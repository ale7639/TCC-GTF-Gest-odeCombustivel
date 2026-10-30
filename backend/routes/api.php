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
use App\Http\Controllers\RelatorioController;
use App\Http\Controllers\TanqueController;
use App\Http\Middleware\ApenasAdmin;
use App\Http\Middleware\ApenasMotorista;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

// Rota pública: confere e-mail e senha e devolve o token.
Route::post('/login', [AuthController::class, 'login']);

// Foto de um abastecimento fora da base. Pública, mas só abre com o endereço assinado
// (que a API entrega, por 2 horas, a quem tem permissão de ver o lançamento).
Route::get('/fotos/abastecimentos/{abastecimento}', [AprovacaoController::class, 'foto'])
    ->name('abastecimentos.foto')
    ->middleware('signed');

// Tudo aqui dentro só funciona com um token válido.
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);

    // ---------------------------------------------------------------
    // ADMINISTRADOR (o motorista recebe 403 em tudo isto)
    // ---------------------------------------------------------------
    Route::middleware(ApenasAdmin::class)->group(function () {
        Route::get('/dashboard', [DashboardController::class, 'index']);

        // Cada apiResource cria as rotas de listar, ver, cadastrar, alterar e excluir.
        // O parameters() diz que o {id} da URL vira a variável $caminhao no controller.
        Route::apiResource('caminhoes', CaminhaoController::class)
            ->parameters(['caminhoes' => 'caminhao']);
        Route::apiResource('motoristas', MotoristaController::class);
        Route::apiResource('tanques', TanqueController::class);

        // Login do motorista: criado e alterado junto com o cadastro; aqui só a remoção.
        Route::delete('/motoristas/{motorista}/acesso', [MotoristaController::class, 'removerAcesso']);

        // Abastecimentos: só listar, registrar e excluir (para corrigir erros).
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

        // Relatórios.
        Route::get('/relatorios/abastecimentos', [RelatorioController::class, 'abastecimentos']);
        Route::get('/relatorios/motoristas', [RelatorioController::class, 'motoristas']);

        // Log de acesso (quem entrou, quando e de onde).
        Route::get('/logs-acesso', [LogAcessoController::class, 'index']);
    });

    // ---------------------------------------------------------------
    // MOTORISTA (só ele, e só o caminhão dele)
    // ---------------------------------------------------------------
    Route::middleware(ApenasMotorista::class)->prefix('meu')->group(function () {
        Route::get('/painel', [MeuController::class, 'painel']);
        Route::get('/tanques', [MeuController::class, 'tanques']);
        Route::post('/abastecimentos', [MeuController::class, 'abastecer']);
        Route::post('/lavagens', [MeuController::class, 'lavar']);
        Route::post('/manutencoes', [MeuController::class, 'manter']);
    });
});