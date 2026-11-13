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
  await page.goto(BASE + '?gfc71=' + Date.now(), { waitUntil: 'networkidle', timeout: 90000 });
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

const admin = await login({ login: 'admin@frota.com', password: 'admin123' });
await injectSession(page, admin);

// Relatórios (combustível) com atalho Notas + botão CSV
await page.getByLabel('Relatórios').click();
await page.waitForTimeout(2200);
await page.getByText('Outros relatórios').first().waitFor({ timeout: 15000 });
await shot(page, 'gfc71-relatorios-hub.png');

// Notas via atalho
await page.getByLabel('Abrir notas fiscais').click();
await page.waitForTimeout(2200);
await page.getByText('Notas fiscais').first().waitFor({ timeout: 15000 });
await shot(page, 'gfc71-notas-fiscais.png');

// Voltar aos Relatórios pelo tab e baixar combustível (só UI do botão)
await page.getByLabel('Relatórios').click();
await page.waitForTimeout(1500);
await shot(page, 'gfc71-relatorios-csv-btn.png');

// Motoristas pelo atalho
await page.getByLabel('Abrir relatório de motoristas').click();
await page.waitForTimeout(2200);
await page.getByText('Relatório motoristas').first().waitFor({ timeout: 15000 });
await shot(page, 'gfc71-relatorio-motoristas.png');

// Abrir histórico do primeiro motorista
const card = page.getByLabel(/^Histórico de /).first();
await card.waitFor({ timeout: 15000 });
await card.click();
await page.waitForTimeout(2200);
await shot(page, 'gfc71-motorista-historico.png');

await browser.close();
console.log('done');
