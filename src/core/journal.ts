import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { JournalEntry } from './types.js';
import { SCHEMA_VERSION } from './types.js';
import type { Project } from './project.js';
import { sha1, writeFileAtomic } from './yaml.js';

export function journalDir(project: Project): string {
  return path.join(project.vibemapDir, '.cache', 'journal');
}

export async function recordJournal(
  project: Project,
  mapId: string,
  content: string,
  origin: string,
  summary: string,
): Promise<JournalEntry> {
  const dir = journalDir(project);
  await fsp.mkdir(dir, { recursive: true });
  const rev = sha1(content);
  const existing = await latestJournalForMap(project, mapId);
  if (existing && existing.rev === rev) return existing;
  const ts = new Date();
  const id = `${ts.toISOString().replace(/[-:.TZ]/g, '')}-${rev.slice(0, 8)}`;
  const entry: JournalEntry = {
    schema: SCHEMA_VERSION,
    id,
    ts: ts.toISOString(),
    map: mapId,
    rev,
    origin,
    summary,
    content,
  };
  const file = path.join(dir, `${id}.json`);
  await writeFileAtomic(file, `${JSON.stringify(entry)}\n`);
  await pruneJournal(project);
  return entry;
}

export async function pruneJournal(project: Project): Promise<void> {
  const max = project.config.history.journalMaxEntries;
  const files = await listJournalFiles(project);
  if (files.length <= max) return;
  const stale = files.slice(max);
  await Promise.all(stale.map((file) => fsp.rm(path.join(journalDir(project), file), { force: true })));
}

async function listJournalFiles(project: Project): Promise<string[]> {
  try {
    const dir = journalDir(project);
    const entries = await fsp.readdir(dir);
    return entries.filter((f) => f.endsWith('.json') && !f.startsWith('.')).sort().reverse();
  } catch {
    return [];
  }
}

export async function listJournal(project: Project, mapId?: string, limit = 200): Promise<JournalEntry[]> {
  const files = await listJournalFiles(project);
  const out: JournalEntry[] = [];
  for (const file of files) {
    if (out.length >= limit) break;
    try {
      const entry = JSON.parse(await fsp.readFile(path.join(journalDir(project), file), 'utf8')) as JournalEntry;
      if (!entry || entry.schema !== SCHEMA_VERSION) continue;
      if (mapId && entry.map !== mapId) continue;
      out.push(entry);
    } catch {
      // Ignore a corrupt journal point rather than blocking the viewer.
    }
  }
  return out.sort((a, b) => b.ts.localeCompare(a.ts));
}

export async function latestJournalForMap(project: Project, mapId: string): Promise<JournalEntry | null> {
  const entries = await listJournal(project, mapId, 1);
  return entries[0] ?? null;
}

export async function latestJournal(project: Project): Promise<JournalEntry | null> {
  const entries = await listJournal(project, undefined, 1);
  return entries[0] ?? null;
}

export async function journalEntry(project: Project, id: string): Promise<JournalEntry | null> {
  const safe = id.replace(/[^a-zA-Z0-9-]/g, '');
  const file = path.join(journalDir(project), `${safe}.json`);
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8')) as JournalEntry;
  } catch {
    return null;
  }
}

export async function journalPointAt(project: Project, mapId: string, idOrRev: string): Promise<JournalEntry | null> {
  const byId = await journalEntry(project, idOrRev);
  if (byId && byId.map === mapId) return byId;
  const entries = await listJournal(project, mapId, 500);
  return entries.find((e) => e.rev === idOrRev) ?? null;
}

export function journalCount(project: Project): number {
  try {
    return fs.readdirSync(journalDir(project)).filter((f) => f.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

export async function lastWriteSince(project: Project, iso: string): Promise<JournalEntry[]> {
  const entries = await listJournal(project, undefined, 500);
  return entries.filter((e) => e.ts > iso);
}
