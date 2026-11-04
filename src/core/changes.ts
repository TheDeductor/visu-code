import fs from 'node:fs';
import path from 'node:path';
import type { ChangeDelta, ChangeEntry } from './types.js';
import { SCHEMA_VERSION } from './types.js';
import type { Project } from './project.js';
import { ChangeFrontmatterSchema } from './schema.js';
import { parseYamlText, readText, stringifyYaml, writeFileAtomic } from './yaml.js';
import { slugify, toPosix } from './paths.js';

export const EMPTY_DELTA: ChangeDelta = {
  added_nodes: [],
  modified_nodes: [],
  removed_nodes: [],
  added_edges: 0,
  removed_edges: 0,
};

export function changesDir(project: Project): string {
  return path.join(project.vibemapDir, 'changes');
}

export function listChangeFiles(project: Project): string[] {
  const dir = changesDir(project);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
    .sort()
    .reverse()
    .map((f) => toPosix(path.join('.vibemap/changes', f)));
}

export interface ParsedChange {
  entry: ChangeEntry | null;
  issues: string[];
}

export function parseChange(project: Project, rel: string): ParsedChange {
  const raw = readText(path.join(project.root, rel));
  if (!raw.startsWith('---\n')) return { entry: null, issues: ['Missing frontmatter'] };
  const end = raw.indexOf('\n---\n', 4);
  if (end === -1) return { entry: null, issues: ['Unterminated frontmatter'] };
  const front = raw.slice(4, end);
  const body = raw.slice(end + 5).trim();
  try {
    const parsed = ChangeFrontmatterSchema.safeParse(parseYamlText(front, rel).data);
    if (!parsed.success) {
      return { entry: null, issues: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) };
    }
    const data = parsed.data;
    return {
      entry: {
        schema: SCHEMA_VERSION,
        id: data.id,
        title: data.title,
        date: data.date,
        type: data.type,
        phase: data.phase,
        author: data.author,
        maps: data.maps ?? [],
        commit: data.commit ?? null,
        bases: data.bases,
        delta: data.delta ?? { ...EMPTY_DELTA },
        body,
        file: rel,
      },
      issues: [],
    };
  } catch (err) {
    return { entry: null, issues: [(err as Error).message] };
  }
}

export function listChanges(project: Project): ChangeEntry[] {
  const entries: ChangeEntry[] = [];
  for (const rel of listChangeFiles(project)) {
    const parsed = parseChange(project, rel);
    if (parsed.entry) entries.push(parsed.entry);
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

function localStamp(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function isoWithOffset(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const pad = (n: number): string => String(n).padStart(2, '0');
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
  return `${local}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export function uniqueChangeId(project: Project, title: string, date = new Date()): string {
  const base = `${localStamp(date)}-${slugify(title, 40)}`;
  let id = base;
  let n = 2;
  while (fs.existsSync(path.join(changesDir(project), `${id}.md`))) {
    id = `${base}-${n++}`;
  }
  return id;
}

export interface AddChangeInput {
  title: string;
  why: string;
  how?: string;
  watchOut?: string;
  maps: string[];
  type: ChangeEntry['type'];
  phase?: string;
  author?: string;
  delta?: ChangeDelta;
  bases?: Record<string, string>;
  body?: string;
}

export function buildChangeBody(input: AddChangeInput): string {
  const how = input.how?.trim() || 'Describe the change in plain language here.';
  const watchOut = input.watchOut?.trim() || 'No known limits for this change.';
  return `## What changed\n\n${input.title.trim()}\n\n## Why\n\n${input.why.trim()}\n\n## How it works\n\n${how}\n\n## Watch out\n\n${watchOut}\n`;
}

export async function addChangeEntry(project: Project, input: AddChangeInput): Promise<ChangeEntry> {
  const date = new Date();
  const id = uniqueChangeId(project, input.title, date);
  const data = {
    schema: SCHEMA_VERSION,
    id,
    title: input.title,
    date: isoWithOffset(date),
    type: input.type,
    ...(input.phase ? { phase: input.phase } : {}),
    author: input.author ?? `human:${process.env.USERNAME ?? process.env.USER ?? 'local'}`,
    maps: input.maps,
    commit: null,
    ...(input.bases && Object.keys(input.bases).length ? { bases: input.bases } : {}),
    delta: input.delta ?? { ...EMPTY_DELTA },
  };
  const body = input.body ?? buildChangeBody(input);
  const content = `---\n${stringifyYaml(data).trimEnd()}\n---\n\n${body.trim()}\n`;
  const rel = toPosix(path.join('.vibemap/changes', `${id}.md`));
  await writeFileAtomic(path.join(project.root, rel), content);
  return {
    schema: SCHEMA_VERSION,
    id,
    title: input.title,
    date: data.date,
    type: input.type,
    phase: input.phase,
    author: data.author,
    maps: data.maps,
    commit: null,
    bases: input.bases,
    delta: data.delta,
    body,
    file: rel,
  };
}

export function getSection(body: string, heading: string): string {
  const re = new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'im');
  const match = body.match(re);
  if (!match || match.index === undefined) return '';
  const start = match.index + match[0].length;
  const rest = body.slice(start);
  const next = rest.search(/^##\s+/m);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

export function changeSealPath(project: Project, entry: ChangeEntry): string {
  return path.join(project.root, entry.file);
}

/** Set the commit SHA on a change file while leaving the body untouched. */
export async function sealChange(project: Project, entry: ChangeEntry, commit: string): Promise<void> {
  const raw = readText(changeSealPath(project, entry));
  const end = raw.indexOf('\n---\n', 4);
  if (end === -1) throw new Error('Change frontmatter is malformed');
  const front = parseYamlText(raw.slice(4, end), entry.file).data as Record<string, unknown>;
  front.commit = commit;
  const body = raw.slice(end + 5).replace(/^\n+/, '');
  const content = `---\n${stringifyYaml(front).trimEnd()}\n---\n\n${body}`;
  await writeFileAtomic(changeSealPath(project, entry), content);
}

export function latestUnsealedChange(project: Project): ChangeEntry | null {
  return listChanges(project).find((c) => !c.commit) ?? null;
}

export function changeIdsForNode(project: Project, mapId: string, nodeId: string): string[] {
  return listChanges(project)
    .filter((c) => c.maps.includes(mapId) && (c.delta.added_nodes.includes(`${mapId}#${nodeId}`) || c.delta.modified_nodes.includes(`${mapId}#${nodeId}`)))
    .map((c) => c.id);
}

export function isValidChangeId(id: string): boolean {
  return /^\d{8}-\d{4}-[a-z0-9-]+$/.test(id);
}
