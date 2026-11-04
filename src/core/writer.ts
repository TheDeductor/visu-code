import fs from 'node:fs';
import path from 'node:path';
import type { ApplyOpsResult, JournalEntry, LockFile, MapLayoutSidecar, NodeStatus, PatchOp, VibeMap } from './types.js';
import type { Project } from './project.js';
import { readLocks } from './project.js';
import { applyOpsToContent, structuralIssues } from './ops.js';
import { MapSchema } from './schema.js';
import { recordJournal } from './journal.js';
import { mapFileFromId } from './paths.js';
import { documentToString, parseYamlText, readText, sha1, writeFileAtomic } from './yaml.js';
import { lockKey, nodeLockHash } from './locks.js';
import { RevisionConflictError } from './ops.js';

export interface ApplyOpsFileOptions {
  origin?: 'human' | 'agent' | string;
  baseRev?: string;
  newNodeStatus?: NodeStatus;
  summary?: string;
}

export interface ApplyOpsFileResult extends ApplyOpsResult {
  rev: string;
  journal: JournalEntry;
  renamed: Array<{ from: string; to: string }>;
}

export function mapPath(project: Project, mapId: string): string {
  return path.join(project.root, mapFileFromId(mapId));
}

export function readMapContent(project: Project, mapId: string): { content: string; rev: string } {
  const content = readText(mapPath(project, mapId));
  return { content, rev: sha1(content) };
}

export async function applyOpsToFile(
  project: Project,
  mapId: string,
  ops: PatchOp[],
  options: ApplyOpsFileOptions = {},
): Promise<ApplyOpsFileResult> {
  const file = mapFileFromId(mapId);
  const content = readText(mapPath(project, mapId));
  const rev = sha1(content);
  if (options.baseRev && options.baseRev !== rev) {
    throw new RevisionConflictError(rev, content);
  }
  const origin = options.origin ?? 'agent';
  const beforeParsed = parseYamlText(content, file);
  const beforeMap = beforeParsed.data as VibeMap;
  const locks = readLocks(project);
  const result = applyOpsToContent(content, file, mapId, ops, {
    origin,
    enforceLocks: origin !== 'human',
    locks,
    newNodeStatus: options.newNodeStatus,
  });
  if (result.content === content) {
    const journal = await recordJournal(project, mapId, content, origin, options.summary ?? result.journalSummary);
    return { ...result, rev, journal };
  }
  await writeFileAtomic(mapPath(project, mapId), result.content);
  const nextRev = sha1(result.content);
  const journal = await recordJournal(project, mapId, result.content, origin, options.summary ?? result.journalSummary);
  updateLocksAfterWrite(project, mapId, beforeMap, result.map, result.renamed, origin, locks, result.changedNodeIds);
  return { ...result, rev: nextRev, journal };
}

function updateLocksAfterWrite(
  project: Project,
  mapId: string,
  before: VibeMap,
  after: VibeMap,
  renamed: Array<{ from: string; to: string }>,
  origin: string,
  locks: LockFile,
  changedNodeIds: string[],
): void {
  if (origin !== 'human') return;
  let changed = false;
  const changedSet = new Set(changedNodeIds);
  const beforeNodes = new Map(before.type === 'graph' ? before.nodes.map((n) => [n.id, n]) : []);
  const afterNodes = new Map(after.type === 'graph' ? after.nodes.map((n) => [n.id, n]) : []);
  for (const rename of renamed) {
    const oldKey = lockKey(mapId, rename.from);
    const newKey = lockKey(mapId, rename.to);
    if (locks.locks[oldKey]) {
      delete locks.locks[oldKey];
      const node = afterNodes.get(rename.to);
      if (node) locks.locks[newKey] = nodeLockHash(node);
      else delete locks.locks[newKey];
      changed = true;
    }
  }
  for (const [id, node] of afterNodes) {
    const existed = beforeNodes.has(id);
    if (!existed || !changedSet.has(id)) continue;
    if (project.config.editing.autoLockHumanEdits) {
      const key = lockKey(mapId, id);
      const hash = nodeLockHash(node);
      if (locks.locks[key] !== hash) {
        locks.locks[key] = hash;
        changed = true;
      }
    }
  }
  for (const id of beforeNodes.keys()) {
    if (!afterNodes.has(id)) {
      const key = lockKey(mapId, id);
      if (locks.locks[key]) {
        delete locks.locks[key];
        changed = true;
      }
    }
  }
  // Map deletion/pruning for renamed lock keys is also covered above.
  if (changed) {
    writeLocksFile(project, locks);
  }
}

function writeLocksFile(project: Project, locks: LockFile): void {
  fs.mkdirSync(path.dirname(project.locksPath), { recursive: true });
  const tmp = `${project.locksPath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(locks, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, project.locksPath);
}

/** Validate and write arbitrary map content (restore, external tooling, tests). */
export async function writeMapContent(
  project: Project,
  mapId: string,
  content: string,
  origin: string,
  summary: string,
): Promise<{ rev: string; map: VibeMap; content: string; journal: JournalEntry }> {
  const file = mapFileFromId(mapId);
  const parsed = parseYamlText(content, file);
  const result = MapSchema.safeParse(parsed.data);
  if (!result.success) {
    throw new Error(`Refusing to write invalid map: ${result.error.issues[0]?.message ?? 'schema error'}`);
  }
  const map = result.data as unknown as VibeMap;
  const structural = structuralIssues(map);
  if (structural.length) throw new Error(`Refusing to write invalid map: ${structural[0]}`);
  const clean = documentToString(parsed.doc);
  await writeFileAtomic(mapPath(project, mapId), clean);
  const journal = await recordJournal(project, mapId, clean, origin, summary);
  return { rev: sha1(clean), map, content: clean, journal };
}

export async function saveLayout(project: Project, mapId: string, layout: MapLayoutSidecar): Promise<void> {
  const file = path.join(project.root, '.vibemap', 'layouts', `${mapId}.layout.json`);
  await writeFileAtomic(file, `${JSON.stringify(layout, null, 2)}\n`);
}

export async function pruneSidecar(project: Project, mapId: string, map: VibeMap): Promise<boolean> {
  if (map.type !== 'graph') return false;
  const file = path.join(project.root, '.vibemap', 'layouts', `${mapId}.layout.json`);
  if (!fs.existsSync(file)) return false;
  try {
    const raw = JSON.parse(readText(file)) as MapLayoutSidecar;
    const known = new Set(map.nodes.map((n) => n.id));
    let changed = false;
    for (const id of Object.keys(raw.nodes ?? {})) {
      if (!known.has(id)) {
        delete raw.nodes[id];
        changed = true;
      }
    }
    if (changed) {
      await writeFileAtomic(file, `${JSON.stringify(raw, null, 2)}\n`);
    }
    return changed;
  } catch {
    return false;
  }
}
