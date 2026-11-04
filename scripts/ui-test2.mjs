import { chromium } from 'playwright';
import fs from 'node:fs';

const projectDir = 'fixtures/ts-web';
const info = JSON.parse(fs.readFileSync(`${projectDir}/.vibemap/.cache/server.json`, 'utf8'));
const api = async (pathname, init = {}) => {
  const response = await fetch(`${info.url}/api${pathname}`, {
    ...init,
    headers: { 'x-vibemap-token': info.token, 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json();
};
let addedId = null;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => localStorage.setItem('vibemap:tour-done', '1'));
const page = await context.newPage();
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
try {
  await page.goto(info.url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.getByRole('treeitem', { name: /login-flow/i }).click();
  await page.waitForTimeout(700);
  const node = page.locator('g.vm-node[aria-label*="POST /api/login"]');
  await node.click({ position: { x: 40, y: 20 } });
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.waitForTimeout(300);

  const label = page.locator('.inspector input').first();
  await label.fill('POST /api/signin');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.waitForTimeout(900);
  const locked = JSON.parse(fs.readFileSync(`${projectDir}/.vibemap/locks.json`, 'utf8'));
  const yaml = fs.readFileSync(`${projectDir}/.vibemap/maps/auth/login-flow.vmap.yaml`, 'utf8');

  await page.getByRole('button', { name: '+ Node' }).click();
  const modal = page.locator('.modal');
  await modal.getByLabel('Label').fill('Rate limiter');
  await modal.getByRole('button', { name: 'Add node' }).click();
  await page.waitForTimeout(1000);
  const mapAfterAdd = await api('/maps/auth/login-flow');
  const added = mapAfterAdd.map.nodes.find((n) => n.label === 'Rate limiter');
  addedId = added?.id ?? null;
  const count = mapAfterAdd.map.nodes.length;
  await page.screenshot({ path: '.tmp/viewer-addnode.png' });

  await page.getByRole('button', { name: 'Changes', exact: true }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: '.tmp/viewer-changes.png' });
  const changesText = await page.locator('.change-detail').innerText().catch(() => '');

  await page.getByRole('button', { name: 'Coverage', exact: true }).click();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: '.tmp/viewer-coverage.png' });

  await page.getByRole('button', { name: 'Timeline', exact: true }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: '.tmp/viewer-timeline.png' });

  console.log(JSON.stringify({ errors, lockedKeys: Object.keys(locked.locks), hasLabel: yaml.includes('POST /api/signin'), count, addedId, changes: changesText.slice(0, 400) }, null, 2));
} finally {
  try {
    const current = await api('/maps/auth/login-flow');
    const ops = [];
    if (addedId) ops.push({ op: 'remove_node', id: addedId });
    const target = current.map.nodes.find((n) => n.id === 'auth-api');
    if (target) ops.push({ op: 'update_node', id: 'auth-api', set: { label: 'POST /api/login' } });
    if (ops.length) await api('/maps/auth/login-flow/ops', { method: 'POST', body: JSON.stringify({ ops, origin: 'human', baseRev: current.rev }) });
    for (const key of Object.keys((await api('/maps/auth/login-flow')).locked)) void key;
    const locks = await fetch(`${info.url}/api/locks`, { method: 'POST', headers: { 'x-vibemap-token': info.token, 'content-type': 'application/json' }, body: JSON.stringify({ map: 'auth/login-flow', node: 'auth-api', locked: false }) });
    if (!locks.ok) console.error('unlock failed', await locks.text());
  } catch (err) {
    console.error('cleanup failed', err.message);
  }
  await browser.close();
}
