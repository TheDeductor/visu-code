import { chromium } from 'playwright';
import fs from 'node:fs';

const info = JSON.parse(fs.readFileSync('fixtures/ts-web/.vibemap/.cache/server.json', 'utf8'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
await page.goto(info.url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await page.screenshot({ path: '.tmp/viewer-overview.png', fullPage: false });
const title = await page.title();
const text = await page.locator('body').innerText();
console.log(JSON.stringify({ title, errors, text: text.slice(0, 1200) }, null, 2));
await browser.close();
