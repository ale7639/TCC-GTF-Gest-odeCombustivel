# GFC — Gestão de Combustível e Frota

Pré-projeto de TCC (Laravel API + React + Docker). O Compose **não** sobe o React.

```bash
docker compose up -d --build
cd frontend && npm install && npm run dev -- --host 0.0.0.0 --port 5173
```

- App: http://127.0.0.1:5173
- API: http://127.0.0.1:8000
- phpMyAdmin: http://127.0.0.1:8081 (`root` / `secret`)

Contas de seed (`Senha123`): digite o e-mail na tela de login (sem atalhos) —
`diego@gfc.com.br` (administrador, layout web), `ana@gfc.com.br` (supervisor, mobile),
`joao@gfc.com.br` (motorista, mobile).

A pasta `mobile/` é o Expo da base do Wallace; a demo da banca é o frontend web.
