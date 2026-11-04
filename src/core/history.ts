import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import type { HistoryPoint, MapDiff, VibeMap } from './types.js';
import type { Project } from './project.js';
import { listJournal, journalEntry } from './journal.js';
import { mapFileFromId } from './paths.js';
import { repoPath } from './git.js';
import { parseMapContent } from './maps.js';
import { diffMaps } from './diff.js';
import { sha1 } from './yaml.js';

function git(project: Project, args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd: project.root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

export function isGitRepo(project: Project): boolean {
  return git(project, ['rev-parse', '--is-inside-work-tree'])?.trim() === 'true';
}

export function listGitHistory(project: Project, mapId: string, limit = 100): HistoryPoint[] {
  if (!isGitRepo(project)) return [];
  const rel = repoPath(project.root, mapFileFromId(mapId));
  const out = git(project, ['log', '--follow', `--max-count=${limit}`, '--format=%H%x09%h%x09%aI%x09%s', '--', rel]);
  if (!out) return [];
  const points: HistoryPoint[] = [];
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    const [sha, short, date, ...rest] = line.split('\t');
    if (!sha || !date) continue;
    points.push({
      id: `git:${short ?? sha.slice(0, 8)}`,
      ts: date,
      kind: 'git',
      origin: 'git',
      summary: rest.join('\t') || 'commit',
      commit: sha,
      rev: sha,
    });
  }
  return points;
}

export async function listHistory(project: Project, mapId: string, limit = 100): Promise<HistoryPoint[]> {
  const journal = await listJournal(project, mapId, limit);
  const journalPoints: HistoryPoint[] = journal.map((entry) => ({
    id: entry.id,
    ts: entry.ts,
    kind: 'journal',
    origin: entry.origin,
    summary: entry.summary,
    rev: entry.id,
  }));
  const gitPoints = project.config.history.source === 'git' ? listGitHistory(project, mapId, limit) : [];
  return [...journalPoints, ...gitPoints].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, limit);
}

export function gitShow(project: Project, mapId: string, rev: string): string | null {
  if (!isGitRepo(project)) return null;
  const rel = repoPath(project.root, mapFileFromId(mapId));
  return git(project, ['show', `${rev}:${rel}`]);
}

export async function contentAtRev(project: Project, mapId: string, rev: string): Promise<string | null> {
  if (!rev || rev === 'working' || rev === 'now') {
    try {
      return fs.readFileSync(`${project.root}/${mapFileFromId(mapId)}`, 'utf8');
    } catch {
      return null;
    }
  }
  const point = await journalEntry(project, rev);
  if (point && point.map === mapId) return point.content;
  const journal = await listJournal(project, mapId, 500);
  const byRev = journal.find((e) => e.rev === rev);
  if (byRev) return byRev.content;
  return gitShow(project, mapId, rev);
}

export async function mapAtRev(project: Project, mapId: string, rev: string): Promise<{ map: VibeMap; content: string; rev: string } | null> {
  const content = await contentAtRev(project, mapId, rev);
  if (!content) return null;
  const file = mapFileFromId(mapId);
  const parsed = parseMapContent(content, file, mapId);
  if (!parsed.map) return null;
  return { map: parsed.map, content, rev: sha1(content) };
}

export async function diffRevs(
  project: Project,
  mapId: string,
  baseRev: string,
  headRev: string,
): Promise<MapDiff | null> {
  const base = await mapAtRev(project, mapId, baseRev);
  const head = await mapAtRev(project, mapId, headRev);
  if (!base || !head) return null;
  return diffMaps(mapId, base.map, head.map, baseRev, headRev);
}

export function commitExists(project: Project, rev: string): boolean {
  if (!isGitRepo(project)) return false;
  return git(project, ['cat-file', '-e', `${rev}^{commit}`]) !== null;
}
