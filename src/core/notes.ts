import fs from 'node:fs';
import path from 'node:path';
import type { NoteEntry } from './types.js';
import { SCHEMA_VERSION } from './types.js';
import type { Project } from './project.js';
import { NoteFrontmatterSchema } from './schema.js';
import { parseYamlText, readText, stringifyYaml, writeFileAtomic } from './yaml.js';
import { normalizeRelPath, toPosix } from './paths.js';

export function notesDir(project: Project): string {
  return path.join(project.vibemapDir, 'notes');
}

export function listNotePaths(project: Project): string[] {
  const root = notesDir(project);
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.')) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile() && entry.name.endsWith('.md')) {
        out.push(toPosix(path.relative(project.root, abs)));
      }
    }
  };
  walk(root);
  return out.sort();
}

export interface ParsedNote {
  entry: NoteEntry;
  issues: string[];
}

export function parseNote(project: Project, rel: string): ParsedNote {
  const abs = path.join(project.root, rel);
  const raw = readText(abs);
  const issues: string[] = [];
  if (!raw.startsWith('---\n')) {
    return {
      entry: { path: rel, title: path.posix.basename(rel, '.md'), maps: [], nodes: [], body: raw, raw },
      issues: ['Missing YAML frontmatter'],
    };
  }
  const end = raw.indexOf('\n---\n', 4);
  if (end === -1) {
    return {
      entry: { path: rel, title: path.posix.basename(rel, '.md'), maps: [], nodes: [], body: raw, raw },
      issues: ['Unterminated YAML frontmatter'],
    };
  }
  const front = raw.slice(4, end);
  const body = raw.slice(end + 5);
  try {
    const data = parseYamlText(front, rel).data;
    const parsed = NoteFrontmatterSchema.safeParse(data);
    if (!parsed.success) {
      issues.push(...parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`));
      return {
        entry: { path: rel, title: path.posix.basename(rel, '.md'), maps: [], nodes: [], body, raw },
        issues,
      };
    }
    return {
      entry: {
        path: rel,
        title: parsed.data.title,
        maps: parsed.data.maps ?? [],
        nodes: parsed.data.nodes ?? [],
        body,
        raw,
      },
      issues,
    };
  } catch (err) {
    issues.push((err as Error).message);
    return {
      entry: { path: rel, title: path.posix.basename(rel, '.md'), maps: [], nodes: [], body, raw },
      issues,
    };
  }
}

export function listNotes(project: Project, includeBody = true): NoteEntry[] {
  return listNotePaths(project).map((rel) => {
    const parsed = parseNote(project, rel);
    if (!includeBody) return { ...parsed.entry, body: '', raw: '' };
    return parsed.entry;
  });
}

export function notePathFromApi(project: Project, rel: string): string {
  const clean = normalizeRelPath(rel);
  const prefix = '.vibemap/notes/';
  const without = clean.startsWith(prefix) ? clean.slice(prefix.length) : clean;
  if (!without.endsWith('.md') || without.startsWith('/') || without.includes('..') || without.includes('\\')) {
    throw new Error('Note path must be a .md file under .vibemap/notes/');
  }
  const abs = path.join(notesDir(project), without);
  const relative = path.relative(notesDir(project), abs);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Note path escapes notes directory');
  return abs;
}

export function readNoteBody(project: Project, rel: string): string {
  return readText(notePathFromApi(project, rel));
}

export async function writeNote(project: Project, rel: string, content: string): Promise<void> {
  const abs = notePathFromApi(project, rel);
  await writeFileAtomic(abs, content);
}

export function createNoteContent(title: string, maps: string[], nodes: string[], body: string): string {
  return `---\n${stringifyYaml({ schema: SCHEMA_VERSION, title, maps, nodes }).trimEnd()}\n---\n\n${body.trim()}\n`;
}

/** Extract [[map#node]] wiki links. */
export function parseWikiLinks(body: string): Array<{ map: string; node?: string }> {
  const out: Array<{ map: string; node?: string }> = [];
  for (const match of body.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const target = match[1]!.split('|')[0]!.trim();
    const [map, node] = target.split('#');
    if (!map) continue;
    out.push({ map, node: node || undefined });
  }
  return out;
}

export function noteReferences(entry: NoteEntry): Array<{ map: string; node?: string }> {
  const refs: Array<{ map: string; node?: string }> = [];
  for (const map of entry.maps) refs.push({ map });
  for (const node of entry.nodes) {
    const [map, id] = node.split('#');
    if (map) refs.push({ map, node: id });
  }
  for (const link of parseWikiLinks(entry.body)) refs.push(link);
  return refs;
}
