<?php

namespace Tests;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Application;

trait CreatesApplication
{
    public function createApplication(): Application
    {
        putenv('APP_ENV=testing');
        putenv('DB_CONNECTION=sqlite');
        putenv('DB_DATABASE=:memory:');
        $_ENV['APP_ENV'] = 'testing';
        $_ENV['DB_CONNECTION'] = 'sqlite';
        $_ENV['DB_DATABASE'] = ':memory:';
        $_SERVER['APP_ENV'] = 'testing';
        $_SERVER['DB_CONNECTION'] = 'sqlite';
        $_SERVER['DB_DATABASE'] = ':memory:';

        $app = require __DIR__.'/../bootstrap/app.php';
        $app->make(Kernel::class)->bootstrap();

        return $app;
    }
}
