import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright';
import { startServer, type RunningServer } from '../../src/server/server.js';

describe('Playwright canvas fit & zoom test', () => {
  let server: RunningServer;
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    fs.mkdirSync('.tmp', { recursive: true });
    const staticDir = path.join(process.cwd(), 'dist', 'web');
    server = await startServer({ root: process.cwd(), port: 0, quiet: true, staticDir });
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      localStorage.setItem('vibemap:tour-done', '1');
    });
    page = await context.newPage();
    await page.goto(server.url, { waitUntil: 'networkidle' });
  });

  afterAll(async () => {
    await browser?.close();
    await server?.close();
  });

  it('renders 00-overview with initial zoom >= 0.7', async () => {
    await page.getByRole('treeitem', { name: /00-overview/i }).click();
    await page.waitForTimeout(600);
    await page.locator('.zoom-label').waitFor({ state: 'visible' });

    const zoomText = await page.locator('.zoom-label').innerText();
    const zoomVal = parseInt(zoomText.replace('%', ''), 10) / 100;
    expect(zoomVal).toBeGreaterThanOrEqual(0.7);

    await page.screenshot({ path: '.tmp/00-overview.png' });
  });

  it('renders agent-workflow with initial zoom >= 0.7', async () => {
    await page.getByRole('treeitem', { name: /agent-workflow/i }).click();
    await page.waitForTimeout(600);
    await page.locator('.zoom-label').waitFor({ state: 'visible' });

    const zoomText = await page.locator('.zoom-label').innerText();
    const zoomVal = parseInt(zoomText.replace('%', ''), 10) / 100;
    expect(zoomVal).toBeGreaterThanOrEqual(0.7);

    await page.screenshot({ path: '.tmp/agent-workflow.png' });
  });
});
