<?php

use App\Http\Controllers\Api\AlertController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\FuelingController;
use App\Http\Controllers\Api\FuelTankController;
use App\Http\Controllers\Api\MaintenanceController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\TruckController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\WashController;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:login')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
});

Route::post('/register', [AuthController::class, 'register']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:password-reset');
Route::post('/reset-password', [AuthController::class, 'resetPassword']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/password', [AuthController::class, 'changePassword']);
    Route::get('/dashboard', [DashboardController::class, 'show']);

    Route::get('/trucks/check-plate', [TruckController::class, 'checkPlate']);
    Route::get('/trucks', [TruckController::class, 'index']);
    Route::get('/trucks/{truck}', [TruckController::class, 'show']);
    Route::get('/trucks/{truck}/checklist', [TruckController::class, 'checklist']);
    Route::get('/trucks/{truck}/status', [TruckController::class, 'status']);

    Route::post('/trucks', [TruckController::class, 'store'])->middleware('role:administrador');
    Route::post('/trucks/import', [TruckController::class, 'import'])->middleware('role:administrador');
    Route::put('/trucks/{truck}', [TruckController::class, 'update'])->middleware('role:administrador');
    Route::delete('/trucks/{truck}', [TruckController::class, 'destroy'])->middleware('role:administrador');

    Route::get('/fuelings/limits', [FuelingController::class, 'limits']);
    Route::post('/fuelings', [FuelingController::class, 'store']);
    Route::get('/trucks/{truck}/fuelings', [FuelingController::class, 'index']);
    Route::post('/tank/refill', [FuelTankController::class, 'refill'])->middleware('role:administrador');

    Route::get('/trucks/{truck}/maintenances', [MaintenanceController::class, 'index']);
    Route::post('/trucks/{truck}/maintenances', [MaintenanceController::class, 'store'])
        ->middleware('role:administrador,supervisor');

    Route::get('/trucks/{truck}/washes', [WashController::class, 'show']);
    Route::post('/trucks/{truck}/washes', [WashController::class, 'store']);
    Route::put('/trucks/{truck}/washes/frequency', [WashController::class, 'updateFrequency'])
        ->middleware('role:administrador');

    Route::get('/alerts', [AlertController::class, 'index']);
    Route::post('/alerts/{alert}/read', [AlertController::class, 'markRead']);
    Route::post('/alerts/read-all', [AlertController::class, 'markAllRead']);
    Route::post('/alerts/generate', [AlertController::class, 'generate'])
        ->middleware('role:administrador,supervisor');

    Route::middleware('role:administrador,supervisor')->group(function () {
        Route::get('/reports/consumption', [ReportController::class, 'consumption']);
        Route::get('/reports/consumption.csv', [ReportController::class, 'exportCsv']);
    });

    Route::middleware('role:administrador')->group(function () {
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::put('/users/{user}', [UserController::class, 'updateRole']);
        Route::get('/audit-logs', [AuditLogController::class, 'index']);
    });
});
