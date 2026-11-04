import { chromium } from 'playwright';
import fs from 'node:fs';
const info = JSON.parse(fs.readFileSync('fixtures/ts-web/.vibemap/.cache/server.json', 'utf8'));
const api = async (path, init = {}) => {
  const res = await fetch(`${info.url}/api${path}`, { ...init, headers: { 'x-vibemap-token': info.token, 'content-type': 'application/json', ...(init.headers ?? {}) } });
  return res;
};
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => localStorage.setItem('vibemap:tour-done', '1'));
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(info.url, { waitUntil: 'networkidle' });
  await page.getByRole('treeitem', { name: /login-flow/i }).click();
  await page.waitForTimeout(600);
  await page.locator('.topbar').getByRole('button', { name: 'Edit', exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.locator('g.vm-node[aria-label*="Login form"]').click({ position: { x: 30, y: 18 } });
  await page.locator('g.vm-node[aria-label*="Session store"]').click({ position: { x: 30, y: 18 } });
  await page.waitForTimeout(400);
  const modal = page.locator('.modal');
  console.log('MODAL', await modal.innerText());
  await modal.getByLabel('Label').fill('sets cookie');
  await modal.getByRole('button', { name: 'Add edge' }).click();
  await page.waitForTimeout(900);
  const detail = await (await api('/maps/auth/login-flow')).json();
  const added = detail.map.edges.find((e) => e.label === 'sets cookie');
  console.log(JSON.stringify({ added: added ?? null, edges: detail.map.edges.length, errors }));
  if (added) {
    await api('/maps/auth/login-flow/ops', { method: 'POST', body: JSON.stringify({ baseRev: detail.rev, origin: 'human', ops: [{ op: 'remove_edge', id: added.id }] }) });
  }
} finally {
  await browser.close();
}
