# Fluxo de Trabalho do Projeto

## Objetivo

Este projeto será desenvolvido em equipe por três integrantes:

* Wallace
* Diego
* Gabriel

Para manter o código organizado e evitar conflitos, utilizaremos uma estratégia de versionamento com Git baseada em branches. Todos os integrantes devem seguir estas regras durante todo o desenvolvimento do projeto.

---

# Estrutura das Branches

O repositório possuirá as seguintes branches:

* **main** → Contém apenas versões estáveis e aprovadas do sistema.
* **test** → Utilizada para integração e testes das funcionalidades desenvolvidas.
* **wallace** → Branch de desenvolvimento do Wallace.
* **diego** → Branch de desenvolvimento do Diego.
* **gabriel** → Branch de desenvolvimento do Gabriel.

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
* Gabriel → branch `gabriel`

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

Sistema mobile-first e web para a Transportadora parceira da UNIALFA: controle de tanque, abastecimento, frota, manutenção, lavagem, relatórios e alertas.

O código segue o documento de TCC (sprints, regras de negócio e casos de teste), com estrutura de um desenvolvedor pleno/júnior: claro, organizado e sem overengineering.

## Stack

- Backend: PHP 8.2+ · Laravel 11 · API REST · Laravel Sanctum
- Frontend: React 18 · Vite · PWA (instalável no celular)
- Banco: MySQL 8

## Perfis (RN)

| Perfil | Acesso |
|---|---|
| Administrador | Tudo, inclusive cadastro/edição/exclusão de caminhões e usuários |
| Supervisor | Operação: checklist, manutenção, lavagem, abastecimento, relatórios e alertas |
| Motorista | Dashboard, frota (consulta), abastecer e lavagem. Sem relatórios e sem exclusão |

## Como rodar (Docker)

Na pasta do projeto:

```bash
docker compose up -d --build
```

- App (telas de login e dashboard): http://localhost:5173
- API: http://localhost:8000 — página de status. O sistema em si não abre nesta porta.
- Banco (phpMyAdmin): http://localhost:8081

O MySQL do Docker **não tem tela própria**. O phpMyAdmin é o jeito mais simples de administrar as tabelas.

| Campo | Valor |
|---|---|
| Host (HeidiSQL / DBeaver / Workbench) | `127.0.0.1` — não use `mysql` nem `localhost` se falhar |
| Porta | `3306` |
| Banco | `gfc` |
| Usuário | `root` |
| Senha | `secret` |

No phpMyAdmin isso já vem preenchido. No Workbench, se pedir SSL, use a opção de conexão sem SSL.

Se a porta 3306 já estiver ocupada pelo XAMPP, feche o MySQL do XAMPP ou o Docker não consegue expor o banco.

### Alternativa: MySQL no Docker e Laravel no computador

Requisitos: PHP 8.2+ com extensões `openssl`, `pdo_mysql`, `mbstring`, `tokenizer`, `xml`, `curl`, `fileinfo` e Composer.

```bash
cd backend
copy .env.example .env
composer install
php artisan key:generate
```

Ajuste o `.env` se o MySQL não for `root` sem senha:

```
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=gfc
DB_USERNAME=root
DB_PASSWORD=
```

Depois:

```bash
php artisan migrate --seed
php artisan serve
```

API em `http://127.0.0.1:8000`.

### Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

App em `http://localhost:5173`. No computador ele aparece como um celular; no telefone ocupa a tela toda.

### Alertas automáticos

O job diário das 6h está no scheduler (`gfc:gerar-alertas`). Em desenvolvimento:

```bash
cd backend
php artisan gfc:gerar-alertas
php artisan schedule:work
```

## Contas de demonstração

Senha de todos: `Senha123`

| Perfil | E-mail |
|---|---|
| Administrador | diego@gfc.com.br |
| Supervisor | ana@gfc.com.br |
| Motorista | joao@gfc.com.br |

Na tela de login há atalhos para preencher cada perfil.

## Segurança (qualidade de uso real)

- Senha com bcrypt (12 rounds), nunca em texto puro
- Token Sanctum com validade de 24 horas
- Mensagem genérica de login (não revela se o e-mail existe)
- Bloqueio da conta após 5 tentativas, por 15 minutos
- Recuperação de senha: mesma resposta para e-mail existente ou não, link de 1 hora, máximo 3 pedidos por IP/hora
- Abastecimento em transação (débito do tanque + registro juntos)
- Soft delete de caminhão, com auditoria (usuário, data, IP)
- Perfis validados no servidor, não só no menu
- Validação de placa (AAA-9999 e Mercosul) no frontend e no backend

## Tipografia e visual

- **DM Sans** — interface, leitura e formulários
- **Barlow Condensed** — placas, litros e indicadores (tipologia operacional de pátio)
- Paleta diesel / asfalto / âmbar de combustível, com ícone + cor nos status (acessível para daltonismo)

## Estrutura

```
backend/     API Laravel
frontend/    App React mobile-first
```

Regras de negócio principais ficam em `app/Services` (`FuelingService`, `ChecklistService`, `AlertService`) e nas Form Requests.

## Testes

```bash
cd backend
php artisan test
```

Nunca commite `.env`, `vendor` nem `node_modules`.
