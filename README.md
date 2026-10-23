# GFC — Gestão de Combustível e Frota

Pré-projeto de TCC (Laravel API + React + Docker). O Compose **não** sobe o React.

```bash
docker compose up -d --build
cd frontend && npm install && npm run dev -- --host 0.0.0.0 --port 5173
```

- App: http://127.0.0.1:5173
- API: http://127.0.0.1:8000
- phpMyAdmin: http://127.0.0.1:8081 (`root` / `secret`)

Contas (`Senha123`): `diego@gfc.com.br` (admin), `ana@gfc.com.br` (supervisor), `joao@gfc.com.br` (motorista).

A pasta `mobile/` é o Expo da base do Wallace; a demo da banca é o frontend web.
