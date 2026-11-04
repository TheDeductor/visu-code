import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { DriftReport, Facts, VibeMap } from './types.js';
import { SCHEMA_VERSION } from './types.js';
import type { Project } from './project.js';
import { loadAllMaps } from './maps.js';
import { scanProject } from './scanner.js';
import { nodeRefs } from './evidence.js';
import { isCodeLanguage, pathInScope, toPosix } from './paths.js';
import { projectPath } from './git.js';
import { readJsonFile, writeFileAtomic } from './yaml.js';

export interface PendingState {
  schema: number;
  generatedAt: string;
  files: string[];
  direct: Array<{ map: string; files: string[] }>;
  removedRefs: Array<{ map: string; node: string; path: string }>;
  unmapped: string[];
}

export function pendingPath(project: Project): string {
  return path.join(project.vibemapDir, '.cache', 'pending.json');
}

function git(project: Project, args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd: project.root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

export function readPending(project: Project): PendingState | null {
  const raw = readJsonFile<PendingState>(pendingPath(project));
  return raw && raw.schema === SCHEMA_VERSION && Array.isArray(raw.files) ? raw : null;
}

export function recordPendingEdit(project: Project, relPaths: string[]): PendingState {
  const state = readPending(project) ?? {
    schema: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    files: [],
    direct: [],
    removedRefs: [],
    unmapped: [],
  };
  const set = new Set(state.files);
  for (const rel of relPaths) {
    const clean = toPosix(rel).replace(/^\.\//, '');
    if (!clean || clean.startsWith('.vibemap/')) continue;
    set.add(clean);
  }
  state.files = [...set].sort();
  state.generatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(pendingPath(project)), { recursive: true });
  fs.writeFileSync(pendingPath(project), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  return state;
}

export function changedFiles(project: Project, opts: { since?: string; staged?: boolean } = {}): string[] {
  const out = new Set<string>();
  const add = (text: string | null): void => {
    if (!text) return;
    for (const line of text.split('\n')) {
      const clean = toPosix(line.trim());
      if (clean) out.add(clean);
    }
  };
  if (opts.staged) {
    add(git(project, ['diff', '--cached', '--name-only', '--relative']));
    return [...out].sort();
  }
  if (opts.since) {
    add(git(project, ['diff', '--name-only', '--relative', opts.since]));
    add(git(project, ['ls-files', '--others', '--exclude-standard']));
    return [...out].map((rel) => projectPath(project.root, rel)).sort();
  }
  const head = git(project, ['rev-parse', '--verify', 'HEAD']);
  if (head) add(git(project, ['diff', '--name-only', '--relative', 'HEAD']));
  else {
    add(git(project, ['diff', '--name-only', '--relative']));
    add(git(project, ['diff', '--cached', '--name-only', '--relative']));
  }
  add(git(project, ['ls-files', '--others', '--exclude-standard']));
  if (!head) {
    const status = git(project, ['status', '--porcelain', '--relative']);
    if (status) {
      for (const line of status.split('\n')) {
        if (!line.trim()) continue;
        const file = line.slice(3).trim();
        if (file) out.add(toPosix(file));
      }
    }
  }
  return [...out].map((rel) => projectPath(project.root, rel)).sort();
}

export function computeDrift(
  project: Project,
  opts: { since?: string; staged?: boolean; files?: string[] } = {},
): DriftReport {
  // Drift is always based on fresh scanner facts; otherwise brand-new files are invisible.
  const facts = scanProject(project, { full: false }).facts;
  const changed = opts.files ? [...new Set(opts.files.map((f) => toPosix(f)))].sort() : changedFiles(project, opts);
  const changedSet = new Set(changed);
  const { maps } = loadAllMaps(project);
  const directMap = new Map<string, string[]>();
  const removedRefs: DriftReport['removedRefs'] = [];
  const referenced = new Set<string>();
  for (const loaded of maps) {
    const map: VibeMap = loaded.map;
    for (const { id, refs } of nodeRefs(map)) {
      for (const ref of refs) {
        referenced.add(ref.path);
        if (changedSet.has(ref.path)) {
          const bucket = directMap.get(loaded.id) ?? [];
          bucket.push(ref.path);
          directMap.set(loaded.id, bucket);
        }
        if (!fs.existsSync(path.join(project.root, ref.path))) {
          removedRefs.push({ map: loaded.id, node: id, path: ref.path });
        }
      }
    }
  }
  // A map editing its own YAML counts as the map being updated.
  for (const [mapId, files] of directMap) {
    const mapFile = `.vibemap/maps/${mapId}.vmap.yaml`;
    if (changedSet.has(mapFile)) directMap.delete(mapId);
    else directMap.set(mapId, [...new Set(files)].sort());
  }
  const unmapped = changed.filter((file) => {
    if (!referenced.has(file)) {
      const fact = facts.files.find((f) => f.path === file);
      return !!fact && (isCodeLanguage(fact.lang) || fact.lang === 'prisma') && pathInScope(file, project.config.paths.include, project.config.paths.exclude);
    }
    return false;
  });
  const direct = [...directMap.entries()].map(([map, files]) => ({ map, files })).sort((a, b) => a.map.localeCompare(b.map));
  const report: DriftReport = {
    ok: direct.length === 0 && removedRefs.length === 0,
    changedFiles: changed,
    direct,
    unmapped,
    removedRefs,
    generatedAt: new Date().toISOString(),
  };
  const state: PendingState = {
    schema: SCHEMA_VERSION,
    generatedAt: report.generatedAt,
    files: changed,
    direct: report.direct,
    removedRefs: report.removedRefs,
    unmapped,
  };
  fs.mkdirSync(path.dirname(pendingPath(project)), { recursive: true });
  fs.writeFileSync(pendingPath(project), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  return report;
}

export function pendingDriftWarnings(project: Project, maps: Array<{ id: string; map: VibeMap }>): Array<{ map: string; files: string[] }> {
  const pending = readPending(project);
  if (!pending) return [];
  const changed = new Set(pending.files);
  const out: Array<{ map: string; files: string[] }> = [];
  for (const loaded of maps) {
    const files: string[] = [];
    for (const { refs } of nodeRefs(loaded.map)) {
      for (const ref of refs) if (changed.has(ref.path)) files.push(ref.path);
    }
    if (files.length) out.push({ map: loaded.id, files: [...new Set(files)].sort() });
  }
  return out;
}

export async function writePendingAsync(project: Project, state: PendingState): Promise<void> {
  await writeFileAtomic(pendingPath(project), `${JSON.stringify(state, null, 2)}\n`);
}

export function driftSummary(report: DriftReport): string {
  if (!report.ok && report.direct.length === 0) {
    return `${report.removedRefs.length} broken refs`;
  }
  const parts: string[] = [];
  if (report.direct.length) parts.push(`${report.direct.length} map${report.direct.length === 1 ? '' : 's'} with direct drift`);
  if (report.unmapped.length) parts.push(`${report.unmapped.length} unmapped changed file${report.unmapped.length === 1 ? '' : 's'}`);
  if (report.removedRefs.length) parts.push(`${report.removedRefs.length} broken ref${report.removedRefs.length === 1 ? '' : 's'}`);
  return parts.length ? parts.join(', ') : 'no drift';
}
