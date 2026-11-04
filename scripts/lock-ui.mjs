import { chromium } from 'playwright';
import fs from 'node:fs';
const info = JSON.parse(fs.readFileSync('fixtures/ts-web/.vibemap/.cache/server.json', 'utf8'));
const getLocked = async () => {
  const res = await fetch(`${info.url}/api/maps/auth/login-flow`, { headers: { 'x-vibemap-token': info.token } });
  return (await res.json()).locked;
};
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => localStorage.setItem('vibemap:tour-done', '1'));
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(info.url, { waitUntil: 'networkidle' });
  await page.getByRole('treeitem', { name: /login-flow/i }).click();
  await page.waitForTimeout(700);
  await page.locator('g.vm-node[aria-label*="POST /api/login"]').click({ position: { x: 40, y: 20 } });
  await page.waitForTimeout(300);
  console.log('INSPECTOR_HAS_LOCK', (await page.locator('.inspector').innerText()).includes('Lock node'));
  await page.getByRole('button', { name: 'Lock node', exact: true }).click();
  await page.waitForTimeout(800);
  console.log('LOCKED_AFTER_LOCK', await getLocked());
  await page.screenshot({ path: '.tmp/final-locked.png' });
  await page.getByRole('button', { name: 'Unlock node', exact: true }).click();
  await page.waitForTimeout(800);
  console.log('LOCKED_AFTER_UNLOCK', await getLocked());
  console.log('ERRORS', errors);
} finally {
  const locked = await getLocked();
  if (locked?.includes('auth-api')) {
    await fetch(`${info.url}/api/locks`, { method: 'POST', headers: { 'x-vibemap-token': info.token, 'content-type': 'application/json' }, body: JSON.stringify({ map: 'auth/login-flow', node: 'auth-api', locked: false }) });
  }
  await browser.close();
}
