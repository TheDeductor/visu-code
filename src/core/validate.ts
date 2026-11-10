import fs from 'node:fs';
import path from 'node:path';
import type {
  CheckOptions,
  CheckReport,
  CheckStats,
  GraphMap,
  Issue,
  NodeEvidence,
  VibeMap,
  VibeNode,
} from './types.js';
import { SCHEMA_VERSION } from './types.js';
import type { Project } from './project.js';
import { listMapIds, readLocks, readPhases, tryLoadProject } from './project.js';
import { loadAllMaps, type LoadedMap } from './maps.js';
import { ensureFacts } from './scanner.js';
import { REF_REQUIRED_KINDS, coverageReport, evidenceStats, resolveEvidence } from './evidence.js';
import { isNodeLocked, lockKey, lockStatus, nodeLockHash } from './locks.js';
import { getSection, listChangeFiles, listChanges, parseChange } from './changes.js';
import { listNotes, parseNote, noteReferences } from './notes.js';
import { pendingDriftWarnings } from './drift.js';
import { rankGraph } from './layout.js';
import { isCodeLanguage, mapFileFromId, toPosix } from './paths.js';
import { LayoutSidecarSchema, PhasesSchema } from './schema.js';
import { lineForPath, parseYamlFile, readJsonFile } from './yaml.js';

const SUPPORTED_SYMBOL_LANGS = new Set(['ts', 'tsx', 'js', 'jsx', 'py', 'prisma']);

function issue(
  severity: Issue['severity'],
  code: string,
  file: string,
  message: string,
  line?: number,
  hint?: string,
  fix?: string,
): Issue {
  return { code, severity, file, message, line, hint, fix };
}

function lineOf(map: LoadedMap, logical: Array<string | number>): number | undefined {
  return lineForPath(map.doc, map.lineCounter, logical);
}

function nodeIndexes(map: VibeMap): Map<string, number> {
  const out = new Map<string, number>();
  if (map.type === 'graph') map.nodes.forEach((n, i) => out.set(n.id, i));
  else if (map.type === 'sequence') map.participants.forEach((p, i) => out.set(p.id, i));
  else if (map.type === 'erd') map.entities.forEach((e, i) => out.set(e.id, i));
  return out;
}

export function derivedEdgeId(edge: { id?: string; from: string; to: string; kind: string }, index: number): string {
  return edge.id ?? `${edge.from}>${edge.to}:${edge.kind}#${index}`;
}

function duplicateIds(map: VibeMap): string[] {
  const ids = map.type === 'graph' ? map.nodes.map((n) => n.id) : map.type === 'sequence' ? map.participants.map((p) => p.id) : map.type === 'erd' ? map.entities.map((e) => e.id) : [];
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dupes.add(id);
    seen.add(id);
  }
  return [...dupes];
}

function layoutFiles(project: Project): string[] {
  const dir = path.join(project.vibemapDir, 'layouts');
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const abs = path.join(d, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile() && entry.name.endsWith('.layout.json')) out.push(toPosix(path.relative(project.root, abs)));
    }
  };
  walk(dir);
  return out.sort();
}

function mapIdFromLayoutFile(rel: string): string {
  return rel
    .replace(/^\.vibemap\/layouts\//, '')
    .replace(/^\//, '')
    .replace(/\.layout\.json$/, '');
}

/**
 * Async entry point for validators that will need headless layout in Phase 5.
 * Today it delegates to the synchronous validator; keeping it here lets the
 * CLI/server switch to awaited layout checks without another API break.
 */
export async function validateProjectAsync(project: Project, opts: CheckOptions = {}): Promise<CheckReport> {
  return validateProject(project, opts);
}

export function validateProject(project: Project, opts: CheckOptions = {}): CheckReport {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const stats: CheckStats = {
    maps: 0,
    nodes: 0,
    edges: 0,
    verified: 0,
    declared: 0,
    stale: 0,
    planned: 0,
  };
  const facts = ensureFacts(project, { full: false });
  const loaded = loadAllMaps(project);
  stats.maps = loaded.maps.length + loaded.errors.length;
  for (const err of loaded.errors) {
    for (const issueItem of err.issues) errors.push({ ...issueItem, severity: 'error' });
  }

  let phases: Array<{ id: string; title: string }> = [];
  try {
    phases = readPhases(project).phases;
  } catch (err) {
    errors.push(issue('error', 'E002', '.vibemap/phases.yaml', (err as Error).message));
  }
  const phaseIds = new Set(phases.map((p) => p.id));
  let locks;
  try {
    locks = readLocks(project);
  } catch (err) {
    errors.push(issue('error', 'E009', '.vibemap/locks.json', (err as Error).message));
    locks = { schema: SCHEMA_VERSION, locks: {} };
  }

  const mapById = new Map<string, LoadedMap>();
  const evidenceByMap = new Map<string, Record<string, NodeEvidence>>();
  const config = project.config;
  const RECOMMENDED_MAX_LABEL_CHARS = 24;
  if (config.limits.maxLabelChars > RECOMMENDED_MAX_LABEL_CHARS) {
    warnings.push(
      issue(
        'warning',
        'W116',
        '.vibemap/config.yaml',
        `maxLabelChars is ${config.limits.maxLabelChars}; the recommended default is ${RECOMMENDED_MAX_LABEL_CHARS}.`,
        undefined,
        `Set limits.maxLabelChars: ${RECOMMENDED_MAX_LABEL_CHARS} to keep labels readable.`,
      ),
    );
  }

  for (const mapItem of loaded.maps) {
    mapById.set(mapItem.id, mapItem);
    const map = mapItem.map;
    const file = mapItem.file;
    if (!/^[a-z0-9][a-z0-9/_-]*$/.test(mapItem.id)) {
      errors.push(issue('error', 'E006', file, `Map id "${mapItem.id}" must be lowercase kebab-case (directories allowed).`));
    }
    if (map.phase && !phaseIds.has(map.phase)) {
      errors.push(issue('error', 'E012', file, `Map phase "${map.phase}" is not declared in phases.yaml.`, lineOf(mapItem, ['phase'])));
    }
    if (!map.level) {
      warnings.push(
        issue('warning', 'W115', file, 'Map has no level. Use overview, feature or detail so agents and humans know its place.', undefined, 'Add `level: overview|feature|detail`.'),
      );
    }
    if (!map.summary) {
      warnings.push(issue('warning', 'W111', file, 'Map is missing a summary.', lineOf(mapItem, ['title']), 'Add a one-sentence `summary`.'));
    }

    const ids = duplicateIds(map);
    for (const id of ids) {
      errors.push(issue('error', 'E003', file, `Duplicate id "${id}". IDs must be unique within a map.`, undefined, undefined, 'Rename one item; IDs are stable identifiers.'));
    }

    const evidence = resolveEvidence(project, map, facts);
    evidenceByMap.set(mapItem.id, evidence);
    for (const ev of Object.values(evidence)) {
      if (ev.status === 'verified') stats.verified++;
      else if (ev.status === 'declared') stats.declared++;
      else if (ev.status === 'stale') stats.stale++;
      else stats.planned++;
    }

    const nodeCount =
      map.type === 'graph' ? map.nodes.length : map.type === 'sequence' ? map.participants.length : map.type === 'erd' ? map.entities.length : 0;
    const edgeCount =
      map.type === 'graph' ? map.edges.length : map.type === 'sequence' ? map.steps.length : map.type === 'erd' ? map.relations.length : 0;
    stats.nodes += nodeCount;
    stats.edges += edgeCount;
    const caps = map.level ? config.limits.nodeCaps[map.level] : undefined;
    if (nodeCount > config.limits.hardMaxNodes) {
      errors.push(
        issue(
          'error',
          'E015',
          file,
          `Map has ${nodeCount} nodes, above hard limit ${config.limits.hardMaxNodes}.`,
          undefined,
          'Split it into feature maps and keep the overview small.',
          `vibemap map new <new-id> --level feature`,
        ),
      );
    }
    if (caps && nodeCount > caps.hard) {
      errors.push(
        issue(
          'error',
          'E017',
          file,
          `Map has ${nodeCount} nodes, above the ${map.level} hard cap of ${caps.hard}.`,
          undefined,
          'Split into a feature map and link with `drill`.',
          `vibemap map new <new-id> --level feature`,
        ),
      );
    }
    const softCap = caps?.soft ?? config.limits.softMaxNodes;
    if (nodeCount > softCap) {
      warnings.push(
        issue(
          'warning',
          'W102',
          file,
          `${nodeCount} nodes (soft limit ${softCap}${map.level ? ` for ${map.level}` : ''}). Consider splitting into feature maps.`,
        ),
      );
    }
    if (map.type === 'graph' && map.nodes.length > 0 && map.edges.length / map.nodes.length > config.limits.maxEdgeRatio) {
      errors.push(
        issue(
          'error',
          'E018',
          file,
          `${map.edges.length} edges for ${map.nodes.length} nodes (ratio ${(map.edges.length / map.nodes.length).toFixed(2)}, max ${config.limits.maxEdgeRatio}).`,
          undefined,
          'Remove edges that do not change understanding, or split the map.',
          'vibemap inspect <map>',
        ),
      );
    }
    if (map.type === 'graph') {
      validateGraph(mapItem, map, facts, config, errors, warnings, stats, project.root);
      if (map.nodes.length > 1 && map.edges.length / map.nodes.length > config.limits.warnEdgeRatio) {
        warnings.push(issue('warning', 'W110', file, `${map.edges.length} edges for ${map.nodes.length} nodes (ratio above ${config.limits.warnEdgeRatio}).`, undefined, 'Group related nodes, remove redundant edges, or split the map.'));
      }
      if (map.nodes.length > 0) {
        const connected = new Set<string>();
        for (const edge of map.edges) {
          connected.add(edge.from);
          connected.add(edge.to);
        }
        for (const node of map.nodes) {
          if (!connected.has(node.id)) {
            warnings.push(issue('warning', 'W103', file, `Node "${node.id}" is isolated (no edges).`, lineOf(mapItem, ['nodes', map.nodes.indexOf(node)]), 'Add an edge or remove the node.', 'vibemap patch <map> (add_edge)'));
          }
        }
      }
    } else if (map.type === 'sequence') {
      const participants = new Set(map.participants.map((p) => p.id));
      map.steps.forEach((step, i) => {
        if (!participants.has(step.from)) errors.push(issue('error', 'E016', file, `Step ${i} references unknown participant "${step.from}".`, lineOf(mapItem, ['steps', i, 'from'])));
        if (!participants.has(step.to)) errors.push(issue('error', 'E016', file, `Step ${i} references unknown participant "${step.to}".`, lineOf(mapItem, ['steps', i, 'to'])));
      });
      map.fragments?.forEach((fragment, i) => {
        if (fragment.from_step < 0 || fragment.to_step >= map.steps.length || fragment.from_step > fragment.to_step) {
          errors.push(issue('error', 'E016', file, `Fragment ${i} has an invalid step range ${fragment.from_step}–${fragment.to_step}.`, lineOf(mapItem, ['fragments', i])));
        }
      });
      const labels = new Map<string, number>();
      for (const p of map.participants) labels.set(p.label.toLowerCase(), (labels.get(p.label.toLowerCase()) ?? 0) + 1);
      for (const [label, count] of labels) if (count > 1) warnings.push(issue('warning', 'W109', file, `Duplicate participant label "${label}".`));
    } else if (map.type === 'erd') {
      const entities = new Map(map.entities.map((e) => [e.id, e]));
      map.relations.forEach((relation, i) => {
        if (!entities.has(relation.from)) errors.push(issue('error', 'E016', file, `Relation references unknown entity "${relation.from}".`, lineOf(mapItem, ['relations', i, 'from'])));
        if (!entities.has(relation.to)) errors.push(issue('error', 'E016', file, `Relation references unknown entity "${relation.to}".`, lineOf(mapItem, ['relations', i, 'to'])));
      });
      map.entities.forEach((entity, i) => {
        const fieldNames = new Set<string>();
        for (const field of entity.fields) {
          if (fieldNames.has(field.name)) errors.push(issue('error', 'E003', file, `Entity "${entity.id}" has duplicate field "${field.name}".`, lineOf(mapItem, ['entities', i, 'fields'])));
          fieldNames.add(field.name);
          if (field.ref) {
            const [entityId, fieldName] = field.ref.split('.');
            const target = entityId ? entities.get(entityId) : undefined;
            if (!target || (fieldName && !target.fields.some((f) => f.name === fieldName))) {
              errors.push(issue('error', 'E016', file, `Field ${entity.id}.${field.name} references unknown field "${field.ref}".`, lineOf(mapItem, ['entities', i, 'fields'])));
            }
          }
        }
      });
    } else if (map.type === 'mermaid') {
      const trimmed = map.source.trim();
      const first = trimmed.split('\n').find((l) => l.trim() && !l.trim().startsWith('%%'))?.trim() ?? '';
      const keywords = [
        'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'erDiagram', 'stateDiagram', 'gantt', 'pie', 'journey',
        'mindmap', 'timeline', 'quadrantChart', 'xychart', 'block-beta', 'architecture-beta', 'C4Context', 'sankey-beta',
      ];
      if (!keywords.some((k) => first.startsWith(k))) {
        errors.push(issue('error', 'E010', file, `Mermaid source does not start with a known diagram keyword (found "${first.slice(0, 32)}").`));
      }
    }

    // map.notes references
    for (const note of map.notes ?? []) {
      const rel = toPosix(path.join('.vibemap/notes', note));
      if (!fs.existsSync(path.join(project.root, rel))) {
        errors.push(issue('error', 'E011', file, `Map note reference "${note}" does not exist under .vibemap/notes/.`, lineOf(mapItem, ['notes'])));
      }
    }

    // phase on graph nodes
    if (map.type === 'graph') {
      map.nodes.forEach((node, i) => {
        if (node.phase && !phaseIds.has(node.phase)) {
          errors.push(issue('error', 'E012', file, `Node "${node.id}" phase "${node.phase}" is not declared in phases.yaml.`, lineOf(mapItem, ['nodes', i, 'phase'])));
        }
      });
    }

    // locked nodes: detect modification or deletion
    if (map.type === 'graph') {
      const nodeById = new Map(map.nodes.map((n) => [n.id, n]));
      for (const key of Object.keys(locks.locks)) {
        const [lockMap, lockNode] = key.split('#');
        if (lockMap !== mapItem.id || !lockNode) continue;
        const node = nodeById.get(lockNode);
        if (!node) {
          errors.push(
            issue('error', 'E009', file, `Locked node "${lockNode}" was removed. Unlock it first with \`vibemap unlock ${mapItem.id}#${lockNode}\`.`, undefined, 'Restore the node or remove the lock deliberately.'),
          );
        } else if (lockStatus(locks, mapItem.id, node) === 'modified') {
          errors.push(
            issue(
              'error',
              'E009',
              file,
              `Node "${lockNode}" is locked by a human edit but its content changed.`,
              lineOf(mapItem, ['nodes', map.nodes.indexOf(node)]),
              'Propose the change in your reply, or ask the user to unlock it.',
              `vibemap unlock ${mapItem.id}#${lockNode}`,
            ),
          );
        }
      }
    }

    // layout sidecar
    try {
      const layoutRel = toPosix(path.join('.vibemap/layouts', `${mapItem.id}.layout.json`));
      const layoutAbs = path.join(project.root, layoutRel);
      if (fs.existsSync(layoutAbs)) {
        const raw = readJsonFile<unknown>(layoutAbs);
        const parsed = LayoutSidecarSchema.safeParse(raw);
        if (!parsed.success) {
          errors.push(issue('error', 'E014', layoutRel, `Layout sidecar is malformed: ${parsed.error.issues[0]?.message ?? 'invalid JSON'}`));
        } else if (parsed.data.map !== mapItem.id) {
          errors.push(issue('error', 'E014', layoutRel, `Layout sidecar says map "${parsed.data.map}" but lives at "${mapItem.id}".`));
        } else if (map.type === 'graph') {
          const known = new Set(map.nodes.map((n) => n.id));
          for (const id of Object.keys(parsed.data.nodes)) {
            if (!known.has(id)) {
              warnings.push(issue('warning', 'W-LAYOUT', layoutRel, `Sidecar entry for deleted node "${id}" will be pruned.`, undefined, 'vibemap check --fix'));
            }
          }
        }
      }
    } catch (err) {
      errors.push(issue('error', 'E014', `.vibemap/layouts/${mapItem.id}.layout.json`, (err as Error).message));
    }
  }

  // W108: pending drift recorded by hooks / `vibemap drift`.
  for (const drift of pendingDriftWarnings(project, loaded.maps.map((m) => ({ id: m.id, map: m.map })))) {
    warnings.push(
      issue(
        'warning',
        'W108',
        `.vibemap/maps/${drift.map}.vmap.yaml`,
        `Drift: referenced files changed but this map was not updated (${drift.files.slice(0, 4).join(', ')}${drift.files.length > 4 ? '…' : ''}).`,
        undefined,
        'Update the map with `vibemap patch`, then run `vibemap drift` again.',
      ),
    );
  }

  // Orphan layout files
  for (const rel of layoutFiles(project)) {
    const id = mapIdFromLayoutFile(rel);
    if (!mapById.has(id)) {
      warnings.push(issue('warning', 'W-LAYOUT', rel, `Layout sidecar exists for unknown map "${id}".`, undefined, 'Delete it or recreate the map.'));
    }
  }

  // Notes
  for (const rel of listNotes(project, false).map((n) => n.path)) {
    const parsed = parseNote(project, rel);
    for (const msg of parsed.issues) errors.push(issue('error', 'E011', rel, `Note frontmatter: ${msg}`));
    if (parsed.issues.length) continue;
    for (const ref of noteReferences(parsed.entry)) {
      const target = mapById.get(ref.map);
      if (!target) {
        errors.push(issue('error', 'E011', rel, `Note references unknown map "${ref.map}".`, undefined, 'Fix the map id in frontmatter or wiki links.'));
        continue;
      }
      if (ref.node) {
        const ids = nodeIndexes(target.map);
        if (!ids.has(ref.node)) {
          errors.push(issue('error', 'E011', rel, `Note references unknown node "${ref.map}#${ref.node}".`));
        }
      }
    }
  }

  // Change entries (surface malformed files too, not just valid ones).
  const validChanges = [];
  for (const rel of listChangeFiles(project)) {
    const parsedChange = parseChange(project, rel);
    if (!parsedChange.entry) {
      errors.push(issue('error', 'E002', rel, `Change entry is malformed: ${parsedChange.issues[0] ?? 'unknown error'}`));
      continue;
    }
    validChanges.push(parsedChange.entry);
  }
  for (const change of validChanges) {
    for (const mapId of change.maps) {
      if (!mapById.has(mapId)) {
        errors.push(issue('error', 'E011', change.file, `Change entry references unknown map "${mapId}".`));
      }
    }
    if (change.phase && !phaseIds.has(change.phase)) {
      errors.push(issue('error', 'E012', change.file, `Change entry phase "${change.phase}" is not declared in phases.yaml.`));
    }
    const why = getSection(change.body, 'Why');
    if (!why || why.toLowerCase() === change.title.toLowerCase()) {
      warnings.push(issue('warning', 'W-CHANGE', change.file, 'Change entry "Why" is missing or just repeats the title.', undefined, 'Explain the reason for the change in one or two sentences.'));
    }
  }

  // Coverage + W113
  const coverage = coverageReport(
    loaded.maps.map((m) => ({ id: m.id, map: m.map, evidence: evidenceByMap.get(m.id) })),
    facts,
    config.coverage.target,
    (p) => {
      const file = facts.files.find((f) => f.path === p);
      return !!file && (isCodeLanguage(file.lang) || file.lang === 'prisma');
    },
  );
  stats.coverage = coverage.percent;
  if (coverage.totalFiles > 0 && coverage.percent < config.coverage.target) {
    warnings.push(
      issue(
        'warning',
        'W113',
        '.vibemap/config.yaml',
        `Coverage is ${coverage.percent}% (target ${config.coverage.target}%). ${coverage.unmapped.length} source files are not on any map.`,
        undefined,
        'Run `vibemap suggest` and map the highest-value files first.',
      ),
    );
  }

  const sortIssues = (a: Issue, b: Issue): number =>
    a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0) || a.code.localeCompare(b.code);
  errors.sort(sortIssues);
  warnings.sort(sortIssues);
  const strict = opts.strict ?? config.validation.strict;
  return {
    ok: errors.length === 0 && !(strict && warnings.length > 0),
    errors,
    warnings,
    stats,
    generatedAt: new Date().toISOString(),
  };
}

function validateGraph(
  mapItem: LoadedMap,
  map: GraphMap,
  facts: ReturnType<typeof ensureFacts>,
  config: Project['config'],
  errors: Issue[],
  warnings: Issue[],
  stats: CheckStats,
  root: string,
): void {
  const file = mapItem.file;
  const nodeById = new Map(map.nodes.map((n) => [n.id, n]));
  const groupIds = new Set((map.groups ?? []).map((g) => g.id));
  const seenEdgeIds = new Set<string>();

  map.nodes.forEach((node, index) => {
    const refs = node.refs ?? [];
    if (node.group && !groupIds.has(node.group)) {
      errors.push(issue('error', 'E005', file, `Node "${node.id}" references unknown group "${node.group}".`, lineOf(mapItem, ['nodes', index, 'group'])));
    }
    if (node.label.length > config.limits.maxLabelChars) {
      warnings.push(issue('warning', 'W101', file, `Label "${node.label}" is ${node.label.length} chars (max ${config.limits.maxLabelChars}).`, lineOf(mapItem, ['nodes', index, 'label'])));
    }
    if ((node.description?.length ?? 0) > config.limits.maxDescriptionChars) {
      warnings.push(issue('warning', 'W105', file, `Node "${node.id}" description is ${node.description!.length} chars (max ${config.limits.maxDescriptionChars}). Move detail to a note.`, lineOf(mapItem, ['nodes', index, 'description'])));
    }
    if (config.validation.requireRefs && REF_REQUIRED_KINDS.has(node.kind) && node.status !== 'planned' && refs.length === 0) {
      warnings.push(issue('warning', 'W104', file, `Node "${node.id}" (${node.kind}) has no refs. Point at real code or mark it planned.`, lineOf(mapItem, ['nodes', index])));
    }
    if (node.status === 'built' && refs.length === 0) {
      warnings.push(issue('warning', 'W107', file, `Node "${node.id}" is built but has no refs.`));
    }
    const allRefsExist =
      refs.length > 0 &&
      refs.every((ref) => {
        try {
          return fs.existsSync(path.join(root, ref.path));
        } catch {
          return false;
        }
      });
    if (node.status === 'planned' && allRefsExist) {
      warnings.push(issue('warning', 'W106', file, `Node "${node.id}" is planned but its refs now resolve. Flip status to built.`, lineOf(mapItem, ['nodes', index, 'status'])));
    }
    refs.forEach((ref, refIndex) => {
      const abs = path.join(root, ref.path);
      if (!fs.existsSync(abs)) {
        errors.push(
          issue(
            'error',
            'E007',
            file,
            `Node "${node.id}" ref path "${ref.path}" does not exist.`,
            lineOf(mapItem, ['nodes', index, 'refs', refIndex, 'path']),
            'File moved? Check `git log --follow` or the scanner facts.',
            'update_node refs',
          ),
        );
        return;
      }
      if (ref.symbol) {
        const fact = facts.files.find((f) => f.path === ref.path);
        if (fact && SUPPORTED_SYMBOL_LANGS.has(fact.lang) && !fact.symbols.some((s) => s.name === ref.symbol)) {
          errors.push(
            issue(
              'error',
              'E008',
              file,
              `Symbol "${ref.symbol}" was not found in ${ref.path}.`,
              lineOf(mapItem, ['nodes', index, 'refs', refIndex, 'symbol']),
              'Symbols are checked by the scanner. Update the ref or the node.',
              'update_node refs',
            ),
          );
        }
      }
    });
  });

  const labelCounts = new Map<string, number>();
  for (const node of map.nodes) labelCounts.set(node.label.toLowerCase(), (labelCounts.get(node.label.toLowerCase()) ?? 0) + 1);
  for (const [label, count] of labelCounts) {
    if (count > 1) warnings.push(issue('warning', 'W109', file, `Duplicate label "${label}" in this map.`));
  }

  const duplicateEdgeKeys = new Set<string>();
  map.edges.forEach((edge, index) => {
    if (!nodeById.has(edge.from)) {
      errors.push(issue('error', 'E004', file, `Edge "from" references unknown node "${edge.from}".`, lineOf(mapItem, ['edges', index, 'from']), suggestNode(edge.from, [...nodeById.keys()])));
    }
    if (!nodeById.has(edge.to)) {
      errors.push(issue('error', 'E004', file, `Edge "to" references unknown node "${edge.to}".`, lineOf(mapItem, ['edges', index, 'to']), suggestNode(edge.to, [...nodeById.keys()])));
    }
    if (edge.id) {
      if (!/^[a-z][a-z0-9-]{0,47}$/.test(edge.id)) {
        errors.push(issue('error', 'E006', file, `Edge id "${edge.id}" is not kebab-case.`, lineOf(mapItem, ['edges', index, 'id'])));
      }
      if (seenEdgeIds.has(edge.id)) errors.push(issue('error', 'E003', file, `Duplicate edge id "${edge.id}".`));
      seenEdgeIds.add(edge.id);
    }
    const key = `${edge.from}|${edge.to}|${edge.kind}`;
    if (duplicateEdgeKeys.has(key)) {
      warnings.push(issue('warning', 'W112', file, `Duplicate edge ${edge.from} → ${edge.to} (${edge.kind}).`, lineOf(mapItem, ['edges', index])));
    }
    duplicateEdgeKeys.add(key);
    if (edge.label && edge.label.length > config.limits.maxLabelChars) {
      warnings.push(
        issue(
          'warning',
          'W101',
          file,
          `Edge label "${edge.label}" is ${edge.label.length} chars (max ${config.limits.maxLabelChars}).`,
          lineOf(mapItem, ['edges', index, 'label']),
          'Use a short verb phrase and put detail in a note.',
        ),
      );
    }
  });

  // Content-density rules (no layout required).
  const degree = new Map<string, number>();
  for (const edge of map.edges) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }
  const hub = map.nodes.find((node) => (degree.get(node.id) ?? 0) > config.limits.maxDegree);
  if (hub) {
    warnings.push(
      issue(
        'warning',
        'W120',
        file,
        `Node "${hub.id}" has ${degree.get(hub.id)} connections (max ${config.limits.maxDegree}).`,
        lineOf(mapItem, ['nodes', map.nodes.indexOf(hub)]),
        'Hub node. Group its targets and connect to the group once, or split.',
      ),
    );
  }

  const labelledEdges = map.edges.filter((edge) => !!edge.label?.trim()).length;
  if (map.edges.length > 0 && labelledEdges / map.edges.length > config.limits.maxLabelledEdgesRatio) {
    warnings.push(
      issue(
        'warning',
        'W122',
        file,
        `${labelledEdges} of ${map.edges.length} edges are labelled (max ${Math.round(config.limits.maxLabelledEdgesRatio * 100)}%).`,
        undefined,
        'Keep labels only where the relationship is not obvious.',
      ),
    );
  }

  const groupCount = map.groups?.length ?? 0;
  if (groupCount > config.limits.maxGroups) {
    warnings.push(
      issue(
        'warning',
        'W123',
        file,
        `Map has ${groupCount} groups (max ${config.limits.maxGroups}).`,
        lineOf(mapItem, ['groups', config.limits.maxGroups]),
        'Merge groups or split the map.',
      ),
    );
  }

  const ranks = rankGraph(map);
  const rankDepth = Math.max(0, ...map.nodes.map((node) => ranks.get(node.id) ?? 0));
  if (rankDepth > config.limits.maxRankDepth) {
    warnings.push(
      issue(
        'warning',
        'W124',
        file,
        `Rank depth is ${rankDepth + 1} layers (max ${config.limits.maxRankDepth}).`,
        undefined,
        'Long chain. Use a sequence map or split.',
      ),
    );
  }

  const processLike = map.nodes.filter((node) => node.kind === 'process' || node.kind === 'file').length;
  if (
    map.nodes.length > 0 &&
    processLike / map.nodes.length >= 0.6 &&
    rankDepth + 1 >= map.nodes.length * 0.7
  ) {
    warnings.push(
      issue(
        'warning',
        'W125',
        file,
        `${processLike} of ${map.nodes.length} nodes are process/file and the longest path covers most of the map.`,
        undefined,
        'Use `type: sequence` or a `down` flow of 8 steps or fewer.',
      ),
    );
  }

  const crossGroupEdges = map.edges.filter((edge) => {
    const fromGroup = nodeById.get(edge.from)?.group;
    const toGroup = nodeById.get(edge.to)?.group;
    return fromGroup !== toGroup;
  }).length;
  if (map.edges.length > 0 && crossGroupEdges / map.edges.length > 0.5) {
    warnings.push(
      issue(
        'warning',
        'W126',
        file,
        `${crossGroupEdges} of ${map.edges.length} edges cross groups (over 50%).`,
        undefined,
        'Groups do not match the real structure. Regroup.',
      ),
    );
  }

  const longEdgeIndex = map.edges.findIndex(
    (edge) => Math.abs((ranks.get(edge.to) ?? 0) - (ranks.get(edge.from) ?? 0)) > 2,
  );
  if (longEdgeIndex >= 0) {
    const edge = map.edges[longEdgeIndex]!;
    warnings.push(
      issue(
        'warning',
        'W127',
        file,
        `Edge ${edge.from} → ${edge.to} spans more than two ranks.`,
        lineOf(mapItem, ['edges', longEdgeIndex]),
        'Long edge. Consider an intermediate node or remove it.',
      ),
    );
  }

  const groupDupes = new Set<string>();
  const seenGroups = new Set<string>();
  for (const group of map.groups ?? []) {
    if (seenGroups.has(group.id)) groupDupes.add(group.id);
    seenGroups.add(group.id);
  }
  for (const id of groupDupes) errors.push(issue('error', 'E003', file, `Duplicate group id "${id}".`));
}

function suggestNode(missing: string, known: string[]): string | undefined {
  const close = known
    .map((id) => ({ id, score: levenshtein(missing, id) }))
    .sort((a, b) => a.score - b.score)[0];
  return close && close.score <= 3 ? `Did you mean "${close.id}"?` : undefined;
}

export function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length]![b.length]!;
}

/** Convenience used by CLI/serve to validate after a write. */
export function checkProject(root: string, opts: CheckOptions = {}): CheckReport {
  const project = tryLoadProject(root);
  if (!project) throw new Error(`No .vibemap/ in ${root}. Run \`vibemap init\`.`);
  return validateProject(project, opts);
}

export function formatIssue(issueItem: Issue): string {
  const icon = issueItem.severity === 'error' ? '✖' : '⚠';
  const loc = issueItem.line ? `${issueItem.file}:${issueItem.line}` : issueItem.file;
  return `${icon} ${issueItem.code} ${loc}  ${issueItem.message}${issueItem.hint ? `\n   ${issueItem.hint}` : ''}${issueItem.fix ? `\n   fix: ${issueItem.fix}` : ''}`;
}

export function formatReport(report: CheckReport, max = 100): string {
  const lines: string[] = [];
  for (const err of report.errors.slice(0, max)) lines.push(formatIssue(err));
  for (const warn of report.warnings.slice(0, max)) lines.push(formatIssue(warn));
  const summary = `${report.errors.length} error${report.errors.length === 1 ? '' : 's'}, ${report.warnings.length} warning${report.warnings.length === 1 ? '' : 's'}.`;
  lines.push(summary);
  if (report.errors.length || report.warnings.length) {
    lines.push('Run `vibemap check --json` for machine output, or `vibemap check --fix` for safe fixes.');
  }
  return lines.join('\n');
}
