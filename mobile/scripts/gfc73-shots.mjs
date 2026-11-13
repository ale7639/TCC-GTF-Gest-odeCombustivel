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
  await page.goto(BASE + '?gfc73=' + Date.now(), { waitUntil: 'networkidle', timeout: 90000 });
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

async function clicarChipTudo(page) {
  // Chip Pressable wrapping the "Tudo" label — force evita interceptação do ScrollView.
  const chip = page.getByText('Tudo', { exact: true }).last();
  await chip.click({ force: true });
  await page.waitForTimeout(2200);
}

async function fecharModal(page) {
  const voltar = page.getByLabel('Voltar');
  if (await voltar.count()) {
    await voltar.first().click({ force: true });
    await page.waitForTimeout(800);
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

const admin = await login({ login: 'admin@frota.com', password: 'admin123' });
await injectSession(page, admin);

// Relatórios combustível: período + busca
await page.getByLabel('Relatórios').click();
await page.waitForTimeout(2200);
await page.getByText('Combustível · período').first().waitFor({ timeout: 15000 });
await page.getByLabel('Buscar caminhão no relatório').waitFor({ timeout: 10000 });
await shot(page, 'gfc73-relatorios-busca.png');

// Histórico caminhão
const cardCam = page.getByLabel(/^Histórico do caminhão /).first();
await cardCam.waitFor({ timeout: 15000 });
await cardCam.click();
await page.waitForTimeout(2500);
await page.getByLabel('Buscar no histórico do caminhão').waitFor({ timeout: 10000 });
await clicarChipTudo(page);
await shot(page, 'gfc73-caminhao-historico-filtros.png');

const maisCam = page.getByLabel('Carregar mais ações do histórico');
if (await maisCam.count()) {
  await maisCam.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await shot(page, 'gfc73-caminhao-carregar-mais.png');
}
await fecharModal(page);

// Notas fiscais
await page.getByLabel('Abrir notas fiscais').click();
await page.waitForTimeout(2200);
await page.getByText('Notas fiscais').first().waitFor({ timeout: 15000 });
await clicarChipTudo(page);
await shot(page, 'gfc73-notas-filtros.png');
const maisNf = page.getByText(/Carregar mais \(/);
if (await maisNf.count()) {
  await maisNf.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await shot(page, 'gfc73-notas-carregar-mais.png');
}

// Relatório motoristas
await page.getByLabel('Relatórios').click();
await page.waitForTimeout(1500);
await page.getByLabel('Abrir relatório de motoristas').click();
await page.waitForTimeout(2200);
await page.getByPlaceholder('Buscar motorista').waitFor({ timeout: 15000 });
await shot(page, 'gfc73-motoristas-filtros.png');

const cardMot = page.getByLabel(/^Histórico de /).first();
await cardMot.waitFor({ timeout: 15000 });
await cardMot.click();
await page.waitForTimeout(2500);
await page.getByLabel('Buscar no histórico do motorista').waitFor({ timeout: 10000 });
await clicarChipTudo(page);
await shot(page, 'gfc73-motorista-historico-filtros.png');

const maisMot = page.getByLabel('Carregar mais ações do histórico');
if (await maisMot.count()) {
  await maisMot.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await shot(page, 'gfc73-motorista-carregar-mais.png');
}

await browser.close();
console.log('done');
