# GFC — Gestão de Combustível e Frota

Pré-projeto de TCC: **Expo** (`mobile/`) + **Laravel API** (`backend/`) + **MySQL no Docker**.

A UI oficial é o app Expo (web no PC e telefone). Não há mais pasta `frontend/` (Vite/React).

```bash
docker compose up -d --build
cd backend && composer install && php artisan migrate --seed
cd ../mobile && npm install && npx expo start --web
```

### Portas (o que o compose/scripts usam)

| Serviço | Compose / padrão | Alternativa na prática |
|---|---|---|
| API Laravel | **8000** (`app` no compose, ou `php artisan serve`) | **8002** se a 8000 estiver ocupada |
| Expo (web/Metro) | **8081** (`npx expo start`) | **8082** se a 8081 estiver ocupada (ex.: phpMyAdmin) |
| MySQL | **3306** (`127.0.0.1:3306`) | **3308** (ou `3307` no `.env.example` Wallace) se a 3306 estiver no XAMPP |
| phpMyAdmin | **8081** (`root` / `secret`) | — |

- App Expo: http://127.0.0.1:8081 (ou :8082)
- API: http://127.0.0.1:8000 (ou :8002)
- phpMyAdmin: http://127.0.0.1:8081 (`root` / `secret`)

### Contas de seed (Wallace)

| Papel | Entrada | Identificador | Senha |
|---|---|---|---|
| Administrador | e-mail | `admin@frota.com` | `admin123` |
| Motorista | **CPF** | ex. `548.617.700-33` — Carlos Eduardo Silva (seed determinístico) | `motorista123` |

Motorista autentica pelo CPF da ficha (`motoristas.cpf`), não por e-mail. “Esqueci minha senha” aciona o fluxo do app (WhatsApp do admin / notificação).

---

# Fluxo de Trabalho do Projeto

## Objetivo

Este projeto será desenvolvido em equipe por três integrantes:

* Wallace
* Diego

Para manter o código organizado e evitar conflitos, utilizaremos uma estratégia de versionamento com Git baseada em branches. Todos os integrantes devem seguir estas regras durante todo o desenvolvimento do projeto.

---

# Estrutura das Branches

O repositório possuirá as seguintes branches:

* **main** → Contém apenas versões estáveis e aprovadas do sistema.
* **test** → Utilizada para integração e testes das funcionalidades desenvolvidas.
* **wallace** → Branch de desenvolvimento do Wallace.
* **diego** → Branch de desenvolvimento do Diego.

Cada integrante deverá trabalhar exclusivamente na sua própria branch.

---

# Fluxo de Desenvolvimento

O fluxo de desenvolvimento seguirá a seguinte sequência:

```
Branch do Desenvolvedor
        ↓
Desenvolvimento
        ↓
Testes Locais
        ↓
Commit
        ↓
Push
        ↓
Merge para test
        ↓
Testes Gerais
        ↓
Merge para main
```

---

# Regras de Desenvolvimento

## 1. Trabalhar apenas na própria branch

Cada integrante é responsável apenas pela sua branch.

Exemplo:

* Wallace → branch `wallace`
* Diego → branch `diego`

Não é permitido desenvolver diretamente nas branches `test` ou `main`.

---

## 2. Antes de realizar um commit

Todo código enviado ao repositório deve:

* Compilar sem erros.
* Estar testado.
* Não conter código incompleto.
* Não conter arquivos temporários ou desnecessários.
* Estar relacionado a uma funcionalidade específica.

Evite realizar commits contendo diversas alterações sem relação entre si.

---

## 3. Commits

Os commits devem possuir mensagens objetivas e descritivas.

Exemplos:

```
feat: cadastro de caminhões

feat: tela de abastecimento

fix: corrigido cálculo de consumo

refactor: reorganização do serviço de abastecimento
```

Evite mensagens como:

```
teste

update

aaa

alterações
```

---

## 4. Enviando alterações

Após finalizar uma funcionalidade:

1. Testar o sistema.
2. Realizar o commit.
3. Enviar para o GitHub através da própria branch.

Exemplo:

```
git add .
git commit -m "feat: cadastro de caminhões"
git push origin wallace
```

---

# Integração na Branch Test

Quando uma funcionalidade estiver completamente pronta e funcionando:

* Realizar o Merge (ou Pull Request) da branch do desenvolvedor para a branch **test**.

Na branch **test** serão realizados testes de integração para verificar:

* funcionamento da funcionalidade;
* compatibilidade com o código dos demais integrantes;
* possíveis conflitos;
* estabilidade do sistema.

Caso seja identificado algum problema, ele deverá ser corrigido na branch do responsável antes de um novo merge.

---

# Publicação na Main

A branch **main** representa a versão oficial do projeto.

Somente será permitido realizar merge para a **main** quando:

* todas as funcionalidades estiverem funcionando corretamente;
* não existirem conflitos;
* o sistema estiver validado pela equipe.

A branch **main** nunca deverá conter código em desenvolvimento.

---

# Atualização da Branch

Antes de iniciar novas funcionalidades, cada integrante deverá atualizar sua branch com as alterações presentes na branch **test**, reduzindo a chance de conflitos durante futuros merges.

---

# Organização da Equipe

Cada integrante será responsável pelas funcionalidades sob sua responsabilidade, mantendo seu código organizado, documentado e testado.

Sempre que necessário, os integrantes deverão comunicar alterações que possam impactar o trabalho dos demais.

---

# Boas Práticas

* Trabalhar somente na própria branch.
* Testar antes de enviar qualquer alteração.
* Fazer commits pequenos e frequentes.
* Escrever mensagens de commit claras.
* Não alterar código de outro integrante sem comunicação.
* Resolver conflitos antes de realizar merges.
* Manter o projeto sempre compilando.
* Utilizar o arquivo `.gitignore` corretamente.
* Documentar alterações importantes.

---

# Fluxo Resumido

```
Criar funcionalidade
        ↓
Desenvolver na própria branch
        ↓
Testar
        ↓
Commit
        ↓
Push
        ↓
Merge para test
        ↓
Testes de integração
        ↓
Sistema funcionando?
      ↓         ↓
     Não       Sim
      ↓         ↓
 Corrigir    Merge para main
```

---

# Objetivo Final

Seguindo este fluxo de trabalho, a equipe garante:

* melhor organização do código;
* menor quantidade de conflitos durante o desenvolvimento;
* facilidade para identificar alterações de cada integrante;
* maior estabilidade do sistema;
* histórico de versões limpo e organizado;
* uma versão principal (`main`) sempre pronta para apresentação do TCC.

---

# GFC — Gestão de Combustível e Frota

Sistema mobile-first (Expo web + telefone) para a Transportadora parceira da UNIALFA: controle de tanque, abastecimento, frota, manutenção, lavagem, relatórios e alertas.

O código segue o documento de TCC (sprints, regras de negócio e casos de teste), com estrutura clara e sem overengineering.

## Stack

- UI: Expo / React Native (`mobile/`) — web no PC e app no telefone
- Backend: PHP 8.2+ · Laravel · API REST · Laravel Sanctum (`backend/`)
- Banco: MySQL 8 (Docker Compose)

## Perfis (RN)

| Perfil | Acesso |
|---|---|
| Administrador | Tudo: frota, motoristas, tanques, abastecimentos, relatórios |
| Motorista | Área do motorista (abastecimento, checklist, etc.). Sem gestão de frota |

Login: **admin por e-mail**; **motorista por CPF**.

## Como rodar

### 1) Docker (MySQL + API + phpMyAdmin)

Na pasta do projeto:

```bash
docker compose up -d --build
```

O `docker-compose.yml` sobe:

- **MySQL** em `127.0.0.1:3306` (banco `gfc`, user `root` / `secret`)
- **API Laravel** (Apache no container) em http://localhost:8000
- **phpMyAdmin** em http://localhost:8081

Alternativa comum na banca: Compose só para MySQL e API com `php artisan serve` (porta 8000 ou 8002).

| Campo | Valor (compose) |
|---|---|
| Host (HeidiSQL / DBeaver / Workbench) | `127.0.0.1` |
| Porta | `3306` (ou `3308` / `3307` se remapear) |
| Banco | `gfc` |
| Usuário | `root` |
| Senha | `secret` |

Se a porta 3306 já estiver ocupada pelo XAMPP, pare o MySQL do XAMPP ou remapeie a porta no compose.

### 2) API no computador (sem container `app`)

Requisitos: PHP 8.2+ com extensões `openssl`, `pdo_mysql`, `mbstring`, `tokenizer`, `xml`, `curl`, `fileinfo` e Composer.

```bash
cd backend
copy .env.example .env
composer install
php artisan key:generate
```

Ajuste o `.env` para o MySQL do compose:

```
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=gfc
DB_USERNAME=root
DB_PASSWORD=secret
```

Depois:

```bash
php artisan migrate --seed
php artisan serve
# ou, se 8000 estiver ocupada:
php artisan serve --port=8002
```

API em `http://127.0.0.1:8000` (ou `:8002`).

### 3) App Expo (`mobile/`)

```bash
cd mobile
npm install
npx expo start --web
# telefone na mesma rede: npx expo start  (QR / Expo Go)
```

App web em `http://localhost:8081` (Expo sobe em **8082** se a 8081 estiver ocupada). Ajuste `mobile/src/config.js` (`API_URL` / IP da máquina) para apontar à API.

### Alertas automáticos

O job diário das 6h está no scheduler (`gfc:gerar-alertas`). Em desenvolvimento:

```bash
cd backend
php artisan gfc:gerar-alertas
php artisan schedule:work
```

## Contas de demonstração

| Perfil | Entrada | Senha |
|---|---|---|
| Administrador | `admin@frota.com` | `admin123` |
| Motorista | CPF do seed (ex. Carlos `548.617.700-33`) | `motorista123` |

CPFs dos motoristas vêm do `DemonstracaoSeeder` (semente `mt_srand(2026)`), estáveis após `migrate --seed`.

## Segurança (qualidade de uso real)

- Senha com bcrypt, nunca em texto puro
- Token Sanctum
- Mensagem genérica de login (não revela se o identificador existe)
- Perfis validados no servidor, não só no menu
- Abastecimento em transação (débito do tanque + registro juntos)
- Soft delete de caminhão, com auditoria quando aplicável
- Validação de placa (AAA-9999 e Mercosul) no app e no backend

## Estrutura

```
backend/     API Laravel
mobile/      App Expo (web + telefone)
docker-compose.yml   MySQL (+ API e phpMyAdmin no compose padrão)
```

Regras de negócio principais ficam em `backend/app` (controllers/services) e nas Form Requests.

## Testes

```bash
cd backend
php artisan test
```

Nunca commite `.env`, `vendor` nem `node_modules`.
