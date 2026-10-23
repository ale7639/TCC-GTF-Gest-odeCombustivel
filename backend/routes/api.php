<?php

use App\Http\Controllers\AbastecimentoController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CaminhaoController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\LavagemController;
use App\Http\Controllers\ManutencaoController;
use App\Http\Controllers\MotoristaController;
use App\Http\Controllers\RelatorioController;
use App\Http\Controllers\TanqueController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/dashboard', [DashboardController::class, 'index']);

    Route::get('/caminhoes', [CaminhaoController::class, 'index']);
    Route::get('/caminhoes/{caminhao}', [CaminhaoController::class, 'show']);
    Route::get('/caminhoes/{caminhao}/abastecimentos', [AbastecimentoController::class, 'doCaminhao']);
    Route::get('/caminhoes/{caminhao}/lavagens', [LavagemController::class, 'index']);
    Route::post('/caminhoes/{caminhao}/lavagens', [LavagemController::class, 'store']);
    Route::get('/caminhoes/{caminhao}/manutencoes', [ManutencaoController::class, 'index']);

    Route::get('/abastecimentos', [AbastecimentoController::class, 'index']);
    Route::get('/abastecimentos/limites', [AbastecimentoController::class, 'limites']);
    Route::post('/abastecimentos', [AbastecimentoController::class, 'store']);

    Route::get('/tanques', [TanqueController::class, 'index']);
    Route::get('/tanques/{tanque}', [TanqueController::class, 'show']);

    Route::middleware('role:administrador')->group(function () {
        Route::post('/caminhoes', [CaminhaoController::class, 'store']);
        Route::put('/caminhoes/{caminhao}', [CaminhaoController::class, 'update']);
        Route::delete('/caminhoes/{caminhao}', [CaminhaoController::class, 'destroy']);

        Route::post('/motoristas', [MotoristaController::class, 'store']);
        Route::put('/motoristas/{motorista}', [MotoristaController::class, 'update']);
        Route::delete('/motoristas/{motorista}', [MotoristaController::class, 'destroy']);

        Route::delete('/tanques/{tanque}', [TanqueController::class, 'destroy']);

        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::put('/users/{user}', [UserController::class, 'update']);
    });

    Route::middleware('role:administrador,supervisor')->group(function () {
        Route::get('/motoristas', [MotoristaController::class, 'index']);
        Route::get('/motoristas/{motorista}', [MotoristaController::class, 'show']);

        Route::post('/tanques', [TanqueController::class, 'store']);
        Route::put('/tanques/{tanque}', [TanqueController::class, 'update']);
        Route::post('/tanques/{tanque}/entradas', [TanqueController::class, 'entrada']);

        Route::delete('/abastecimentos/{abastecimento}', [AbastecimentoController::class, 'destroy']);

        Route::post('/caminhoes/{caminhao}/manutencoes', [ManutencaoController::class, 'store']);

        Route::get('/relatorios/consumo', [RelatorioController::class, 'consumo']);
        Route::get('/relatorios/abastecimentos', [RelatorioController::class, 'abastecimentos']);
        Route::get('/relatorios/quilometragem', [RelatorioController::class, 'quilometragem']);
        Route::get('/relatorios/auditoria', [RelatorioController::class, 'auditoria']);
        Route::get('/relatorios/notas', [RelatorioController::class, 'notas']);
    });
});
