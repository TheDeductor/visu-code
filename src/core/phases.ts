import { execFileSync } from 'node:child_process';
import type { Phase, PhasesFile } from './types.js';
import { SCHEMA_VERSION } from './types.js';
import type { Project } from './project.js';
import { readPhases, writePhases } from './project.js';
import { latestJournal } from './journal.js';
import { listMapIds } from './project.js';
import { loadMap } from './maps.js';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function gitHead(project: Project): string | null {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: project.root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

export async function addPhase(project: Project, title: string, goal?: string): Promise<Phase> {
  const phases = readPhases(project);
  const id = phaseId(title, phases.phases);
  const phase: Phase = { id, title, ...(goal ? { goal } : {}), status: 'planned' };
  phases.phases.push(phase);
  await writePhases(project, phases);
  return phase;
}

function phaseId(title: string, existing: Phase[]): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'phase';
  let id = base;
  let n = 2;
  while (existing.some((p) => p.id === id)) id = `${base}-${n++}`;
  return id;
}

export async function startPhase(project: Project, id: string): Promise<Phase> {
  const phases = readPhases(project);
  const phase = phases.phases.find((p) => p.id === id);
  if (!phase) throw new Error(`Unknown phase "${id}".`);
  if (phase.status === 'done') throw new Error(`Phase "${id}" is already done.`);
  for (const other of phases.phases) if (other.status === 'active' && other.id !== id) other.status = 'planned';
  phase.status = 'active';
  phase.started = phase.started ?? today();
  await writePhases(project, phases);
  return phase;
}

export async function finishPhase(project: Project, id: string): Promise<Phase> {
  const phases = readPhases(project);
  const phase = phases.phases.find((p) => p.id === id);
  if (!phase) throw new Error(`Unknown phase "${id}".`);
  phase.status = 'done';
  phase.finished = today();
  const head = gitHead(project);
  if (head) phase.snapshot = head;
  else {
    const latest = await latestJournal(project);
    if (latest) phase.snapshot = latest.id;
  }
  await writePhases(project, phases);
  return phase;
}

export function phaseProgress(project: Project): Array<Phase & { planned: number; built: number; total: number }> {
  const phases = readPhases(project).phases;
  const counts = new Map<string, { planned: number; built: number; total: number }>();
  for (const phase of phases) counts.set(phase.id, { planned: 0, built: 0, total: 0 });
  const ids = listMapIds(project);
  for (const mapId of ids) {
    try {
      const loaded = loadMap(project, mapId);
      if (loaded.map.type !== 'graph') continue;
      for (const node of loaded.map.nodes) {
        const owner = node.phase ?? loaded.map.phase;
        if (!owner || !counts.has(owner)) continue;
        const c = counts.get(owner)!;
        c.total++;
        if (node.status === 'planned') c.planned++;
        else c.built++;
      }
    } catch {
      // skip invalid maps
    }
  }
  return phases.map((phase) => ({ ...phase, ...(counts.get(phase.id) ?? { planned: 0, built: 0, total: 0 }) }));
}

export function emptyPhases(): PhasesFile {
  return { schema: SCHEMA_VERSION, phases: [] };
}
