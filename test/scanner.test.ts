import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { Project } from '../src/core/project.js';
import { loadProject } from '../src/core/project.js';
import { scanProject, loadFacts, ensureFacts } from '../src/core/scanner.js';
import { computeDrift, pendingPath } from '../src/core/drift.js';
import { listHistory, mapAtRev, gitShow } from '../src/core/history.js';
import { computeCoverage } from '../src/core/suggest.js';
import { applyOpsToFile } from '../src/core/writer.js';
import { makeLoginMap, makeProject, gitCommit, gitInit } from './helpers.js';

let root = '';
let project: Project;
let cleanup: () => void;

beforeEach(async () => {
  const made = await makeProject();
  root = made.root;
  project = made.project;
  cleanup = made.cleanup;
});

afterEach(() => cleanup?.());

describe('scanner', () => {
  it('extracts routes, models, symbols, env names, deps and entrypoints', () => {
    const facts = ensureFacts(project);
    expect(facts.routes.some((route) => route.method === 'POST' && route.path === '/api/login')).toBe(true);
    expect(facts.models.map((model) => model.name)).toEqual(expect.arrayContaining(['User', 'Note']));
    expect(facts.files.find((file) => file.path === 'src/routes/auth.ts')?.symbols.some((symbol) => symbol.name === 'loginHandler')).toBe(true);
    expect(facts.env.map((env) => env.name)).toEqual(expect.arrayContaining(['DATABASE_URL', 'NODE_ENV']));
    expect(facts.deps.some((dep) => dep.name === 'express')).toBe(true);
    expect(facts.entrypoints).toContain('src/server.ts');
  });

  it('never reads secret-like files but inventories them', () => {
    const facts = ensureFacts(project);
    const secret = facts.files.find((file) => file.path === '.env');
    expect(secret?.secret).toBe(true);
    expect(secret?.hash).toBe('');
    expect(JSON.stringify(facts)).not.toContain('secret-not-read');
  });

  it('reuses cached parse results incrementally', () => {
    const first = scanProject(project, { full: true });
    const second = scanProject(project);
    expect(first.stats.parsed).toBeGreaterThan(0);
    expect(second.stats.reused).toBeGreaterThan(0);
    expect(second.stats.parsed).toBe(0);
  });

  it('parses changed files again', () => {
    scanProject(project, { full: true });
    const file = path.join(root, 'src', 'routes', 'notes.ts');
    fs.writeFileSync(file, `export function listNotes() { return []; }\n`);
    const stats = scanProject(project);
    expect(stats.stats.parsed).toBeGreaterThan(0);
  });
});

describe('drift', () => {
  it('finds direct drift, unmapped changes and broken refs', async () => {
    await makeLoginMap(project);
    gitInit(root);
    fs.appendFileSync(path.join(root, 'src/routes/auth.ts'), '\n// changed\n');
    let report = computeDrift(project);
    expect(report.direct.map((item) => item.map)).toContain('auth/login-flow');
    expect(fs.existsSync(pendingPath(loadProject(root)))).toBe(true);

    fs.writeFileSync(path.join(root, 'src/unmapped.ts'), 'export const x = 1;\n');
    report = computeDrift(project);
    expect(report.unmapped).toContain('src/unmapped.ts');

    fs.rmSync(path.join(root, 'src/routes/auth.ts'));
    report = computeDrift(project);
    expect(report.removedRefs.some((ref) => ref.map === 'auth/login-flow' && ref.path === 'src/routes/auth.ts')).toBe(true);
  });

  it('reports a map as up to date when its yaml changed too', async () => {
    await makeLoginMap(project);
    gitInit(root);
    fs.appendFileSync(path.join(root, 'src/routes/auth.ts'), '\n// changed\n');
    await applyOpsToFile(project, 'auth/login-flow', [{ op: 'update_node', id: 'auth-api', set: { description: 'updated' } }], { origin: 'agent' });
    const report = computeDrift(project);
    expect(report.direct.some((item) => item.map === 'auth/login-flow')).toBe(false);
  });
});

describe('history', () => {
  it('reads committed map versions and builds a timeline', async () => {
    await makeLoginMap(project);
    gitInit(root);
    const { execFileSync } = await import('node:child_process');
    const sha1 = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    await applyOpsToFile(project, 'auth/login-flow', [{ op: 'update_node', id: 'auth-api', set: { label: 'POST /api/login-v2' } }], { origin: 'agent' });
    gitCommit(root, 'maps v2');
    const history = await listHistory(project, 'auth/login-flow');
    expect(history.some((point) => point.kind === 'git')).toBe(true);
    expect(history.some((point) => point.kind === 'journal')).toBe(true);
    const at = await mapAtRev(project, 'auth/login-flow', sha1);
    expect(at?.content).toContain('POST /api/login');
    expect(at?.content).not.toContain('login-v2');
    const content = gitShow(project, 'auth/login-flow', sha1);
    expect(content).toContain('schema: 1');
  });

  it('supports a project nested inside a larger git repository', async () => {
    await makeLoginMap(project);
    const repo = fs.mkdtempSync(path.join(root, '..', 'vibemap-monorepo-'));
    const nested = path.join(repo, 'apps', 'web');
    fs.cpSync(root, nested, { recursive: true, filter: (source) => !source.includes(`${path.sep}.git`) });
    fs.rmSync(path.join(nested, '.vibemap', '.cache'), { recursive: true, force: true });
    const projectNested = loadProject(nested);
    const { execFileSync } = await import('node:child_process');
    execFileSync('git', ['init', '-q'], { cwd: repo });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repo });
    execFileSync('git', ['add', '-A'], { cwd: repo });
    execFileSync('git', ['commit', '-q', '-m', 'nested'], { cwd: repo });
    const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
    const at = await mapAtRev(projectNested, 'auth/login-flow', sha);
    expect(at?.content).toContain('Login flow');
    fs.rmSync(repo, { recursive: true, force: true });
  });
});

describe('coverage', () => {
  it('counts referenced source files', async () => {
    await makeLoginMap(project);
    const coverage = computeCoverage(loadProject(root));
    expect(coverage.totalFiles).toBeGreaterThan(0);
    expect(coverage.coveredFiles).toBeGreaterThan(0);
    expect(coverage.percent).toBeGreaterThan(0);
    expect(coverage.unmapped).toContain('src/server.ts');
  });
});
