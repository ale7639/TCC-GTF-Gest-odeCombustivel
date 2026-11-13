import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT =
  'C:\\Users\\Daniel\\AppData\\Local\\Cursor\\AgentStores\\cursor_agent_stores\\bc-62225adc-bb2b-4d91-abbd-16a698a133cc\\files\\media\\run';
const BASE = 'http://127.0.0.1:8082';
const API = 'http://127.0.0.1:8002/api';

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await (
  await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
).newPage();

await page.goto(BASE + '?gfc70e=' + Date.now(), { waitUntil: 'networkidle', timeout: 90000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(1200);

await page.getByPlaceholder(/CPF|e-mail|email/i).first().fill('admin@frota.com');
await page.locator('input[type="password"]').first().fill('errada');
await page.getByText('Entrar', { exact: true }).last().click();
await page.waitForTimeout(1800);

const file = path.join(OUT, 'gfc70-login-erro-pt.png');
await page.screenshot({ path: file, fullPage: false });
console.log('wrote', file);

const r = await fetch(`${API}/login`, {
  method: 'POST',
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: 'x' }),
});
const j = await r.json();
fs.writeFileSync(path.join(OUT, 'gfc70-validacao-pt.json'), JSON.stringify({ status: r.status, body: j }, null, 2));
console.log('validacao', r.status, j);

await browser.close();
