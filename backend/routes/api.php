<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CaminhaoController;
use App\Http\Controllers\DashboardController;
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

    // Cria as 5 rotas de caminhões (listar, ver, cadastrar, alterar, excluir).
    // O parameters() diz que o {id} da URL vira a variável $caminhao no controller.
    Route::apiResource('caminhoes', CaminhaoController::class)
        ->parameters(['caminhoes' => 'caminhao']);
});