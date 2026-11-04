import path from 'node:path';
import type {
  EdgeKind,
  Issue,
  MapLevel,
  MapSummary,
  MapType,
  VibeEdge,
  VibeMap,
  VibeNode,
} from './types.js';
import { MapSchema } from './schema.js';
import type { Project } from './project.js';
import { listMapIds } from './project.js';
import { lineForPath, parseYamlText, readText, sha1, type ParsedYaml } from './yaml.js';
import { mapFileFromId, toPosix } from './paths.js';
import type { z } from 'zod';

export interface LoadedMap {
  id: string;
  /** Repo-relative path using forward slashes. */
  file: string;
  abs: string;
  content: string;
  rev: string;
  map: VibeMap;
  doc: ParsedYaml['doc'];
  lineCounter: ParsedYaml['lineCounter'];
}

export interface MapLoadError {
  id: string;
  file: string;
  content?: string;
  issues: Issue[];
}

export interface LoadAllResult {
  maps: LoadedMap[];
  errors: MapLoadError[];
}

const FORBIDDEN_FIELDS = new Set([
  'evidence',
  'x',
  'y',
  'w',
  'h',
  'color',
  'colour',
  'fill',
  'style',
  'position',
  'layout',
  'seed',
  'rev',
  'elements',
]);

function lineAt(parsed: ParsedYaml, logicalPath: Array<string | number>): number | undefined {
  return lineForPath(parsed.doc, parsed.lineCounter, logicalPath);
}

function makeIssue(
  code: string,
  severity: Issue['severity'],
  file: string,
  message: string,
  line?: number,
  hint?: string,
  fix?: string,
): Issue {
  return { code, severity, file, line, message, hint, fix };
}

/** Translate Zod issues to friendly validator issues, including line numbers where possible. */
export function zodIssuesToIssues(
  issues: z.ZodIssue[],
  file: string,
  parsed: ParsedYaml | null,
  forbidden?: Set<string>,
): Issue[] {
  const out: Issue[] = [];
  for (const issue of issues) {
    const key = issue.path.length ? String(issue.path[issue.path.length - 1]) : '';
    if (forbidden?.has(key)) {
      const line = parsed ? lineAt(parsed, issue.path as Array<string | number>) : undefined;
      out.push(
        makeIssue(
          'E013',
          'error',
          file,
          `Forbidden field "${key}" — layout, style and evidence fields are tool-computed.`,
          line,
          'Agents describe meaning (labels, nodes, edges, refs). The tool owns coordinates, colours and evidence.',
          `remove "${key}"`,
        ),
      );
      continue;
    }
    const line = parsed ? lineAt(parsed, issue.path as Array<string | number>) : undefined;
    const at = issue.path.length ? issue.path.join('.') : '(root)';
    let message = issue.message;
    if (issue.code === 'unrecognized_keys') {
      const keys = (issue as unknown as { keys: string[] }).keys;
      message = `Unknown field${keys.length > 1 ? 's' : ''} ${keys.map((k) => `"${k}"`).join(', ')}. The schema is strict so typos are caught.`;
    }
    out.push(
      makeIssue(
        'E002',
        'error',
        file,
        `${at}: ${message}`,
        line,
        line ? 'Check the field name, indentation, and value type.' : undefined,
        'vibemap schema --format md',
      ),
    );
  }
  return out;
}

export interface ParseMapResult {
  map?: VibeMap;
  parsed?: ParsedYaml;
  issues: Issue[];
}

export function parseMapContent(content: string, file: string, id = ''): ParseMapResult {
  let parsed: ParsedYaml;
  try {
    parsed = parseYamlText(content, file);
  } catch (err) {
    const e = err as { message: string; line?: number; col?: number };
    return {
      issues: [
        makeIssue('E001', 'error', file, `YAML parse error: ${e.message}`, e.line, 'Check indentation, quotes and merge-conflict markers.'),
      ],
    };
  }
  // Detect forbidden fields anywhere in node/edge-like collections before schema parsing.
  const forbiddenIssues: Issue[] = [];
  const scan = (value: unknown, logical: Array<string | number>, depth: number): void => {
    if (depth > 5 || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => scan(v, [...logical, i], depth + 1));
      return;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_FIELDS.has(key)) {
        const collections = new Set(['nodes', 'edges', 'participants', 'steps', 'entities', 'relations']);
        const applies =
          logical.length === 0 || logical.some((part) => collections.has(String(part)));
        if (applies) {
          forbiddenIssues.push(
            makeIssue(
              'E013',
              'error',
              file,
              `Forbidden field "${key}" — layout, style and evidence fields are tool-computed.`,
              lineAt(parsed, [...logical, key]),
              'Agents describe meaning; the tool owns coordinates, colours and evidence.',
              `remove "${key}"`,
            ),
          );
        }
      }
      scan(child, [...logical, key], depth + 1);
    }
  };
  scan(parsed.data, [], 0);

  const result = MapSchema.safeParse(parsed.data);
  if (!result.success) {
    const issues = zodIssuesToIssues(result.error.issues, file, parsed, FORBIDDEN_FIELDS);
    const filtered = issues.filter(
      (i) => !(i.code === 'E002' && forbiddenIssues.some((f) => f.line && f.line === i.line && f.message.includes('Forbidden field'))),
    );
    return { issues: [...forbiddenIssues, ...filtered], parsed };
  }
  return {
    map: result.data as unknown as VibeMap,
    parsed,
    issues: forbiddenIssues,
  };
}

export function loadMap(project: Project, id: string): LoadedMap {
  const rel = mapFileFromId(id);
  const abs = path.join(project.root, rel);
  const content = readText(abs);
  const parsed = parseMapContent(content, rel, id);
  if (!parsed.map) {
    const first = parsed.issues[0];
    throw new MapValidationError(id, rel, first?.message ?? 'Invalid map', parsed.issues);
  }
  if (!parsed.parsed) throw new MapValidationError(id, rel, 'YAML could not be parsed', parsed.issues);
  return {
    id,
    file: rel,
    abs,
    content,
    rev: sha1(content),
    map: parsed.map,
    doc: parsed.parsed.doc,
    lineCounter: parsed.parsed.lineCounter,
  };
}

export class MapValidationError extends Error {
  readonly id: string;
  readonly file: string;
  readonly issues: Issue[];

  constructor(id: string, file: string, message: string, issues: Issue[]) {
    super(message);
    this.name = 'MapValidationError';
    this.id = id;
    this.file = file;
    this.issues = issues;
  }
}

export function loadAllMaps(project: Project): LoadAllResult {
  const maps: LoadedMap[] = [];
  const errors: MapLoadError[] = [];
  for (const id of listMapIds(project)) {
    const rel = mapFileFromId(id);
    let content: string;
    try {
      content = readText(path.join(project.root, rel));
    } catch (err) {
      errors.push({
        id,
        file: rel,
        issues: [makeIssue('E001', 'error', rel, `Cannot read map: ${(err as Error).message}`)],
      });
      continue;
    }
    const parsed = parseMapContent(content, rel, id);
    if (!parsed.map || !parsed.parsed) {
      // YAML may be valid but schema-invalid; keep content for last-good UI and continue other maps.
      errors.push({ id, file: rel, content, issues: parsed.issues });
      continue;
    }
    maps.push({
      id,
      file: rel,
      abs: path.join(project.root, rel),
      content,
      rev: sha1(content),
      map: parsed.map,
      doc: parsed.parsed.doc,
      lineCounter: parsed.parsed.lineCounter,
    });
  }
  return { maps, errors };
}

export function mapNodeCount(map: VibeMap): number {
  switch (map.type) {
    case 'graph':
      return map.nodes.length;
    case 'sequence':
      return map.participants.length;
    case 'erd':
      return map.entities.length;
    case 'mermaid':
      return 0;
  }
}

export function mapEdgeCount(map: VibeMap): number {
  switch (map.type) {
    case 'graph':
      return map.edges.length;
    case 'sequence':
      return map.steps.length;
    case 'erd':
      return map.relations.length;
    case 'mermaid':
      return 0;
  }
}

export function graphNodes(map: VibeMap): VibeNode[] {
  return map.type === 'graph' ? map.nodes : [];
}

export function graphEdges(map: VibeMap): VibeEdge[] {
  return map.type === 'graph' ? map.edges : [];
}

export function mapSummary(loaded: LoadedMap, errors = 0, warnings = 0): MapSummary {
  return {
    id: loaded.id,
    path: loaded.file,
    title: loaded.map.title,
    type: loaded.map.type as MapType,
    level: loaded.map.level as MapLevel | undefined,
    phase: loaded.map.phase,
    summary: loaded.map.summary,
    nodeCount: mapNodeCount(loaded.map),
    edgeCount: mapEdgeCount(loaded.map),
    rev: loaded.rev,
    errors,
    warnings,
    drift: false,
  };
}

export function edgeKind(map: VibeMap, edge: VibeEdge): EdgeKind | 'step' | 'relation' {
  if (map.type === 'graph') return edge.kind;
  return 'step';
}

export function mapRelativeFile(id: string): string {
  return toPosix(mapFileFromId(id));
}
