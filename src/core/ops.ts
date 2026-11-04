import type {
  ApplyOpsResult,
  GraphMap,
  LockFile,
  PatchOp,
  SequenceMap,
  VibeMap,
  VibeNode,
} from './types.js';
import {
  EdgeSchema,
  ErdEntitySchema,
  ErdFieldSchema,
  ErdRelationSchema,
  GroupSchema,
  MapSchema,
  NodeSchema,
  OpsFileSchema,
  PatchOpSchema,
  SequenceStepSchema,
  WalkthroughStepSchema,
} from './schema.js';
import { documentToString, canonicalJson, parseYamlText, sha1 } from './yaml.js';
import { nodeLockHash } from './locks.js';
import { slugify, toPosix } from './paths.js';

export class OpsError extends Error {
  readonly code: string;
  readonly issues: string[];
  readonly opIndex?: number;

  constructor(message: string, code = 'OPS', issues: string[] = [], opIndex?: number) {
    super(message);
    this.name = 'OpsError';
    this.code = code;
    this.issues = issues;
    this.opIndex = opIndex;
  }
}

export class RevisionConflictError extends Error {
  readonly currentRev: string;
  readonly currentContent: string;

  constructor(currentRev: string, currentContent: string) {
    super('The map changed since it was loaded.');
    this.name = 'RevisionConflictError';
    this.currentRev = currentRev;
    this.currentContent = currentContent;
  }
}

export interface ApplyOpsOptions {
  origin?: 'human' | 'agent' | string;
  enforceLocks?: boolean;
  locks?: LockFile;
  newNodeStatus?: VibeNode['status'];
}

export interface ApplyOpsInternalResult extends ApplyOpsResult {
  renamed: Array<{ from: string; to: string }>;
}

function ensureObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asGraph(map: VibeMap, op: PatchOp): GraphMap {
  if (map.type !== 'graph') throw new OpsError(`Operation "${op.op}" requires a graph map (this map is ${map.type}).`);
  return map;
}

function nodeIndex(map: GraphMap, id: string): number {
  return map.nodes.findIndex((n) => n.id === id);
}

function edgeIdOf(edge: GraphMap['edges'][number], index: number): string {
  return edge.id ?? `${edge.from}>${edge.to}:${edge.kind}#${index}`;
}

function edgeIndex(map: GraphMap, id: string): number {
  return map.edges.findIndex((edge, index) => edgeIdOf(edge, index) === id);
}

function uniqueNodeId(map: GraphMap, label: string, requested?: string): string {
  if (requested) {
    if (map.nodes.some((n) => n.id === requested)) throw new OpsError(`Node "${requested}" already exists.`, 'E003');
    return requested;
  }
  const base = slugify(label);
  let id = base;
  let n = 2;
  while (map.nodes.some((node) => node.id === id)) id = `${base}-${n++}`.slice(0, 48).replace(/-$/, '');
  return id;
}

function uniqueEntityId(map: Extract<VibeMap, { type: 'erd' }>, label: string, requested?: string): string {
  if (requested) {
    if (map.entities.some((e) => e.id === requested)) throw new OpsError(`Entity "${requested}" already exists.`, 'E003');
    return requested;
  }
  const base = slugify(label);
  let id = base;
  let n = 2;
  while (map.entities.some((entity) => entity.id === id)) id = `${base}-${n++}`.slice(0, 48).replace(/-$/, '');
  return id;
}

function zodMessages(error: { issues: Array<{ path: Array<string | number>; message: string }> }): string[] {
  return error.issues.map((i) => `${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`);
}

/** Structural checks that don't require filesystem/scanner access. */
export function structuralIssues(map: VibeMap): string[] {
  const issues: string[] = [];
  if (map.type === 'graph') {
    const nodeIds = new Set<string>();
    for (const node of map.nodes) {
      if (nodeIds.has(node.id)) issues.push(`E003 duplicate node id "${node.id}"`);
      nodeIds.add(node.id);
    }
    const groupIds = new Set<string>();
    for (const group of map.groups ?? []) groupIds.add(group.id);
    for (const node of map.nodes) {
      if (node.group && !groupIds.has(node.group)) issues.push(`E005 node "${node.id}" references unknown group "${node.group}"`);
    }
    const edgeIds = new Set<string>();
    map.edges.forEach((edge, index) => {
      if (!nodeIds.has(edge.from)) issues.push(`E004 edge "from" references unknown node "${edge.from}"`);
      if (!nodeIds.has(edge.to)) issues.push(`E004 edge "to" references unknown node "${edge.to}"`);
      const id = edgeIdOf(edge, index);
      if (edgeIds.has(id)) issues.push(`E003 duplicate edge id "${id}"`);
      edgeIds.add(id);
    });
    for (const step of map.walkthrough ?? []) {
      for (const id of step.focus) if (!nodeIds.has(id)) issues.push(`E011 walkthrough references unknown node "${id}"`);
    }
  } else if (map.type === 'sequence') {
    const participantIds = new Set<string>();
    for (const p of map.participants) {
      if (participantIds.has(p.id)) issues.push(`E003 duplicate participant id "${p.id}"`);
      participantIds.add(p.id);
    }
    map.steps.forEach((step, i) => {
      if (!participantIds.has(step.from)) issues.push(`E016 step ${i} references unknown participant "${step.from}"`);
      if (!participantIds.has(step.to)) issues.push(`E016 step ${i} references unknown participant "${step.to}"`);
    });
    for (const fragment of map.fragments ?? []) {
      if (fragment.from_step < 0 || fragment.to_step >= map.steps.length || fragment.from_step > fragment.to_step) {
        issues.push(`E016 fragment has invalid step range ${fragment.from_step}–${fragment.to_step}`);
      }
    }
  } else if (map.type === 'erd') {
    const entityIds = new Set<string>();
    for (const entity of map.entities) {
      if (entityIds.has(entity.id)) issues.push(`E003 duplicate entity id "${entity.id}"`);
      entityIds.add(entity.id);
    }
    map.relations.forEach((relation, i) => {
      if (!entityIds.has(relation.from)) issues.push(`E016 relation ${i} references unknown entity "${relation.from}"`);
      if (!entityIds.has(relation.to)) issues.push(`E016 relation ${i} references unknown entity "${relation.to}"`);
    });
  }
  return issues;
}

function assertLocks(before: VibeMap, after: VibeMap, locks: LockFile, mapId: string): void {
  if (before.type !== 'graph' || after.type !== 'graph') return;
  const beforeById = new Map(before.nodes.map((n) => [n.id, n]));
  const afterById = new Map(after.nodes.map((n) => [n.id, n]));
  const issues: string[] = [];
  for (const [key, hash] of Object.entries(locks.locks)) {
    const [lockMap, nodeId] = key.split('#');
    if (lockMap !== mapId || !nodeId) continue;
    const b = beforeById.get(nodeId);
    if (!b) continue;
    const a = afterById.get(nodeId);
    if (!a) {
      issues.push(`E009 locked node "${nodeId}" would be removed.`);
    } else if (hash !== nodeLockHash(a)) {
      issues.push(`E009 locked node "${nodeId}" would be modified.`);
    }
  }
  if (issues.length) {
    throw new OpsError(
      issues[0]!,
      'E009',
      issues,
    );
  }
}

/** Apply ops to YAML text, preserving comments and key order outside touched nodes. */
export function applyOpsToContent(
  content: string,
  file: string,
  mapId: string,
  ops: PatchOp[],
  options: ApplyOpsOptions = {},
): ApplyOpsInternalResult {
  const parsed = parseYamlText(content, file);
  const before = parsed.data as VibeMap;
  const doc = parsed.doc;
  const parsedOps = OpsFileSchema.safeParse({ ops });
  if (!parsedOps.success) {
    throw new OpsError('Invalid patch operations.', 'E002', zodMessages(parsedOps.error));
  }
  const renamed: Array<{ from: string; to: string }> = [];
  const statements: string[] = [];
  const origin = options.origin ?? 'agent';

  const snapshot = (): VibeMap => doc.toJS({ maxAliasCount: 100 }) as VibeMap;

  ops.forEach((rawOp, opIndex) => {
    // Re-validate through the shared schema to normalise defaults.
    const opResult = PatchOpSchema.safeParse(rawOp);
    if (!opResult.success) throw new OpsError(`Operation ${opIndex} is invalid.`, 'E002', zodMessages(opResult.error), opIndex);
    const op = opResult.data as PatchOp;
    if (op.op === 'add_node') {
      const map = asGraph(snapshot(), op);
      const draft = { ...(op.node as Record<string, unknown>) } as Partial<VibeNode>;
      if (!draft.kind) draft.kind = 'custom';
      if (!draft.status && origin === 'human' && options.newNodeStatus) draft.status = options.newNodeStatus;
      if (!draft.id) draft.id = uniqueNodeId(map, String(draft.label ?? ''), undefined);
      const node = NodeSchema.safeParse(draft);
      if (!node.success) throw new OpsError(`add_node is invalid.`, 'E002', zodMessages(node.error), opIndex);
      if (map.nodes.some((n) => n.id === node.data.id)) throw new OpsError(`Node "${node.data.id}" already exists.`, 'E003', [], opIndex);
      const nodes = doc.getIn(['nodes']);
      if (!nodes) doc.setIn(['nodes'], []);
      doc.addIn(['nodes'], node.data);
      statements.push(`add_node ${node.data.id}`);
    } else if (op.op === 'update_node') {
      const map = asGraph(snapshot(), op);
      const index = nodeIndex(map, op.id);
      if (index === -1) throw new OpsError(`Node "${op.id}" does not exist.`, 'E004', [], opIndex);
      if ('id' in op.set) throw new OpsError('Use rename_node to change an id.', 'OPS', [], opIndex);
      const existing = map.nodes[index]!;
      const updated = { ...existing, ...op.set };
      const parsedNode = NodeSchema.safeParse(updated);
      if (!parsedNode.success) throw new OpsError(`update_node "${op.id}" is invalid.`, 'E002', zodMessages(parsedNode.error), opIndex);
      for (const [key, value] of Object.entries(op.set)) {
        if (value === undefined) continue;
        doc.setIn(['nodes', index, key], value);
      }
      statements.push(`update_node ${op.id}`);
    } else if (op.op === 'remove_node') {
      const map = asGraph(snapshot(), op);
      const index = nodeIndex(map, op.id);
      if (index === -1) throw new OpsError(`Node "${op.id}" does not exist.`, 'E004', [], opIndex);
      doc.deleteIn(['nodes', index]);
      const current = snapshot();
      if (current.type === 'graph') {
        for (let i = current.edges.length - 1; i >= 0; i--) {
          const edge = current.edges[i]!;
          if (edge.from === op.id || edge.to === op.id) doc.deleteIn(['edges', i]);
        }
        const steps = current.walkthrough ?? [];
        for (let i = steps.length - 1; i >= 0; i--) {
          const next = steps[i]!.focus.filter((id) => id !== op.id);
          if (next.length === 0) doc.deleteIn(['walkthrough', i]);
          else if (next.length !== steps[i]!.focus.length) doc.setIn(['walkthrough', i, 'focus'], next);
        }
      }
      statements.push(`remove_node ${op.id}`);
    } else if (op.op === 'rename_node') {
      const map = asGraph(snapshot(), op);
      const index = nodeIndex(map, op.id);
      if (index === -1) throw new OpsError(`Node "${op.id}" does not exist.`, 'E004', [], opIndex);
      if (nodeIndex(map, op.to) !== -1) throw new OpsError(`Node "${op.to}" already exists.`, 'E003', [], opIndex);
      const updated = NodeSchema.safeParse({ ...map.nodes[index]!, id: op.to });
      if (!updated.success) throw new OpsError(`rename_node target "${op.to}" is invalid.`, 'E006', zodMessages(updated.error), opIndex);
      doc.setIn(['nodes', index, 'id'], op.to);
      const current = snapshot();
      if (current.type === 'graph') {
        current.edges.forEach((edge, i) => {
          if (edge.from === op.id) doc.setIn(['edges', i, 'from'], op.to);
          if (edge.to === op.id) doc.setIn(['edges', i, 'to'], op.to);
        });
        (current.walkthrough ?? []).forEach((step, i) => {
          if (!step.focus.includes(op.id)) return;
          const focus = step.focus.map((id) => (id === op.id ? op.to : id));
          doc.setIn(['walkthrough', i, 'focus'], focus);
        });
      }
      renamed.push({ from: op.id, to: op.to });
      statements.push(`rename_node ${op.id} → ${op.to}`);
    } else if (op.op === 'add_edge') {
      const map = asGraph(snapshot(), op);
      const draft = { kind: 'flow', ...(op.edge as Record<string, unknown>) } as GraphMap['edges'][number];
      const edge = EdgeSchema.safeParse(draft);
      if (!edge.success) throw new OpsError('add_edge is invalid.', 'E002', zodMessages(edge.error), opIndex);
      if (!map.nodes.some((n) => n.id === edge.data.from)) throw new OpsError(`Edge "from" references unknown node "${edge.data.from}".`, 'E004', [], opIndex);
      if (!map.nodes.some((n) => n.id === edge.data.to)) throw new OpsError(`Edge "to" references unknown node "${edge.data.to}".`, 'E004', [], opIndex);
      if (!doc.getIn(['edges'])) doc.setIn(['edges'], []);
      doc.addIn(['edges'], edge.data);
      statements.push(`add_edge ${edge.data.from} → ${edge.data.to}`);
    } else if (op.op === 'update_edge') {
      const map = asGraph(snapshot(), op);
      const index = edgeIndex(map, op.id);
      if (index === -1) throw new OpsError(`Edge "${op.id}" does not exist.`, 'E004', [], opIndex);
      const updated = EdgeSchema.safeParse({ ...map.edges[index]!, ...op.set });
      if (!updated.success) throw new OpsError(`update_edge "${op.id}" is invalid.`, 'E002', zodMessages(updated.error), opIndex);
      for (const [key, value] of Object.entries(op.set)) {
        if (value === undefined) continue;
        doc.setIn(['edges', index, key], value);
      }
      statements.push(`update_edge ${op.id}`);
    } else if (op.op === 'remove_edge') {
      const map = asGraph(snapshot(), op);
      const index = edgeIndex(map, op.id);
      if (index === -1) throw new OpsError(`Edge "${op.id}" does not exist.`, 'E004', [], opIndex);
      doc.deleteIn(['edges', index]);
      statements.push(`remove_edge ${op.id}`);
    } else if (op.op === 'add_group') {
      const map = asGraph(snapshot(), op);
      if ((map.groups ?? []).some((g) => g.id === op.group.id)) throw new OpsError(`Group "${op.group.id}" already exists.`, 'E003', [], opIndex);
      const group = GroupSchema.safeParse(op.group);
      if (!group.success) throw new OpsError('add_group is invalid.', 'E002', zodMessages(group.error), opIndex);
      if (!doc.getIn(['groups'])) doc.setIn(['groups'], []);
      doc.addIn(['groups'], group.data);
      statements.push(`add_group ${group.data.id}`);
    } else if (op.op === 'update_group') {
      const map = asGraph(snapshot(), op);
      const index = (map.groups ?? []).findIndex((g) => g.id === op.id);
      if (index === -1) throw new OpsError(`Group "${op.id}" does not exist.`, 'E005', [], opIndex);
      if ('id' in op.set) throw new OpsError('Group ids cannot be renamed by update_group.', 'OPS', [], opIndex);
      const updated = GroupSchema.safeParse({ ...map.groups![index]!, ...op.set });
      if (!updated.success) throw new OpsError('update_group is invalid.', 'E002', zodMessages(updated.error), opIndex);
      for (const [key, value] of Object.entries(op.set)) {
        if (value === undefined) continue;
        doc.setIn(['groups', index, key], value);
      }
      statements.push(`update_group ${op.id}`);
    } else if (op.op === 'remove_group') {
      const map = asGraph(snapshot(), op);
      const index = (map.groups ?? []).findIndex((g) => g.id === op.id);
      if (index === -1) throw new OpsError(`Group "${op.id}" does not exist.`, 'E005', [], opIndex);
      doc.deleteIn(['groups', index]);
      const current = snapshot();
      if (current.type === 'graph') {
        current.nodes.forEach((node, i) => {
          if (node.group === op.id) doc.deleteIn(['nodes', i, 'group']);
        });
      }
      statements.push(`remove_group ${op.id}`);
    } else if (op.op === 'set_meta') {
      for (const [key, value] of Object.entries(op.set)) {
        if (value === undefined) continue;
        doc.setIn([key], value);
      }
      statements.push(`set_meta ${Object.keys(op.set).join(',')}`);
    } else if (op.op === 'set_walkthrough') {
      asGraph(snapshot(), op);
      const parsedSteps = WalkthroughStepSchema.array().safeParse(op.steps);
      if (!parsedSteps.success) throw new OpsError('set_walkthrough is invalid.', 'E002', zodMessages(parsedSteps.error), opIndex);
      doc.setIn(['walkthrough'], parsedSteps.data);
      statements.push(`set_walkthrough (${parsedSteps.data.length} steps)`);
    } else if (op.op === 'add_step') {
      const current = snapshot();
      if (current.type !== 'sequence') throw new OpsError('add_step requires a sequence map.', 'OPS', [], opIndex);
      const step = SequenceStepSchema.safeParse(op.step);
      if (!step.success) throw new OpsError('add_step is invalid.', 'E002', zodMessages(step.error), opIndex);
      if (!current.participants.some((p) => p.id === step.data.from)) throw new OpsError(`Unknown participant "${step.data.from}".`, 'E016', [], opIndex);
      if (!current.participants.some((p) => p.id === step.data.to)) throw new OpsError(`Unknown participant "${step.data.to}".`, 'E016', [], opIndex);
      if (!doc.getIn(['steps'])) doc.setIn(['steps'], []);
      doc.addIn(['steps'], step.data);
      statements.push(`add_step ${step.data.from} → ${step.data.to}`);
    } else if (op.op === 'add_entity') {
      const current = snapshot();
      if (current.type !== 'erd') throw new OpsError('add_entity requires an ERD map.', 'OPS', [], opIndex);
      const draft = { ...(op.entity as Record<string, unknown>) } as Record<string, unknown>;
      if (!draft.id) draft.id = uniqueEntityId(current, String(draft.label));
      if (!draft.fields) draft.fields = [];
      const entity = ErdEntitySchema.safeParse(draft);
      if (!entity.success) throw new OpsError('add_entity is invalid.', 'E002', zodMessages(entity.error), opIndex);
      if (current.entities.some((e) => e.id === entity.data.id)) throw new OpsError(`Entity "${entity.data.id}" already exists.`, 'E003', [], opIndex);
      if (!doc.getIn(['entities'])) doc.setIn(['entities'], []);
      doc.addIn(['entities'], entity.data);
      statements.push(`add_entity ${entity.data.id}`);
    } else if (op.op === 'add_field') {
      const current = snapshot();
      if (current.type !== 'erd') throw new OpsError('add_field requires an ERD map.', 'OPS', [], opIndex);
      const index = current.entities.findIndex((e) => e.id === op.entity);
      if (index === -1) throw new OpsError(`Entity "${op.entity}" does not exist.`, 'E016', [], opIndex);
      const field = ErdFieldSchema.safeParse(op.field);
      if (!field.success) throw new OpsError('add_field is invalid.', 'E002', zodMessages(field.error), opIndex);
      const entity = current.entities[index]!;
      // Replace the entity mapping rather than traversing into a possibly absent
      // `fields` collection; this also works for entities created without fields.
      doc.setIn(['entities', index], { ...entity, fields: [...entity.fields, field.data] });
      statements.push(`add_field ${op.entity}.${field.data.name}`);
    } else if (op.op === 'add_relation') {
      const current = snapshot();
      if (current.type !== 'erd') throw new OpsError('add_relation requires an ERD map.', 'OPS', [], opIndex);
      const relation = ErdRelationSchema.safeParse(op.relation);
      if (!relation.success) throw new OpsError('add_relation is invalid.', 'E002', zodMessages(relation.error), opIndex);
      if (!current.entities.some((e) => e.id === relation.data.from)) throw new OpsError(`Unknown entity "${relation.data.from}".`, 'E016', [], opIndex);
      if (!current.entities.some((e) => e.id === relation.data.to)) throw new OpsError(`Unknown entity "${relation.data.to}".`, 'E016', [], opIndex);
      if (!doc.getIn(['relations'])) doc.setIn(['relations'], []);
      doc.addIn(['relations'], relation.data);
      statements.push(`add_relation ${relation.data.from} → ${relation.data.to}`);
    } else if (op.op === 'set_source') {
      const current = snapshot();
      if (current.type !== 'mermaid') throw new OpsError('set_source requires a mermaid map.', 'OPS', [], opIndex);
      doc.setIn(['source'], op.source);
      statements.push('set_source');
    }
  });

  const contentAfter = documentToString(doc);
  const finalParsed = parseYamlText(contentAfter, file);
  const final = MapSchema.safeParse(finalParsed.data);
  if (!final.success) {
    throw new OpsError('The resulting map is invalid; no change was written.', 'E002', zodMessages(final.error));
  }
  const after = final.data as unknown as VibeMap;
  const problems = structuralIssues(after);
  if (problems.length) {
    throw new OpsError('The resulting map has structural errors; no change was written.', problems[0]!.slice(0, 4), problems);
  }
  if (options.enforceLocks && options.locks) assertLocks(before, after, options.locks, mapId);
  const changedNodeIds = changedNodes(before, after);
  const changedEdgeIds = changedEdges(before, after);
  return {
    map: after,
    content: contentAfter,
    changedNodeIds,
    changedEdgeIds,
    journalSummary: statements.join('; ') || 'no-op',
    renamed,
  };
}

function changedNodes(before: VibeMap, after: VibeMap): string[] {
  if (before.type !== 'graph' || after.type !== 'graph') return [];
  const beforeById = new Map(before.nodes.map((n) => [n.id, canonicalJson(n)]));
  const out: string[] = [];
  for (const node of after.nodes) {
    const prior = beforeById.get(node.id);
    if (prior === undefined || prior !== canonicalJson(node)) out.push(node.id);
    beforeById.delete(node.id);
  }
  out.push(...beforeById.keys());
  return out;
}

function changedEdges(before: VibeMap, after: VibeMap): string[] {
  if (before.type !== 'graph' || after.type !== 'graph') return [];
  const make = (map: GraphMap): Map<string, string> => {
    const out = new Map<string, string>();
    map.edges.forEach((edge, index) => out.set(edgeIdOf(edge, index), canonicalJson(edge)));
    return out;
  };
  const b = make(before);
  const a = make(after);
  const out: string[] = [];
  for (const [id, json] of a) {
    if (b.get(id) !== json) out.push(id);
    b.delete(id);
  }
  out.push(...b.keys());
  return out;
}

export function diffPreview(before: VibeMap, after: VibeMap): string[] {
  const lines: string[] = [];
  if (before.type === 'graph' && after.type === 'graph') {
    const beforeNodes = new Map(before.nodes.map((n) => [n.id, n]));
    const afterNodes = new Map(after.nodes.map((n) => [n.id, n]));
    for (const node of after.nodes) {
      const prior = beforeNodes.get(node.id);
      if (!prior) lines.push(`+ node ${node.id} "${node.label}"`);
      else if (canonicalJson(prior) !== canonicalJson(node)) lines.push(`~ node ${node.id}`);
      beforeNodes.delete(node.id);
    }
    for (const id of beforeNodes.keys()) lines.push(`- node ${id}`);
    const edgeIds = (map: GraphMap): string[] => map.edges.map((e, i) => edgeIdOf(e, i));
    const beforeEdges = new Set(edgeIds(before));
    const afterEdges = new Set(edgeIds(after));
    for (const id of afterEdges) if (!beforeEdges.has(id)) lines.push(`+ edge ${id}`);
    for (const id of beforeEdges) if (!afterEdges.has(id)) lines.push(`- edge ${id}`);
  } else {
    lines.push(`~ ${before.type} map`);
  }
  return lines;
}

export function contentRev(content: string): string {
  return sha1(content);
}

export function projectRelativeMap(mapId: string): string {
  return toPosix(mapId);
}
