<?php

namespace App\Providers;

use App\Models\Caminhao;
use App\Policies\CaminhaoPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Gate::policy(Caminhao::class, CaminhaoPolicy::class);
    }
}
