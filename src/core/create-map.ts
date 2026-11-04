import fs from 'node:fs';
import path from 'node:path';
import type { MapLevel, MapType, VibeMap } from './types.js';
import { SCHEMA_VERSION } from './types.js';
import type { Project } from './project.js';
import { MapSchema } from './schema.js';
import { mapFileFromId, normalizeRelPath } from './paths.js';
import { recordJournal } from './journal.js';
import { setBaseline } from './change-delta.js';
import { documentToString, parseYamlText, sha1, stringifyYaml, writeFileAtomic } from './yaml.js';

export interface CreateMapOptions {
  type?: MapType;
  title?: string;
  level?: MapLevel;
  direction?: 'right' | 'down' | 'left' | 'up';
  force?: boolean;
}

function titleFromId(id: string): string {
  const last = id.split('/').filter(Boolean).pop() ?? 'Map';
  return last.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function createMap(project: Project, idInput: string, options: CreateMapOptions = {}): Promise<{ map: VibeMap; file: string; rev: string }> {
  const id = normalizeRelPath(idInput);
  if (!/^[a-z0-9][a-z0-9/_-]*$/.test(id) || id.includes('..') || id.startsWith('/')) {
    throw new Error(`Invalid map id "${idInput}". Use lowercase kebab-case, directories separated by "/".`);
  }
  const type = options.type ?? 'graph';
  const rel = mapFileFromId(id);
  const abs = path.join(project.root, rel);
  if (fs.existsSync(abs) && !options.force) {
    throw new Error(`Map "${id}" already exists at ${rel}.`);
  }
  const level = options.level ?? (id === '00-overview' ? 'overview' : 'feature');
  const base = {
    schema: SCHEMA_VERSION,
    title: options.title ?? titleFromId(id),
    type,
    level,
    ...(type === 'graph' ? { direction: options.direction ?? 'right' } : {}),
    summary: '',
  };
  const map =
    type === 'graph'
      ? { ...base, type: 'graph' as const, groups: [], nodes: [], edges: [] }
      : type === 'sequence'
        ? { ...base, type: 'sequence' as const, participants: [], steps: [], fragments: [] }
        : type === 'erd'
          ? { ...base, type: 'erd' as const, entities: [], relations: [] }
          : { ...base, type: 'mermaid' as const, source: 'flowchart LR\n  start[Start here]\n' };
  const parsed = MapSchema.safeParse(map);
  if (!parsed.success) throw new Error(`Failed to build a valid map skeleton: ${parsed.error.issues[0]?.message ?? 'unknown'}`);
  const content = documentToString(parseYamlText(stringifyYaml(parsed.data)).doc);
  await writeFileAtomic(abs, content);
  const rev = sha1(content);
  await recordJournal(project, id, content, 'cli', `Create map ${id}`);
  await setBaseline(project, id, rev, type);
  return { map: parsed.data as unknown as VibeMap, file: rel, rev };
}
