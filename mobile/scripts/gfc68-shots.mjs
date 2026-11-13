import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT =
  process.argv[2] ||
  'C:\\Users\\Daniel\\AppData\\Local\\Cursor\\AgentStores\\cursor_agent_stores\\bc-62225adc-bb2b-4d91-abbd-16a698a133cc\\files\\media\\run';
const BASE = 'http://127.0.0.1:8082';
const API = 'http://127.0.0.1:8002/api';

fs.mkdirSync(OUT, { recursive: true });

async function loginToken() {
  const r = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: 'admin@frota.com', password: 'admin123' }),
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

async function escolherOpcao(page, rotuloAria, trechoOpcao) {
  await page.getByLabel(`Selecionar ${rotuloAria}`).click();
  await page.waitForTimeout(600);
  // Nested Modal overlay intercepts normal clicks — force the option button.
  const opt = page.locator(`button[aria-label*="${trechoOpcao}"]`).last();
  await opt.waitFor({ state: 'visible', timeout: 10000 });
  await opt.click({ force: true });
  await page.waitForTimeout(800);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

const auth = await loginToken();
await page.goto(BASE + '?gfc68=' + Date.now(), { waitUntil: 'networkidle', timeout: 90000 });
await page.evaluate(
  ({ token, usuario }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('usuario', JSON.stringify(usuario));
  },
  { token: auth.token, usuario: auth.usuario || auth.user }
);
await page.reload({ waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(3000);

await page.getByText('Abastecer', { exact: true }).last().click();
await page.waitForTimeout(1800);
await shot(page, 'gfc68-abastecer.png');

await page.getByText('+ Novo').first().click();
await page.waitForTimeout(1000);
await shot(page, 'gfc68-abastecer-form.png');

await escolherOpcao(page, 'Selecione o caminhão', 'ABC1D23');
await escolherOpcao(page, 'Tanque de origem', 'Tanque Principal');

await page.getByPlaceholder('0').fill('100');
await page.waitForTimeout(600);
await shot(page, 'gfc68-abastecer-form-nivel.png');

await page.getByText('Confirmar abastecimento').click();
await page.waitForTimeout(2800);
if (await page.getByText('Abastecimento confirmado').count()) {
  await shot(page, 'gfc68-abastecer-sucesso.png');
  await page.getByText('Concluir').click();
  await page.waitForTimeout(900);
} else {
  const body = await page.locator('body').innerText();
  console.log('confirm failed snippet:', body.slice(0, 400));
  if (await page.getByText('Cancelar').count()) await page.getByText('Cancelar').click();
  await page.waitForTimeout(700);
}

const busca = page.getByPlaceholder('Buscar por placa ou motorista');
await busca.fill('zzz-sem-resultado-xyz');
await page.waitForTimeout(500);
await page.getByText('Nenhum abastecimento neste filtro', { timeout: 15000 }).waitFor();
await page.waitForTimeout(400);
await shot(page, 'gfc68-abastecer-vazio.png');
await busca.fill('');
await page.waitForTimeout(800);

await page.getByText('Relatórios', { exact: true }).last().click();
await page.waitForTimeout(2500);
await shot(page, 'gfc68-relatorios.png');
await page.mouse.wheel(0, 560);
await page.waitForTimeout(700);
await shot(page, 'gfc68-relatorios-ranking.png');

// Empty relatórios: switch period won't empty; skip inventing wipe — use filter note in report

await browser.close();
console.log('done');
