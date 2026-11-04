import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadProject, readLocks, readPhases, listMapIds, type Project } from './project.js';
import { loadFacts } from './scanner.js';
import { mapFileFromId } from './paths.js';

export interface DoctorCheck {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
  fix?: string;
}

export function doctorProject(root: string): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  checks.push({
    name: 'Node.js',
    status: nodeMajor >= 20 ? 'ok' : 'fail',
    detail: `v${process.versions.node}${nodeMajor >= 20 ? '' : ' (need >= 20)'}`,
  });
  let project: Project;
  try {
    project = loadProject(root);
    checks.push({ name: 'Project', status: 'ok', detail: `${project.root} (.vibemap/config.yaml)` });
  } catch (err) {
    checks.push({ name: 'Project', status: 'fail', detail: (err as Error).message, fix: 'Run `vibemap init`.' });
    return checks;
  }
  try {
    readPhases(project);
    checks.push({ name: 'phases.yaml', status: 'ok', detail: 'valid' });
  } catch (err) {
    checks.push({ name: 'phases.yaml', status: 'fail', detail: (err as Error).message });
  }
  try {
    const locks = readLocks(project);
    checks.push({ name: 'locks.json', status: 'ok', detail: `${Object.keys(locks.locks).length} locked node(s)` });
  } catch (err) {
    checks.push({ name: 'locks.json', status: 'fail', detail: (err as Error).message });
  }
  const maps = listMapIds(project);
  checks.push({ name: 'Maps', status: maps.length ? 'ok' : 'warn', detail: `${maps.length} map(s)`, fix: maps.length ? undefined : 'Run `vibemap bootstrap`.' });
  const facts = loadFacts(project);
  checks.push({
    name: 'Scanner cache',
    status: facts ? 'ok' : 'warn',
    detail: facts ? `${facts.files.length} files, generated ${facts.generatedAt}` : 'facts.json missing',
    fix: facts ? undefined : 'Run `vibemap scan`.',
  });
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: project.root, stdio: 'ignore' });
    checks.push({ name: 'Git', status: 'ok', detail: 'repository detected (history available)' });
  } catch {
    checks.push({ name: 'Git', status: 'warn', detail: 'not a git repository — journal-only history' });
  }
  const cache = path.join(project.vibemapDir, '.cache');
  try {
    fs.mkdirSync(cache, { recursive: true });
    const probe = path.join(cache, '.doctor-write-test');
    fs.writeFileSync(probe, 'ok');
    fs.rmSync(probe, { force: true });
    checks.push({ name: 'Writable cache', status: 'ok', detail: '.vibemap/.cache is writable' });
  } catch {
    checks.push({ name: 'Writable cache', status: 'fail', detail: 'cannot write to .vibemap/.cache' });
  }
  const configured = project.config.agents;
  const expected: Array<[string, string]> = [
    ['claude-code', 'CLAUDE.md'],
    ['cursor', '.cursor/rules/vibemap.mdc'],
    ['codex', 'AGENTS.md'],
    ['copilot', '.github/copilot-instructions.md'],
    ['gemini', 'GEMINI.md'],
    ['windsurf', '.windsurf/rules/vibemap.md'],
    ['aider', 'CONVENTIONS.md'],
  ];
  for (const agent of configured) {
    const pair = expected.find(([name]) => name === agent);
    if (!pair) continue;
    const exists = fs.existsSync(path.join(project.root, pair[1]));
    checks.push({
      name: `Agent: ${agent}`,
      status: exists ? 'ok' : 'warn',
      detail: exists ? pair[1] : `${pair[1]} missing`,
      fix: exists ? undefined : `vibemap agents sync`,
    });
  }
  const guide = path.join(project.vibemapDir, 'AGENT_GUIDE.md');
  checks.push({
    name: 'Agent guide',
    status: fs.existsSync(guide) ? 'ok' : 'fail',
    detail: fs.existsSync(guide) ? '.vibemap/AGENT_GUIDE.md' : 'missing',
    fix: fs.existsSync(guide) ? undefined : 'vibemap agents sync',
  });
  const hook = path.join(project.root, '.git/hooks/pre-commit');
  if (fs.existsSync(hook)) {
    const content = fs.readFileSync(hook, 'utf8');
    checks.push({ name: 'Git hook', status: content.includes('vibemap') ? 'ok' : 'warn', detail: content.includes('vibemap') ? 'pre-commit installed' : 'foreign pre-commit hook' });
  }
  const viewer = path.join(project.root, 'dist', 'web', 'index.html');
  checks.push({ name: 'Viewer assets', status: fs.existsSync(viewer) ? 'ok' : 'warn', detail: fs.existsSync(viewer) ? 'dist/web present' : 'viewer not built (source checkout only)' });
  return checks;
}

export function formatDoctor(checks: DoctorCheck[]): string {
  const icon = { ok: '✓', warn: '⚠', fail: '✖' };
  return checks.map((c) => `${icon[c.status]} ${c.name}: ${c.detail}${c.fix ? `\n    fix: ${c.fix}` : ''}`).join('\n');
}

export function doctorExitCode(checks: DoctorCheck[]): number {
  return checks.some((c) => c.status === 'fail') ? 3 : 0;
}

export function migrateProject(root: string, dryRun: boolean): { changed: string[]; skipped: string[] } {
  const project = loadProject(root);
  const changed: string[] = [];
  const skipped: string[] = [];
  for (const id of listMapIds(project)) {
    const file = mapFileFromId(id);
    const abs = path.join(project.root, file);
    const text = fs.readFileSync(abs, 'utf8');
    const current = text.match(/^schema:\s*(\d+)\s*$/m)?.[1];
    if (current === '1') {
      skipped.push(file);
      continue;
    }
    if (!current) {
      if (!dryRun) fs.writeFileSync(abs, `schema: 1\n${text}`, 'utf8');
      changed.push(file);
    } else {
      skipped.push(`${file} (schema ${current}; no automatic migration available)`);
    }
  }
  return { changed, skipped };
}
