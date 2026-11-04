import type { LockFile, VibeNode } from './types.js';
import { SCHEMA_VERSION } from './types.js';
import type { Project } from './project.js';
import { readLocks } from './project.js';
import { hashObject, writeFileAtomicSync } from './yaml.js';

export function lockKey(mapId: string, nodeId: string): string {
  return `${mapId}#${nodeId}`;
}

export function parseLockKey(key: string): { map: string; node: string } | null {
  const index = key.indexOf('#');
  if (index <= 0 || index === key.length - 1) return null;
  return { map: key.slice(0, index), node: key.slice(index + 1) };
}

/** Hash only the semantic node content; tool-computed/layout data is never part of locks. */
export function nodeLockHash(node: VibeNode): string {
  const semantic = {
    id: node.id,
    label: node.label,
    kind: node.kind,
    group: node.group,
    status: node.status,
    description: node.description,
    plain: node.plain,
    refs: node.refs,
    tags: node.tags,
    phase: node.phase,
    drill: node.drill,
  };
  return hashObject(semantic);
}

export function isNodeLocked(locks: LockFile, mapId: string, nodeId: string): boolean {
  return Boolean(locks.locks[lockKey(mapId, nodeId)]);
}

export function lockNode(project: Project, mapId: string, node: VibeNode): LockFile {
  const locks = readLocks(project);
  locks.locks[lockKey(mapId, node.id)] = nodeLockHash(node);
  writeFileAtomicSync(project.locksPath, `${JSON.stringify(locks, null, 2)}\n`);
  return locks;
}

export function unlockNode(project: Project, mapId: string, nodeId: string): LockFile {
  const locks = readLocks(project);
  delete locks.locks[lockKey(mapId, nodeId)];
  writeFileAtomicSync(project.locksPath, `${JSON.stringify(locks, null, 2)}\n`);
  return locks;
}

export function lockStatus(locks: LockFile, mapId: string, node: VibeNode): 'none' | 'locked' | 'modified' {
  const hash = locks.locks[lockKey(mapId, node.id)];
  if (!hash) return 'none';
  return hash === nodeLockHash(node) ? 'locked' : 'modified';
}

export function lockCount(locks: LockFile): number {
  return Object.keys(locks.locks).length;
}

export function emptyLocks(): LockFile {
  return { schema: SCHEMA_VERSION, locks: {} };
}
