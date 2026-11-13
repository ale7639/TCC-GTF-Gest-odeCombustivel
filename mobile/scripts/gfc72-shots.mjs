import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT =
  process.argv[2] ||
  'C:\\Users\\Daniel\\AppData\\Local\\Cursor\\AgentStores\\cursor_agent_stores\\bc-62225adc-bb2b-4d91-abbd-16a698a133cc\\files\\media\\run';
const BASE = 'http://127.0.0.1:8082';
const API = 'http://127.0.0.1:8002/api';

fs.mkdirSync(OUT, { recursive: true });

async function api(caminho, { metodo = 'GET', corpo, token } = {}) {
  const r = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const j = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, json: j };
}

async function login(body, tentativas = 4) {
  for (let i = 0; i < tentativas; i++) {
    const { ok, status, json } = await api('/login', { metodo: 'POST', corpo: body });
    if (ok && json?.token) return json;
    if (status === 429) {
      console.log('throttle, aguardando...');
      await new Promise((r) => setTimeout(r, 65000));
      continue;
    }
    throw new Error('login failed: ' + JSON.stringify(json));
  }
  throw new Error('login throttled');
}

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log('wrote', file);
}

async function injectSession(page, auth) {
  await page.goto(BASE + '?gfc72=' + Date.now(), { waitUntil: 'networkidle', timeout: 90000 });
  await page.evaluate(
    ({ token, usuario }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('usuario', JSON.stringify(usuario));
    },
    { token: auth.token, usuario: auth.usuario || auth.user }
  );
  await page.reload({ waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2500);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

// Login eye: plain login screen (no session)
await page.goto(BASE + '?gfc72-login=' + Date.now(), { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(1500);
await page.getByPlaceholder('Senha').fill('admin123');
await page.getByLabel('Mostrar senha').click();
await page.waitForTimeout(400);
await shot(page, 'gfc72-login-eye.png');

const admin = await login({ login: 'admin@frota.com', password: 'admin123' });
await injectSession(page, admin);

// Painel expand/collapse
await page.getByLabel('Painel').click().catch(() => {});
await page.waitForTimeout(2000);
await page.getByText('Últimos abastecimentos').first().waitFor({ timeout: 15000 });
await shot(page, 'gfc72-painel-aberto.png');

await page.getByLabel('Recolher Últimos abastecimentos').click();
await page.waitForTimeout(600);
await page.getByLabel('Recolher Últimas notas fiscais').click();
await page.waitForTimeout(600);
await shot(page, 'gfc72-painel-fechado.png');

// Relatórios → caminhão histórico
await page.getByLabel('Relatórios').click();
await page.waitForTimeout(2200);
await page.getByText('Caminhões que mais consumiram').first().waitFor({ timeout: 20000 });
await shot(page, 'gfc72-ranking-caminhoes.png');

const card = page.getByLabel(/^Histórico do caminhão /).first();
await card.waitFor({ timeout: 15000 });
await card.click();
await page.waitForTimeout(2200);
await shot(page, 'gfc72-caminhao-historico.png');

await browser.close();
console.log('done');
