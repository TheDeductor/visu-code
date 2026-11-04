import fs from 'node:fs';
import path from 'node:path';
import type { ChangeDelta, MapType, VibeMap } from './types.js';
import { SCHEMA_VERSION } from './types.js';
import type { Project } from './project.js';
import { loadMap } from './maps.js';
import { listJournal, journalPointAt } from './journal.js';
import { diffMaps } from './diff.js';
import { readJsonFile, sha1, writeFileAtomic } from './yaml.js';
import { mapFileFromId } from './paths.js';

interface BaselineFile {
  schema: number;
  baselines: Record<string, { rev: string; ts: string; type: MapType }>;
}

export function baselinePath(project: Project): string {
  return path.join(project.vibemapDir, '.cache', 'change-baseline.json');
}

function readBaselines(project: Project): BaselineFile {
  const raw = readJsonFile<BaselineFile>(baselinePath(project));
  return raw && raw.schema === SCHEMA_VERSION ? raw : { schema: SCHEMA_VERSION, baselines: {} };
}

export async function setBaseline(project: Project, mapId: string, rev: string, type: MapType): Promise<void> {
  const data = readBaselines(project);
  data.baselines[mapId] = { rev, ts: new Date().toISOString(), type };
  await writeFileAtomic(baselinePath(project), `${JSON.stringify(data, null, 2)}\n`);
}

export async function ensureBaselines(project: Project): Promise<void> {
  const data = readBaselines(project);
  let changed = false;
  const mapsDir = path.join(project.vibemapDir, 'maps');
  if (!fs.existsSync(mapsDir)) return;
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile() && entry.name.endsWith('.vmap.yaml')) {
        const rel = path.relative(project.root, abs).replace(/\\/g, '/');
        const id = rel.replace(/^\.vibemap\/maps\//, '').replace(/\.vmap\.yaml$/, '');
        if (data.baselines[id]) continue;
        try {
          const content = fs.readFileSync(abs, 'utf8');
          const loaded = loadMap(project, id);
          data.baselines[id] = { rev: sha1(content), ts: new Date().toISOString(), type: loaded.map.type };
          changed = true;
        } catch {
          // Invalid maps are not baselined.
        }
      }
    }
  };
  walk(mapsDir);
  if (changed) await writeFileAtomic(baselinePath(project), `${JSON.stringify(data, null, 2)}\n`);
}

function emptyMap(type: MapType, title: string): VibeMap {
  const base = { schema: SCHEMA_VERSION as 1, title, type };
  if (type === 'graph') return { ...base, type: 'graph', nodes: [], edges: [], groups: [] };
  if (type === 'sequence') return { ...base, type: 'sequence', participants: [], steps: [] };
  if (type === 'erd') return { ...base, type: 'erd', entities: [], relations: [] };
  return { ...base, type: 'mermaid', source: 'graph TD\n' };
}

export interface ChangeDeltaResult {
  delta: ChangeDelta;
  bases: Record<string, string>;
}

export async function computeChangeDelta(project: Project, mapIds: string[]): Promise<ChangeDeltaResult> {
  const delta: ChangeDelta = { added_nodes: [], modified_nodes: [], removed_nodes: [], added_edges: 0, removed_edges: 0 };
  const bases: Record<string, string> = {};
  const baselines = readBaselines(project).baselines;
  for (const mapId of mapIds) {
    let head;
    try {
      head = loadMap(project, mapId);
    } catch {
      continue;
    }
    const baseline = baselines[mapId];
    let baseMap: VibeMap | null = null;
    if (baseline) {
      bases[mapId] = baseline.rev;
      const point = await journalPointAt(project, mapId, baseline.rev);
      if (point) {
        const { parseMapContent } = await import('./maps.js');
        const parsed = parseMapContent(point.content, mapFileFromId(mapId), mapId);
        baseMap = parsed.map ?? null;
      }
    }
    if (!baseMap) baseMap = emptyMap(head.map.type, head.map.title);
    const diff = diffMaps(mapId, baseMap, head.map, baseline?.rev ?? '', head.rev);
    delta.added_nodes.push(...diff.added.map((n) => `${mapId}#${n.id}`));
    delta.modified_nodes.push(...diff.modified.map((n) => `${mapId}#${n.id}`));
    delta.removed_nodes.push(...diff.removed.map((n) => `${mapId}#${n.id}`));
    delta.added_edges += diff.addedEdges.length;
    delta.removed_edges += diff.removedEdges.length;
  }
  return { delta, bases };
}

export async function commitBaselines(project: Project, mapIds: string[]): Promise<void> {
  for (const mapId of mapIds) {
    try {
      const loaded = loadMap(project, mapId);
      await setBaseline(project, mapId, loaded.rev, loaded.map.type);
    } catch {
      // Ignore invalid/missing maps.
    }
  }
}

export async function latestJournalBefore(project: Project, mapId: string, iso: string): Promise<string | null> {
  const entries = await listJournal(project, mapId, 100);
  return entries.find((e) => e.ts <= iso)?.rev ?? null;
}
