import { chromium } from 'playwright';
import fs from 'node:fs';

const info = JSON.parse(fs.readFileSync('fixtures/ts-web/.vibemap/.cache/server.json', 'utf8'));
const api = async (pathname, init = {}) => {
  const response = await fetch(`${info.url}/api${pathname}`, {
    ...init,
    headers: { 'x-vibemap-token': info.token, 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  return response;
};
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
await context.addInitScript(() => localStorage.setItem('vibemap:tour-done', '1'));
const page = await context.newPage();
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
const out = {};
try {
  await page.goto(info.url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '.tmp/final-overview.png' });

  await page.getByRole('treeitem', { name: /login-flow/i }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: '.tmp/final-login.png' });

  await page.getByRole('button', { name: 'Changes', exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('listitem').filter({ hasText: 'Plan login rate limiting' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: '.tmp/final-change.png' });
  await page.getByRole('button', { name: 'View diff' }).click();
  await page.waitForTimeout(1300);
  out.diffBanner = await page.locator('.banner-diff').innerText().catch(() => '');
  out.diffSummary = await page.locator('.diff-summary').innerText().catch(() => '');
  await page.screenshot({ path: '.tmp/final-diff.png' });
  await page.getByRole('button', { name: 'Exit diff' }).click();

  await page.getByRole('button', { name: 'Timeline', exact: true }).click();
  await page.waitForTimeout(500);
  const rows = page.locator('.timeline-row');
  out.timelineRows = await rows.count();
  await rows.nth(Math.min(1, (await rows.count()) - 1)).click();
  await page.waitForTimeout(1200);
  out.historyBanner = await page.locator('.banner-info').innerText().catch(() => '');
  await page.screenshot({ path: '.tmp/final-history.png' });
  await page.getByRole('button', { name: 'Back to now' }).click();

  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.waitForTimeout(500);
  await page.locator('.note-row').first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: '.tmp/final-note.png' });
  await page.locator('.note-detail').getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = page.locator('textarea.note-editor');
  const currentNote = await editor.inputValue();
  if (!currentNote.includes('Verified in the local viewer.')) await editor.fill(`${currentNote}\n\nVerified in the local viewer.`);
  await page.locator('.note-detail').getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForTimeout(700);
  out.noteSaved = await page.locator('.note-detail').innerText();

  await page.getByRole('button', { name: 'Phases', exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '.tmp/final-phases.png' });

  await page.getByRole('button', { name: 'Maps', exact: true }).click();
  await page.waitForTimeout(400);
  await page.locator('g.vm-node[aria-label*="POST /api/login"]').click({ position: { x: 40, y: 20 } });
  await page.locator('.topbar').getByRole('button', { name: 'Edit', exact: true }).click();
  await page.waitForTimeout(200);
  const exportButton = page.locator('.topbar button[aria-label="Export menu"]').first();
  if (await exportButton.count()) {
    await exportButton.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: '.tmp/final-export-menu.png' });
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    await page.getByRole('button', { name: 'Export SVG' }).click();
    const download = await downloadPromise;
    out.download = download ? download.suggestedFilename() : null;
  }

  console.log(JSON.stringify({ errors, ...out }, null, 2));
} finally {
  try {
    const detail = (await (await api('/maps/auth/login-flow')).json());
    if (detail.locked?.['auth-api']) await api('/locks', { method: 'POST', body: JSON.stringify({ map: 'auth/login-flow', node: 'auth-api', locked: false }) });
  } catch (err) {
    console.error('cleanup', err.message);
  }
  await browser.close();
}
