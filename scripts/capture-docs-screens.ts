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

  // 1. Select Maps view, map diagram-pipeline
  await page.getByRole('button', { name: /^maps$/i }).click();
  await page.getByRole('treeitem', { name: /diagram-pipeline/i }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(targetDir, 'maps-diagram-pipeline-light.png') });

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(targetDir, 'maps-diagram-pipeline-dark.png') });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(400);

  // 2. Select Coverage
  await page.getByRole('button', { name: /^coverage$/i }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(targetDir, 'coverage-light.png') });

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(targetDir, 'coverage-dark.png') });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(400);

  // 3. Select Changes
  await page.getByRole('button', { name: /^changes$/i }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(targetDir, 'changes-light.png') });

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(targetDir, 'changes-dark.png') });
  await page.emulateMedia({ colorScheme: 'light' });

  await browser.close();
  await server.close();
  console.log(`Saved screenshots to ${targetDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

