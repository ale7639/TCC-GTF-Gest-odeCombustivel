# GFC — Gestão de Combustível e Frota

Pré-projeto de TCC (Laravel API + React + Docker). O Compose **não** sobe o React.

```bash
docker compose up -d --build
cd frontend && npm install && npm run dev -- --host 0.0.0.0 --port 5173
```

- App: http://127.0.0.1:5173
- API: http://127.0.0.1:8000
- phpMyAdmin: http://127.0.0.1:8081 (`root` / `secret`)

Contas de seed (`Senha123`), sem atalhos de papel na tela:

| Papel | Entrada | Identificador |
|---|---|---|
| Administrador | e-mail | `diego@gfc.com.br` (layout web) |
| Supervisor | e-mail | `ana@gfc.com.br` (mobile) |
| Motorista | **CPF** | `111.111.111-11` — João Santos (mobile) |

Motorista autentica pelo CPF da ficha (`motoristas.cpf`), não pelo e-mail.

A pasta `mobile/` é o Expo da base do Wallace; a demo da banca é o frontend web.
