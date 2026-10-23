<?php

use App\Http\Controllers\AbastecimentoController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CaminhaoController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\MotoristaController;
use App\Http\Controllers\TanqueController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

// Rota pública: confere e-mail e senha e devolve o token.
Route::post('/login', [AuthController::class, 'login']);

// Tudo aqui dentro só funciona com um token válido.
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Cada apiResource cria as rotas de listar, ver, cadastrar, alterar e excluir.
    // O parameters() diz que o {id} da URL vira a variável $caminhao no controller.
    Route::apiResource('caminhoes', CaminhaoController::class)
        ->parameters(['caminhoes' => 'caminhao']);
    Route::apiResource('motoristas', MotoristaController::class);

    // Abastecimentos: só listar, registrar e excluir (para corrigir erros).
    Route::apiResource('abastecimentos', AbastecimentoController::class)
        ->only(['index', 'store', 'destroy']);

    // Tanques: por enquanto só a lista (o cadastro entra junto com as entradas de combustível).
    Route::get('/tanques', [TanqueController::class, 'index']);
});