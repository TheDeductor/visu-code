import { chromium } from 'playwright';
import fs from 'node:fs';
const info = JSON.parse(fs.readFileSync('fixtures/ts-web/.vibemap/.cache/server.json', 'utf8'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => localStorage.setItem('vibemap:tour-done', '1'));
const page = await context.newPage();
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(err.message));
await page.goto(info.url, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.getByRole('treeitem', { name: /login-flow/i }).click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: 'Changes', exact: true }).click();
await page.waitForTimeout(500);
await page.getByRole('listitem').filter({ hasText: 'Plan login rate limiting' }).click();
await page.waitForTimeout(300);
console.log('CARDS', await page.locator('.change-card').allInnerTexts());
await page.getByRole('button', { name: 'View diff' }).click();
await page.waitForTimeout(1600);
console.log(JSON.stringify({
  errors,
  toasts: await page.locator('.toast').allInnerTexts().catch(() => []),
  banners: await page.locator('.banner').allInnerTexts().catch(() => []),
  diffSummary: await page.locator('.diff-summary').innerText().catch(() => ''),
  bodyHasExit: (await page.locator('body').innerText()).includes('Exit diff'),
  url: page.url(),
}, null, 2));
await page.screenshot({ path: '.tmp/debug-diff.png' });
await browser.close();
