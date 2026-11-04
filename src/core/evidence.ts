import fs from 'node:fs';
import type {
  CoverageReport,
  ErdMap,
  EvidenceMap,
  Facts,
  GraphMap,
  MapType,
  NodeEvidence,
  RefEvidence,
  VibeMap,
} from './types.js';
import type { Project } from './project.js';
import { resolveInsideReal } from './paths.js';
import { loadFacts } from './scanner.js';

export const REF_REQUIRED_KINDS = new Set([
  'ui',
  'page',
  'component',
  'api',
  'service',
  'module',
  'function',
  'file',
  'database',
  'queue',
  'cache',
  'storage',
  'config',
  'process',
]);

export function nodeRefs(map: VibeMap): Array<{ id: string; refs: NonNullable<GraphMap['nodes'][number]['refs']> }> {
  if (map.type === 'graph') return map.nodes.map((n) => ({ id: n.id, refs: n.refs ?? [] }));
  if (map.type === 'sequence') return map.participants.map((p) => ({ id: p.id, refs: p.refs ?? [] }));
  if (map.type === 'erd') return map.entities.map((e) => ({ id: e.id, refs: e.refs ?? [] }));
  return [];
}

function statusForNode(
  refs: NonNullable<GraphMap['nodes'][number]['refs']>,
  planned: boolean,
  evidence: RefEvidence[],
): NodeEvidence {
  if (planned) return { status: 'planned', refs: evidence, stale: false };
  if (refs.length === 0) return { status: 'declared', refs: [], stale: false };
  const stale = evidence.some((e) => e.status === 'stale');
  return { status: stale ? 'stale' : 'verified', refs: evidence, stale };
}

export function resolveEvidence(
  project: Project,
  map: VibeMap,
  facts: Facts | null = loadFacts(project),
): EvidenceMap {
  const out: EvidenceMap = {};
  if (!facts) {
    // No scanner data: refs are declared-only, never claimed as verified.
    for (const { id, refs } of nodeRefs(map)) {
      const planned = map.type === 'graph' && map.nodes.find((n) => n.id === id)?.status === 'planned';
      out[id] = {
        status: planned ? 'planned' : refs.length ? 'declared' : 'declared',
        refs: refs.map((ref) => ({
          ref,
          pathExists: fs.existsSync(resolveSafe(project, ref.path) ?? ''),
          status: planned ? 'planned' : 'declared',
        })),
        stale: false,
      };
    }
    return out;
  }
  const factByPath = new Map(facts.files.map((f) => [f.path, f]));
  for (const { id, refs } of nodeRefs(map)) {
    const planned = map.type === 'graph' && map.nodes.find((n) => n.id === id)?.status === 'planned';
    const refEvidence: RefEvidence[] = refs.map((ref) => {
      const fact = factByPath.get(ref.path);
      let pathExists = false;
      try {
        const abs = resolveInsideReal(project.root, ref.path);
        pathExists = fs.existsSync(abs) && fs.statSync(abs).isFile();
      } catch {
        pathExists = false;
      }
      let symbolFound: boolean | undefined;
      let linesValid: boolean | undefined;
      let detail: string | undefined;
      let status: RefEvidence['status'] = planned ? 'planned' : pathExists ? 'verified' : 'stale';
      if (pathExists && ref.symbol) {
        if (fact && fact.symbols.length > 0) {
          symbolFound = fact.symbols.some((s) => s.name === ref.symbol);
          if (!symbolFound) {
            status = 'stale';
            detail = `symbol "${ref.symbol}" not found in ${ref.path}`;
          }
        } else {
          symbolFound = undefined;
          detail = 'symbol verification unavailable for this language';
        }
      }
      if (pathExists && fact?.lines && ref.lines) {
        linesValid = ref.lines[1] <= fact.lines;
        if (!linesValid) {
          status = 'stale';
          detail = `line range ${ref.lines[0]}–${ref.lines[1]} exceeds file length ${fact.lines}`;
        }
      }
      if (!pathExists) {
        status = 'stale';
        detail = `file "${ref.path}" does not exist`;
      }
      if (planned) status = 'planned';
      return { ref, pathExists, symbolFound, linesValid, status, detail };
    });
    out[id] = statusForNode(refs, planned, refEvidence);
  }
  return out;
}

function resolveSafe(project: Project, rel: string): string | null {
  try {
    return resolveInsideReal(project.root, rel);
  } catch {
    return null;
  }
}

export function evidenceStats(evidence: EvidenceMap): {
  verified: number;
  declared: number;
  stale: number;
  planned: number;
} {
  const out = { verified: 0, declared: 0, stale: 0, planned: 0 };
  for (const item of Object.values(evidence)) out[item.status]++;
  return out;
}

export function referencedPaths(maps: Array<{ id: string; map: VibeMap }>): Set<string> {
  const out = new Set<string>();
  for (const { map } of maps) {
    for (const { refs } of nodeRefs(map)) {
      for (const ref of refs) out.add(ref.path);
    }
  }
  return out;
}

export function coverageReport(
  maps: Array<{ id: string; map: VibeMap; evidence?: EvidenceMap }>,
  facts: Facts,
  target: number,
  isSource: (path: string) => boolean,
): CoverageReport {
  const refs = referencedPaths(maps);
  const sourceFiles = facts.files.filter((f) => !f.secret && isSource(f.path));
  const total = sourceFiles.length;
  const coveredFiles = sourceFiles.filter((f) => refs.has(f.path)).length;
  const dirs = new Map<string, { total: number; covered: number }>();
  for (const file of sourceFiles) {
    const dir = file.path.includes('/') ? file.path.split('/')[0]! : '(root)';
    const bucket = dirs.get(dir) ?? { total: 0, covered: 0 };
    bucket.total++;
    if (refs.has(file.path)) bucket.covered++;
    dirs.set(dir, bucket);
  }
  const byDirectory = [...dirs.entries()]
    .map(([dir, v]) => ({
      dir,
      total: v.total,
      covered: v.covered,
      percent: v.total ? Math.round((v.covered / v.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total || a.dir.localeCompare(b.dir));
  const unverified: CoverageReport['unverified'] = [];
  for (const entry of maps) {
    if (!entry.evidence) continue;
    const map = entry.map;
    for (const [id, ev] of Object.entries(entry.evidence)) {
      if (ev.status === 'verified' || ev.status === 'planned') continue;
      const label = labelFor(map, id);
      unverified.push({ map: entry.id, node: id, label, status: ev.status });
    }
  }
  return {
    target,
    totalFiles: total,
    coveredFiles,
    percent: total ? Math.round((coveredFiles / total) * 1000) / 10 : 100,
    byDirectory,
    unmapped: sourceFiles.filter((f) => !refs.has(f.path)).map((f) => f.path),
    unverified,
  };
}

function labelFor(map: VibeMap, id: string): string {
  if (map.type === 'graph') return map.nodes.find((n) => n.id === id)?.label ?? id;
  if (map.type === 'sequence') return map.participants.find((p) => p.id === id)?.label ?? id;
  if (map.type === 'erd') return map.entities.find((e) => e.id === id)?.label ?? id;
  return id;
}

export function mapTypeLabel(type: MapType): string {
  return type === 'erd' ? 'ERD' : type.charAt(0).toUpperCase() + type.slice(1);
}

export function entityFieldCount(map: ErdMap): number {
  return map.entities.reduce((sum, e) => sum + e.fields.length, 0);
}
