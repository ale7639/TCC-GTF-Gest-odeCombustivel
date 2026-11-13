import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT =
  process.argv[2] ||
  'C:\\Users\\Daniel\\AppData\\Local\\Cursor\\AgentStores\\cursor_agent_stores\\bc-62225adc-bb2b-4d91-abbd-16a698a133cc\\files\\media\\run';
const BASE = 'http://127.0.0.1:8082';
const API = 'http://127.0.0.1:8002/api';

fs.mkdirSync(OUT, { recursive: true });

async function login(body) {
  const r = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!j.token) throw new Error('login failed: ' + JSON.stringify(j));
  return j;
}

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log('wrote', file);
}

async function injectSession(page, auth) {
  await page.goto(BASE + '?gfc69=' + Date.now(), { waitUntil: 'networkidle', timeout: 90000 });
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

async function clearSession(page) {
  await page.evaluate(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
  });
  await page.reload({ waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1500);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

// --- Login screen + esqueci senha ---
await page.goto(BASE + '?login=' + Date.now(), { waitUntil: 'networkidle', timeout: 90000 });
await clearSession(page);
await page.waitForTimeout(800);
await shot(page, 'gfc69-login.png');

await page.getByText('Esqueci minha senha').click();
await page.waitForTimeout(700);
await page.getByPlaceholder('CPF', { exact: true }).fill('548.617.700-33');
await shot(page, 'gfc69-esqueci-senha.png');
await page.getByText('Enviar pedido').click();
await page.waitForTimeout(1200);
await shot(page, 'gfc69-esqueci-senha-ok.png');
await page.getByText('Voltar').click();
await page.waitForTimeout(500);

// --- Motorista: início / lançamentos / perfil ---
const motorista = await login({ login: '548.617.700-33', password: 'motorista123' });
await injectSession(page, motorista);
await shot(page, 'gfc69-motorista-inicio.png');

await page.getByText('Lançamentos', { exact: true }).last().click();
await page.waitForTimeout(1800);
await shot(page, 'gfc69-motorista-lancamentos.png');

await page.getByText('Abastecimento', { exact: true }).first().click();
await page.waitForTimeout(1200);
await shot(page, 'gfc69-motorista-filtro.png');

await page.getByText('Perfil', { exact: true }).last().click();
await page.waitForTimeout(1800);
await shot(page, 'gfc69-motorista-perfil.png');

// --- Admin: painel com pedido de senha ---
await clearSession(page);
const admin = await login({ login: 'admin@frota.com', password: 'admin123' });
await injectSession(page, admin);
await page.waitForTimeout(1500);
await shot(page, 'gfc69-admin-pedido-senha.png');

await page.getByText('Mais', { exact: true }).last().click();
await page.waitForTimeout(800);
const motLink = page.getByText('Motoristas', { exact: true }).first();
if (await motLink.count()) {
  await motLink.click();
  await page.waitForTimeout(1800);
  await shot(page, 'gfc69-admin-motoristas.png');
}

await browser.close();
console.log('done');
