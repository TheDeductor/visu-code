import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import type {
  LockFile,
  MapLayoutSidecar,
  PhasesFile,
  ProjectConfig,
  ProjectInfo,
  Theme,
} from './types.js';
import { DEFAULT_PORT, MAPS_DIR, SCHEMA_VERSION } from './types.js';
import { defaultConfig, defaultTheme } from './defaults.js';
import { ConfigSchema, LayoutSidecarSchema, LockFileSchema, PhasesSchema, ThemeSchema } from './schema.js';
import {
  layoutFileFromId,
  listMapIds as listMapIdsFromFs,
  mapFileFromId,
  normalizeRelPath,
  resolveInside,
  toPosix,
} from './paths.js';
import { parseYamlFile, readJsonFile, readTextIfExists, stringifyYaml, writeFileAtomic } from './yaml.js';

export class ProjectError extends Error {
  readonly hint?: string;

  constructor(message: string, hint?: string) {
    super(message);
    this.name = 'ProjectError';
    this.hint = hint;
  }
}

export interface Project {
  root: string;
  vibemapDir: string;
  configPath: string;
  themePath: string;
  phasesPath: string;
  locksPath: string;
  config: ProjectConfig;
  theme: Theme;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override === undefined ? base : override) as T;
  }
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

export function formatZodError(err: z.ZodError, file: string): string {
  return err.issues
    .map((issue) => {
      const at = issue.path.length ? issue.path.join('.') : '(root)';
      return `${file}:${at} — ${issue.message}`;
    })
    .join('\n');
}

export function requireVibemapDir(root: string): string {
  const dir = path.join(root, MAPS_DIR);
  if (!fs.existsSync(dir)) {
    throw new ProjectError(
      `No .vibemap/ folder found in ${root}`,
      'Run `vibemap init` first (or pass --root to the project root).',
    );
  }
  return dir;
}

export function loadConfig(root: string): ProjectConfig {
  const runName = path.basename(path.resolve(root)) || 'my-app';
  const file = path.join(root, MAPS_DIR, 'config.yaml');
  const fallback = defaultConfig(runName);
  const text = readTextIfExists(file);
  if (text === null) return fallback;
  let raw: unknown;
  try {
    raw = parseYamlFile<Record<string, unknown>>(file).data;
  } catch (err) {
    throw new ProjectError(`Invalid .vibemap/config.yaml: ${(err as Error).message}`, 'Fix the YAML or delete it to use defaults.');
  }
  const merged = deepMerge(fallback, raw);
  const parsed = ConfigSchema.safeParse(merged);
  if (!parsed.success) {
    throw new ProjectError(`Invalid .vibemap/config.yaml:\n${formatZodError(parsed.error, file)}`);
  }
  return parsed.data as ProjectConfig;
}

export function loadTheme(root: string): Theme {
  const file = path.join(root, MAPS_DIR, 'theme.yaml');
  const fallback = defaultTheme();
  const text = readTextIfExists(file);
  if (text === null) return fallback;
  let raw: unknown;
  try {
    raw = parseYamlFile<Record<string, unknown>>(file).data;
  } catch (err) {
    throw new ProjectError(`Invalid .vibemap/theme.yaml: ${(err as Error).message}`);
  }
  const parsed = ThemeSchema.safeParse(deepMerge(fallback, raw));
  if (!parsed.success) {
    throw new ProjectError(`Invalid .vibemap/theme.yaml:\n${formatZodError(parsed.error, file)}`);
  }
  return parsed.data as Theme;
}

export function loadProject(root = process.cwd()): Project {
  const abs = path.resolve(root);
  const vibemapDir = requireVibemapDir(abs);
  return {
    root: abs,
    vibemapDir,
    configPath: path.join(vibemapDir, 'config.yaml'),
    themePath: path.join(vibemapDir, 'theme.yaml'),
    phasesPath: path.join(vibemapDir, 'phases.yaml'),
    locksPath: path.join(vibemapDir, 'locks.json'),
    config: loadConfig(abs),
    theme: loadTheme(abs),
  };
}

export function tryLoadProject(root: string): Project | null {
  try {
    return loadProject(root);
  } catch {
    return null;
  }
}

export function listMapIds(project: Project): string[] {
  return listMapIdsFromFs(project.vibemapDir);
}

export function listMapFiles(project: Project): string[] {
  return listMapIds(project).map((id) => mapFileFromId(id));
}

export function readPhases(project: Project): PhasesFile {
  const text = readTextIfExists(project.phasesPath);
  if (text === null) return { schema: SCHEMA_VERSION, phases: [] };
  const data = parseYamlFile<unknown>(project.phasesPath).data;
  const parsed = PhasesSchema.safeParse(data);
  if (!parsed.success) {
    throw new ProjectError(`Invalid .vibemap/phases.yaml:\n${formatZodError(parsed.error, project.phasesPath)}`);
  }
  return parsed.data as PhasesFile;
}

export async function writePhases(project: Project, phases: PhasesFile): Promise<void> {
  const parsed = PhasesSchema.parse(phases);
  await writeFileAtomic(project.phasesPath, stringifyYaml(parsed));
}

export function readLocks(project: Project): LockFile {
  const raw = readJsonFile<unknown>(project.locksPath);
  if (!raw) return { schema: SCHEMA_VERSION, locks: {} };
  const parsed = LockFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ProjectError(`Invalid .vibemap/locks.json:\n${formatZodError(parsed.error, project.locksPath)}`);
  }
  return parsed.data as LockFile;
}

export async function writeLocks(project: Project, locks: LockFile): Promise<void> {
  const parsed = LockFileSchema.parse(locks);
  await writeFileAtomic(project.locksPath, `${JSON.stringify(parsed, null, 2)}\n`);
}

export function layoutPath(project: Project, mapId: string): string {
  return path.join(project.root, layoutFileFromId(mapId));
}

export function readLayout(project: Project, mapId: string): MapLayoutSidecar | null {
  const file = layoutPath(project, mapId);
  const raw = readJsonFile<unknown>(file);
  if (!raw) return null;
  const parsed = LayoutSidecarSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ProjectError(`Invalid layout sidecar ${toPosix(path.relative(project.root, file))}:\n${formatZodError(parsed.error, file)}`);
  }
  return parsed.data as MapLayoutSidecar;
}

export async function writeLayout(project: Project, mapId: string, layout: MapLayoutSidecar): Promise<void> {
  const parsed = LayoutSidecarSchema.parse(layout);
  const file = layoutPath(project, mapId);
  await writeFileAtomic(file, `${JSON.stringify(parsed, null, 2)}\n`);
}

export function emptyLayout(mapId: string): MapLayoutSidecar {
  return { schema: SCHEMA_VERSION, map: mapId, nodes: {}, groups: {}, annotations: [], viewport: { x: 0, y: 0, zoom: 1 } };
}

export function gitInfo(root: string): ProjectInfo['git'] {
  const exec = (args: string[]): string =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    exec(['rev-parse', '--is-inside-work-tree']);
  } catch {
    return { available: false };
  }
  try {
    const branch = exec(['rev-parse', '--abbrev-ref', 'HEAD']) || undefined;
    const head = exec(['rev-parse', '--short', 'HEAD']) || undefined;
    const dirty = exec(['status', '--porcelain']).length > 0;
    return { available: true, branch, head, dirty };
  } catch {
    return { available: true, dirty: false };
  }
}

export function projectInfo(project: Project, version = '0.1.0'): ProjectInfo {
  const maps = listMapIds(project);
  const info: ProjectInfo = {
    root: project.root,
    name: project.config.project.name,
    config: project.config,
    theme: project.theme,
    git: gitInfo(project.root),
    hasMaps: maps.length > 0,
    versions: { vibemap: version, schema: SCHEMA_VERSION, node: process.version },
  };
  return info;
}

export function safeProjectFile(project: Project, rel: string): string {
  return resolveInside(project.root, normalizeRelPath(rel));
}

export const configPort = (config: ProjectConfig): number => config.viewer.port || DEFAULT_PORT;
