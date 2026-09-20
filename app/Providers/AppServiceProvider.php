<?php

namespace App\Providers;

use App\Models\Truck;
use App\Models\User;
use App\Policies\TruckPolicy;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Carbon::setLocale('pt_BR');
        Gate::policy(Truck::class, TruckPolicy::class);

        ResetPassword::createUrlUsing(function ($user, string $token) {
            return rtrim(config('app.frontend_url'), '/').'/nova-senha?token='.$token.'&email='.urlencode($user->email);
        });

        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(10)->by($request->ip());
        });

        RateLimiter::for('password-reset', function (Request $request) {
            return Limit::perHour(3)->by($request->ip());
        });

        $this->seedDemoDataIfEmpty();
    }

    private function seedDemoDataIfEmpty(): void
    {
        if (! app()->environment('local') || app()->runningUnitTests()) {
            return;
        }

        try {
            if (Schema::hasTable('users') && User::query()->doesntExist()) {
                Artisan::call('db:seed', ['--force' => true]);
            }
        } catch (\Throwable) {
            // Banco ainda pode estar subindo.
        }
    }
}
