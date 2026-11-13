import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT =
  process.argv[2] ||
  'C:\\Users\\Daniel\\AppData\\Local\\Cursor\\AgentStores\\cursor_agent_stores\\bc-62225adc-bb2b-4d91-abbd-16a698a133cc\\files\\media\\run';
const BASE = 'http://127.0.0.1:8082';
const API = 'http://127.0.0.1:8002/api';
const CPF = '548.617.700-33';

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
  await page.goto(BASE + '?gfc70=' + Date.now(), { waitUntil: 'networkidle', timeout: 90000 });
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
  await page.waitForTimeout(1200);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

const pedido = await api('/senha/esqueci', { metodo: 'POST', corpo: { cpf: CPF } });
console.log('pedido', pedido.status, pedido.json?.message);

const admin = await login({ login: 'admin@frota.com', password: 'admin123' });
const lista = await api('/motoristas', { token: admin.token });
const motorista = (lista.json || []).find((m) => (m.cpf || '').includes('548.617.700'));
if (!motorista) throw new Error('motorista demo não encontrado');
console.log('motorista', motorista.id, motorista.nome);

const dashAntes = await api('/dashboard?dias=30', { token: admin.token });
console.log('pedidos_senha antes', dashAntes.json?.pedidos_senha);

await injectSession(page, admin);
await shot(page, 'gfc70-painel-com-pedido.png');

const reset = await api(`/motoristas/${motorista.id}`, {
  metodo: 'PUT',
  token: admin.token,
  corpo: {
    nome: motorista.nome,
    cpf: motorista.cpf,
    cnh: motorista.cnh,
    telefone: motorista.telefone,
    ativo: Boolean(motorista.ativo),
    caminhao_id: motorista.caminhao?.id ?? null,
    acesso_senha: 'motorista123',
  },
});
console.log('reset', reset.status, reset.json?.message || reset.json);

const dashDepois = await api('/dashboard?dias=30', { token: admin.token });
console.log('pedidos_senha depois', dashDepois.json?.pedidos_senha);

await page.reload({ waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(2200);
await shot(page, 'gfc70-painel-sem-pedido.png');

// Erro PT no Expo: senha errada no login
await clearSession(page);
await page.waitForTimeout(500);
const loginInput = page.getByPlaceholder(/CPF|e-mail|email/i).first();
const senhaInput = page.locator('input[type="password"]').first();
await loginInput.fill('admin@frota.com');
await senhaInput.fill('errada');
await page.getByText('Entrar', { exact: true }).last().click();
await page.waitForTimeout(1500);
await shot(page, 'gfc70-login-erro-pt.png');

// Validação API em português (sem senha)
const val = await api('/login', { metodo: 'POST', corpo: { login: 'x' } });
console.log('validacao_pt', val.status, JSON.stringify(val.json));
fs.writeFileSync(
  path.join(OUT, 'gfc70-validacao-pt.json'),
  JSON.stringify({ status: val.status, body: val.json }, null, 2),
  'utf8'
);

await browser.close();
console.log('done');
