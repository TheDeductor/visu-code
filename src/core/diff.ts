import type { MapDiff, VibeEdge, VibeMap, VibeNode } from './types.js';
import { canonicalJson } from './yaml.js';

const NODE_FIELDS = ['label', 'kind', 'group', 'status', 'description', 'plain', 'refs', 'tags', 'phase', 'drill'] as const;
const EDGE_FIELDS = ['from', 'to', 'label', 'kind', 'description'] as const;

function nodesOf(map: VibeMap): VibeNode[] {
  if (map.type === 'graph') return map.nodes;
  if (map.type === 'sequence') {
    return map.participants.map((p) => ({ id: p.id, label: p.label, kind: p.kind ?? 'actor', refs: p.refs }));
  }
  if (map.type === 'erd') {
    return map.entities.map((e) => ({ id: e.id, label: e.label, kind: 'database', refs: e.refs }));
  }
  return [];
}

function edgesOf(map: VibeMap): VibeEdge[] {
  if (map.type === 'graph') return map.edges;
  if (map.type === 'sequence') {
    return map.steps.map((step, i) => ({
      id: step.id ?? `${step.from}>${step.to}:${step.kind ?? 'call'}#${i}`,
      from: step.from,
      to: step.to,
      label: step.label,
      kind: step.kind === 'return' ? 'returns' : step.kind === 'event' ? 'event' : 'calls',
    }));
  }
  if (map.type === 'erd') {
    return map.relations.map((relation, i) => ({
      id: relation.id ?? `${relation.from}>${relation.to}:relation#${i}`,
      from: relation.from,
      to: relation.to,
      label: relation.label ?? relation.card,
      kind: 'depends',
    }));
  }
  return [];
}

function edgeKey(edge: VibeEdge, index: number): string {
  return edge.id ?? `${edge.from}|${edge.to}|${edge.kind}|${index}`;
}

function changedFields<T extends Record<string, unknown>>(before: T, after: T, fields: readonly string[]): string[] {
  const out: string[] = [];
  for (const field of fields) {
    if (canonicalJson(before[field]) !== canonicalJson(after[field])) out.push(field);
  }
  return out;
}

function labelSimilarity(a: string, b: string): number {
  const aa = a.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const bb = b.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!aa || !bb) return 0;
  if (aa === bb) return 1;
  const aTokens = new Set(aa.split(' '));
  const bTokens = new Set(bb.split(' '));
  let common = 0;
  for (const t of aTokens) if (bTokens.has(t)) common++;
  return (2 * common) / (aTokens.size + bTokens.size);
}

export function diffMaps(mapId: string, base: VibeMap, head: VibeMap, baseRev: string, headRev: string): MapDiff {
  const baseNodes = new Map(nodesOf(base).map((n) => [n.id, n]));
  const headNodes = new Map(nodesOf(head).map((n) => [n.id, n]));
  const added: VibeNode[] = [];
  const removed: VibeNode[] = [];
  const modified: MapDiff['modified'] = [];
  for (const node of headNodes.values()) {
    const prior = baseNodes.get(node.id);
    if (!prior) {
      added.push(node);
      continue;
    }
    const fields = changedFields(prior as unknown as Record<string, unknown>, node as unknown as Record<string, unknown>, NODE_FIELDS);
    if (fields.length) modified.push({ id: node.id, before: prior, after: node, fields });
    baseNodes.delete(node.id);
  }
  for (const node of baseNodes.values()) removed.push(node);

  const baseEdges = new Map(edgesOf(base).map((e, i) => [edgeKey(e, i), e]));
  const headEdges = new Map(edgesOf(head).map((e, i) => [edgeKey(e, i), e]));
  const addedEdges: VibeEdge[] = [];
  const removedEdges: VibeEdge[] = [];
  const modifiedEdges: MapDiff['modifiedEdges'] = [];
  for (const [key, edge] of headEdges) {
    const prior = baseEdges.get(key);
    if (!prior) {
      addedEdges.push(edge);
      continue;
    }
    const fields = changedFields(prior as unknown as Record<string, unknown>, edge as unknown as Record<string, unknown>, EDGE_FIELDS);
    if (fields.length) modifiedEdges.push({ id: key, before: prior, after: edge, fields });
    baseEdges.delete(key);
  }
  for (const edge of baseEdges.values()) removedEdges.push(edge);

  const possibleRenames: NonNullable<MapDiff['possibleRenames']> = [];
  for (const out of removed) {
    for (const inn of added) {
      if (out.kind !== inn.kind) continue;
      const refsA = new Set((out.refs ?? []).map((r) => r.path));
      const overlap = (inn.refs ?? []).some((r) => refsA.has(r.path));
      const similarity = labelSimilarity(out.label, inn.label);
      if (overlap || similarity >= 0.8) {
        possibleRenames.push({
          from: out.id,
          to: inn.id,
          reason: overlap ? 'same code refs' : `similar labels (${Math.round(similarity * 100)}%)`,
        });
      }
    }
  }

  return {
    map: mapId,
    base: baseRev,
    head: headRev,
    added,
    removed,
    modified,
    addedEdges,
    removedEdges,
    modifiedEdges,
    baseMap: base,
    headMap: head,
    possibleRenames,
  };
}

export function diffSummary(diff: MapDiff): string {
  const parts: string[] = [];
  if (diff.added.length) parts.push(`+${diff.added.length} nodes`);
  if (diff.removed.length) parts.push(`−${diff.removed.length} nodes`);
  if (diff.modified.length) parts.push(`~${diff.modified.length} nodes`);
  if (diff.addedEdges.length) parts.push(`+${diff.addedEdges.length} edges`);
  if (diff.removedEdges.length) parts.push(`−${diff.removedEdges.length} edges`);
  if (diff.modifiedEdges.length) parts.push(`~${diff.modifiedEdges.length} edges`);
  return parts.join(' ') || 'no semantic changes';
}

export function diffHasChanges(diff: MapDiff): boolean {
  return Boolean(diff.added.length || diff.removed.length || diff.modified.length || diff.addedEdges.length || diff.removedEdges.length || diff.modifiedEdges.length);
}

export function unionNodeIds(diff: MapDiff): Array<{ id: string; state: 'added' | 'removed' | 'modified' }> {
  const out: Array<{ id: string; state: 'added' | 'removed' | 'modified' }> = [];
  for (const node of diff.added) out.push({ id: node.id, state: 'added' });
  for (const node of diff.removed) out.push({ id: node.id, state: 'removed' });
  for (const node of diff.modified) out.push({ id: node.id, state: 'modified' });
  return out;
}
