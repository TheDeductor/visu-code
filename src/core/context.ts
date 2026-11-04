import type { Facts, LockFile, VibeMap } from './types.js';
import type { Project } from './project.js';
import { listMapIds, readLocks } from './project.js';
import { loadAllMaps } from './maps.js';
import { loadFacts } from './scanner.js';
import { isCodeLanguage, toPosix } from './paths.js';
import { readPending } from './drift.js';

export interface ContextOptions {
  area?: string;
  mapId?: string;
  budget?: number;
}

function mapCounts(map: VibeMap): string {
  if (map.type === 'graph') return `${map.nodes.length}`;
  if (map.type === 'sequence') return `${map.participants.length}`;
  if (map.type === 'erd') return `erd, ${map.entities.length}`;
  return 'mermaid';
}

function refsLabel(map: VibeMap, id: string): string {
  if (map.type === 'graph') {
    const node = map.nodes.find((n) => n.id === id);
    if (!node) return id;
    const ref = node.refs?.[0];
    return `${node.label}${node.status ? `, ${node.status}` : ''})${ref ? ` → ${ref.path}${ref.symbol ? `#${ref.symbol}` : ''}` : ''}`.replace(')', '');
  }
  if (map.type === 'sequence') return map.participants.find((p) => p.id === id)?.label ?? id;
  if (map.type === 'erd') return map.entities.find((e) => e.id === id)?.label ?? id;
  return id;
}

function mapMatchesArea(mapId: string, map: VibeMap, area: string): boolean {
  const needle = toPosix(area).toLowerCase();
  if (mapId.toLowerCase().includes(needle)) return true;
  if (map.type === 'graph') {
    return map.nodes.some((n) => (n.refs ?? []).some((r) => r.path.toLowerCase().includes(needle)) || n.label.toLowerCase().includes(needle));
  }
  if (map.type === 'sequence') return map.participants.some((p) => (p.refs ?? []).some((r) => r.path.toLowerCase().includes(needle)));
  if (map.type === 'erd') return map.entities.some((e) => (e.refs ?? []).some((r) => r.path.toLowerCase().includes(needle)));
  return false;
}

function unmappedTop(project: Project, facts: Facts | null, maps: Array<{ map: VibeMap }>, limit = 5): string[] {
  if (!facts) return [];
  const refs = new Set<string>();
  for (const { map } of maps) {
    if (map.type === 'graph') for (const node of map.nodes) for (const ref of node.refs ?? []) refs.add(ref.path);
    if (map.type === 'sequence') for (const p of map.participants) for (const ref of p.refs ?? []) refs.add(ref.path);
    if (map.type === 'erd') for (const e of map.entities) for (const ref of e.refs ?? []) refs.add(ref.path);
  }
  return facts.files
    .filter((f) => !f.secret && isCodeLanguage(f.lang) && !refs.has(f.path) && !f.path.startsWith('.vibemap/'))
    .map((f) => f.path)
    .slice(0, limit);
}

function lockedEntries(locks: LockFile): string[] {
  return Object.keys(locks.locks).sort();
}

export function buildContext(project: Project, options: ContextOptions = {}): string {
  const budget = Math.max(200, options.budget ?? 1500);
  const { maps, errors } = loadAllMaps(project);
  const locks = readLocks(project);
  const facts = loadFacts(project);
  const pending = readPending(project);
  const filtered = maps.filter((m) => (options.mapId ? m.id === options.mapId : true));
  let selected = filtered;
  if (options.area) {
    const matching = filtered.filter((m) => mapMatchesArea(m.id, m.map, options.area!));
    const overview = filtered.filter((m) => m.id === '00-overview' && !matching.some((x) => x.id === m.id));
    selected = [...matching, ...overview];
    if (selected.length === 0) selected = filtered;
  }
  selected = [...selected].sort((a, b) => {
    if (a.id === '00-overview') return -1;
    if (b.id === '00-overview') return 1;
    return a.id.localeCompare(b.id);
  });

  const lines: string[] = [];
  lines.push(`VIBEMAP CONTEXT (tracking: ${project.config.tracking.mode}, granularity: ${project.config.tracking.granularity})`);
  if (options.area) lines.push(`area: ${toPosix(options.area)}`);
  if (errors.length) lines.push(`invalid maps: ${errors.map((e) => e.id).join(', ')} (run \`vibemap check\`)`);
  if (selected.length === 0) {
    lines.push('no maps yet.');
    lines.push('Initialize with: vibemap bootstrap  (then follow .vibemap/BOOTSTRAP_PROMPT.md)');
    return lines.join('\n');
  }
  lines.push(`maps: ${selected.map((m) => `${m.id} (${mapCounts(m.map)})`).join(' | ')}`);
  const locked = lockedEntries(locks);
  if (locked.length) lines.push(`locked: ${locked.join(', ')}`);

  for (const loaded of selected) {
    if (lines.join('\n').length / 4 > budget * 0.72) {
      lines.push(`… ${selected.length - selected.indexOf(loaded)} more maps trimmed by budget`);
      break;
    }
    const map = loaded.map;
    lines.push(`## ${loaded.id}  [${map.level ?? 'unleveled'}]${map.summary ? ` "${map.summary}"` : ''}`);
    if (map.phase) lines.push(`phase: ${map.phase}`);
    if (map.type === 'graph') {
      for (const node of map.nodes) {
        const ref = node.refs?.[0];
        const lockMark = locked.includes(`${loaded.id}#${node.id}`) ? ' [LOCKED]' : '';
        lines.push(`  ${node.id} (${node.kind}${node.status ? `, ${node.status}` : ''}) ${node.label}${ref ? ` → ${ref.path}${ref.symbol ? `#${ref.symbol}` : ''}` : ''}${lockMark}`);
      }
      if (map.edges.length) {
        lines.push(`  edges: ${map.edges.slice(0, 24).map((e) => `${e.from} -${e.kind}-> ${e.to}`).join(' ; ')}${map.edges.length > 24 ? ` ; …+${map.edges.length - 24}` : ''}`);
      }
      if (map.walkthrough?.length) lines.push(`  walkthrough: ${map.walkthrough.length} steps`);
    } else if (map.type === 'sequence') {
      lines.push(`  participants: ${map.participants.map((p) => `${p.id} (${p.label})`).join(', ')}`);
      lines.push(`  steps: ${map.steps.length}`);
    } else if (map.type === 'erd') {
      lines.push(`  entities: ${map.entities.map((e) => `${e.id} (${e.label}: ${e.fields.length} fields)`).join(', ')}`);
    } else {
      lines.push(`  mermaid source: ${map.source.split('\n')[0]}`);
    }
    if (map.notes?.length) lines.push(`  notes: ${map.notes.join(', ')}`);
  }

  const unmapped = unmappedTop(project, facts, maps);
  if (unmapped.length) lines.push(`unmapped (top ${unmapped.length}): ${unmapped.join(', ')}`);
  if (pending?.files.length) {
    lines.push(`pending drift (${pending.files.length}): ${pending.files.slice(0, 6).join(', ')}${pending.files.length > 6 ? ', …' : ''}`);
  } else {
    lines.push('pending drift: none');
  }
  const text = lines.join('\n');
  const maxChars = budget * 4;
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 40).trimEnd()}\n… (trimmed to ~${budget} tokens)`;
}

export function contextTokenEstimate(text: string): number {
  return Math.ceil(text.length / 4);
}
