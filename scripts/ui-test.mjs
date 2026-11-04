import { chromium } from 'playwright';
import fs from 'node:fs';

const projectDir = 'fixtures/ts-web';
const info = JSON.parse(fs.readFileSync(`${projectDir}/.vibemap/.cache/server.json`, 'utf8'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => localStorage.setItem('vibemap:tour-done', '1'));
const page = await context.newPage();
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
await page.goto(info.url, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.getByRole('treeitem', { name: /login-flow/i }).click();
await page.waitForTimeout(800);

// Select a node
const node = page.locator('g.vm-node[aria-label*="POST /api/login"]');
await node.click({ position: { x: 40, y: 20 } });
await page.waitForTimeout(400);
const inspectorText = await page.locator('.inspector').innerText();
await page.screenshot({ path: '.tmp/viewer-selected.png' });

// Enter edit mode and drag the node
await page.getByRole('button', { name: 'Edit', exact: true }).click();
await page.waitForTimeout(300);
const box = await node.boundingBox();
if (box) {
  await page.mouse.move(box.x + 40, box.y + 25);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + 55, { steps: 10 });
  await page.mouse.up();
}
await page.waitForTimeout(900);
const layout = JSON.parse(fs.readFileSync(`${projectDir}/.vibemap/layouts/auth/login-flow.layout.json`, 'utf8'));
await page.screenshot({ path: '.tmp/viewer-edited.png' });
console.log(JSON.stringify({ errors, inspector: inspectorText.slice(0, 800), layout: layout.nodes }, null, 2));
await browser.close();
