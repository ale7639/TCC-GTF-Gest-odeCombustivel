<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    $frontend = rtrim((string) config('app.frontend_url'), '/');

    return response(
        <<<HTML
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GFC API</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Georgia, serif; background: #143628; color: #f3eee4; }
    main { width: min(420px, 92vw); background: #f3eee4; color: #14181c; padding: 28px; border-radius: 22px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    p { line-height: 1.45; }
    a { color: #1c4d3a; font-weight: 700; }
    code { background: #e7efe9; padding: 2px 6px; border-radius: 6px; }
  </style>
</head>
<body>
  <main>
    <p style="letter-spacing:.16em;text-transform:uppercase;font-size:12px;color:#6b7280;font-family:sans-serif;">Backend Laravel</p>
    <h1>GFC API no ar</h1>
    <p>Esta porta é só a API. O aplicativo abre em <a href="{$frontend}">{$frontend}</a>.</p>
    <p>Para ver as tabelas no navegador, use o phpMyAdmin: <a href="http://localhost:8081">http://localhost:8081</a> (usuário <code>root</code>, senha <code>secret</code>).</p>
    <p>Se o frontend não abrir, rode <code>npm run dev</code> na pasta <code>frontend</code>.</p>
  </main>
</body>
</html>
HTML,
        200,
        ['Content-Type' => 'text/html; charset=utf-8']
    );
});
