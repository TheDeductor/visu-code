import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { startServer, type RunningServer } from '../../src/server/server.js';
import { loadProject, readLayout } from '../../src/core/project.js';
import { loadMap } from '../../src/core/maps.js';
import { renderFormat } from '../../src/core/render.js';

describe('Phase 6 screenshots and export polish', () => {
  let server: RunningServer;
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    fs.mkdirSync(path.join(process.cwd(), 'docs', 'screens'), { recursive: true });
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

  async function openAndCapture(name: string): Promise<void> {
    await page.getByRole('treeitem', { name: new RegExp(name, 'i') }).click();
    await page.waitForTimeout(600);
    await page.locator('.zoom-label').waitFor({ state: 'visible' });
    const zoomText = await page.locator('.zoom-label').innerText();
    const zoom = parseInt(zoomText.replace('%', ''), 10) / 100;
    expect(zoom, `${name} zoom`).toBeGreaterThanOrEqual(0.7);
    await page.screenshot({ path: path.join(process.cwd(), 'docs', 'screens', `${name}.png`) });
  }

  it('captures 00-overview at zoom >= 0.7', async () => {
    await openAndCapture('00-overview');
  });

  it('captures agent-workflow at zoom >= 0.7', async () => {
    await openAndCapture('agent-workflow');
  });

  it('SVG exports use label halos instead of white label boxes', () => {
    const project = loadProject(process.cwd());
    for (const id of ['00-overview', 'agent-workflow']) {
      const loaded = loadMap(project, id);
      const svg = renderFormat(loaded.map, project.theme, 'svg', undefined, readLayout(project, id), id);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
      expect(svg, `${id} halo`).toContain('paint-order="stroke"');
      expect(svg, `${id} edge label rect`).not.toContain('fill="#ffffff" fill-opacity="0.88"');
      expect(svg, `${id} step label rect`).not.toContain('rx="4" fill="#ffffff"');
    }
  });
});
