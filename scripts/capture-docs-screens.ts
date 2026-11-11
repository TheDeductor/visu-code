import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { startServer } from '../src/server/server.js';

const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(process.cwd(), 'docs', 'ui', 'before');
fs.mkdirSync(targetDir, { recursive: true });

async function main() {
  const staticDir = path.join(process.cwd(), 'dist', 'web');
  const server = await startServer({ root: process.cwd(), port: 0, quiet: true, staticDir });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem('vibemap:tour-done', '1');
  });
  const page = await context.newPage();
  await page.goto(server.url, { waitUntil: 'networkidle' });

  async function switchTheme(mode: 'light' | 'dark') {
    await page.evaluate((m) => {
      window.dispatchEvent(new CustomEvent('vibemap:theme-change', { detail: m }));
    }, mode);
    await page.emulateMedia({ colorScheme: mode });
    await page.waitForTimeout(400);
  }

  // Ensure default is light
  await switchTheme('light');

  // 1. Select Maps view, map diagram-pipeline
  await page.getByRole('button', { name: /^maps$/i }).click();
  await page.getByRole('treeitem', { name: /diagram-pipeline/i }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(targetDir, 'maps-diagram-pipeline-light.png') });

  await switchTheme('dark');
  await page.screenshot({ path: path.join(targetDir, 'maps-diagram-pipeline-dark.png') });
  await switchTheme('light');

  // 2. Select Coverage
  await page.getByRole('button', { name: /^coverage$/i }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(targetDir, 'coverage-light.png') });

  await switchTheme('dark');
  await page.screenshot({ path: path.join(targetDir, 'coverage-dark.png') });
  await switchTheme('light');

  // 3. Select Changes
  await page.getByRole('button', { name: /^changes$/i }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(targetDir, 'changes-light.png') });

  await switchTheme('dark');
  await page.screenshot({ path: path.join(targetDir, 'changes-dark.png') });
  await switchTheme('light');

  await browser.close();
  await server.close();
  console.log(`Saved screenshots to ${targetDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

