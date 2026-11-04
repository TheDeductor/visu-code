import path from 'node:path';
import fs from 'node:fs';
import { MAP_SUFFIX, MAPS_DIR } from './types.js';

/** Convert Windows separators to POSIX separators for all data that lands in files. */
export function toPosix(p: string): string {
  return p.replace(/\\/g, '/');
}

export function normalizeRelPath(p: string): string {
  const posix = toPosix(p).replace(/^\.\//, '');
  const normalized = path.posix.normalize(posix);
  return normalized === '.' ? '' : normalized;
}

export function isSafeRelPath(rel: string): boolean {
  if (!rel || rel.includes('\0')) return false;
  if (path.posix.isAbsolute(rel) || /^[a-zA-Z]:/.test(rel)) return false;
  const norm = normalizeRelPath(rel);
  return norm !== '..' && !norm.startsWith('../');
}

export function assertSafeRelPath(rel: string): string {
  if (!isSafeRelPath(rel)) throw new Error(`Unsafe relative path: ${rel}`);
  return normalizeRelPath(rel);
}

/** Resolve a repo-relative path and guarantee it stays inside root. */
export function resolveInside(root: string, rel: string): string {
  const safe = assertSafeRelPath(rel);
  const rootAbs = path.resolve(root);
  const abs = path.resolve(rootAbs, safe);
  const relative = path.relative(rootAbs, abs);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path escapes project root: ${rel}`);
  }
  return abs;
}

/** Stronger containment check that also follows symlinks for existing paths. */
export function resolveInsideReal(root: string, rel: string): string {
  const abs = resolveInside(root, rel);
  const rootReal = fs.existsSync(root) ? fs.realpathSync.native(root) : path.resolve(root);
  if (fs.existsSync(abs)) {
    const real = fs.realpathSync.native(abs);
    const relative = path.relative(rootReal, real);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Path escapes project root through a symlink: ${rel}`);
    }
    return real;
  }
  // For missing files, verify the nearest existing ancestor is still inside.
  let parent = path.dirname(abs);
  while (!fs.existsSync(parent) && parent !== path.dirname(parent)) parent = path.dirname(parent);
  const realParent = fs.realpathSync.native(parent);
  const relative = path.relative(rootReal, realParent);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path escapes project root through a symlink: ${rel}`);
  }
  return abs;
}

/** List map ids under <vibemapDir>/maps, sorted for deterministic output. */
export function listMapIds(vibemapDir: string): string[] {
  const mapsDir = path.join(vibemapDir, 'maps');
  if (!fs.existsSync(mapsDir)) return [];
  const ids: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        walk(abs, prefix ? `${prefix}/${entry.name}` : entry.name);
      } else if (entry.isFile() && entry.name.endsWith(MAP_SUFFIX)) {
        ids.push(prefix ? `${prefix}/${entry.name.slice(0, -MAP_SUFFIX.length)}` : entry.name.slice(0, -MAP_SUFFIX.length));
      }
    }
  };
  walk(mapsDir, '');
  return ids.sort((a, b) => a.localeCompare(b));
}

export function mapIdFromFile(rel: string): string {
  const norm = normalizeRelPath(rel);
  const prefix = `${MAPS_DIR}/maps/`;
  if (!norm.startsWith(prefix) || !norm.endsWith(MAP_SUFFIX)) {
    throw new Error(`Not a map file: ${rel}`);
  }
  return norm.slice(prefix.length, -MAP_SUFFIX.length);
}

export function mapFileFromId(id: string): string {
  const clean = normalizeRelPath(id);
  if (!clean || clean.startsWith('/') || clean.includes('..')) {
    throw new Error(`Invalid map id: ${id}`);
  }
  return `${MAPS_DIR}/maps/${clean}${MAP_SUFFIX}`;
}

export function layoutFileFromId(id: string): string {
  const clean = normalizeRelPath(id);
  if (!clean || clean.startsWith('/') || clean.includes('..')) {
    throw new Error(`Invalid map id: ${id}`);
  }
  return `${MAPS_DIR}/layouts/${clean}.layout.json`;
}

export function vibemapPath(root: string, ...parts: string[]): string {
  return path.join(root, MAPS_DIR, ...parts);
}

/** Walk up from cwd until a .vibemap folder is found. */
export function findProjectRoot(start = process.cwd()): string | null {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, MAPS_DIR))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function findGitRoot(start = process.cwd()): string | null {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function slugify(input: string, max = 48): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (slug || 'node').slice(0, max).replace(/-$/, '');
}

const SECRET_BASENAMES = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.npmrc',
  '.pypirc',
  'id_rsa',
  'id_dsa',
  'id_ecdsa',
  'id_ed25519',
  'credentials',
  'credentials.json',
  'secrets.json',
  'secrets.yaml',
  'secrets.yml',
]);

export function isSecretFile(rel: string): boolean {
  const base = path.posix.basename(toPosix(rel)).toLowerCase();
  if (SECRET_BASENAMES.has(base)) return true;
  if (base.startsWith('.env')) return true;
  if (/\.(pem|key|p12|pfx|keystore|jks)$/i.test(base)) return true;
  if (/^(id_rsa|id_dsa|id_ecdsa|id_ed25519)(\.|$)/i.test(base)) return true;
  if (/(^|[-_.])(secret|credential|private-key)([-_.]|$)/i.test(base)) return true;
  return false;
}

export function languageForPath(rel: string): string {
  const ext = path.posix.extname(toPosix(rel)).toLowerCase();
  const map: Record<string, string> = {
    '.ts': 'ts',
    '.tsx': 'tsx',
    '.js': 'js',
    '.jsx': 'jsx',
    '.mjs': 'js',
    '.cjs': 'js',
    '.py': 'py',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
    '.cs': 'csharp',
    '.php': 'php',
    '.rb': 'ruby',
    '.prisma': 'prisma',
    '.json': 'json',
    '.sql': 'sql',
    '.vue': 'vue',
    '.svelte': 'svelte',
    '.md': 'md',
    '.yaml': 'yaml',
    '.yml': 'yaml',
  };
  return map[ext] ?? ext.replace(/^\./, '') ?? 'unknown';
}

export function isCodeLanguage(lang: string): boolean {
  return ['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rust', 'java', 'csharp', 'php', 'ruby', 'vue', 'svelte'].includes(
    lang,
  );
}

export function isTextLanguage(lang: string): boolean {
  return ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'go', 'rust', 'java', 'csharp', 'php', 'ruby', 'vue', 'svelte', 'json', 'sql', 'md', 'yaml', 'yml', 'prisma', 'toml', 'ini', 'env', 'txt'].includes(
    lang,
  );
}

export function relativeToRoot(root: string, abs: string): string {
  return toPosix(path.relative(path.resolve(root), path.resolve(abs)));
}

/** Convert a simple glob (supporting **, *, ?) into a RegExp. */
export function globToRegExp(glob: string): RegExp {
  const norm = toPosix(glob).replace(/^\.\//, '');
  let out = '^';
  for (let i = 0; i < norm.length; i++) {
    const c = norm[i]!;
    if (c === '*') {
      if (norm[i + 1] === '*') {
        const slash = norm[i + 2] === '/';
        out += slash ? '(?:.*/)?' : '.*';
        i += slash ? 2 : 1;
      } else {
        out += '[^/]*';
      }
    } else if (c === '?') {
      out += '[^/]';
    } else if ('\\^$+.|()[]{}'.includes(c)) {
      out += `\\${c}`;
    } else {
      out += c;
    }
  }
  out += '$';
  return new RegExp(out);
}

export function matchesAny(rel: string, patterns: string[]): boolean {
  const norm = toPosix(rel);
  return patterns.some((p) => globToRegExp(p).test(norm));
}

/** True when a path is in scope based on include/exclude configuration. */
export function pathInScope(rel: string, include: string[], exclude: string[]): boolean {
  const norm = toPosix(rel);
  if (exclude.length && matchesAny(norm, exclude)) return false;
  if (!include.length) return true;
  return matchesAny(norm, include);
}

export function withinDirectory(rel: string, dir: string): boolean {
  const norm = toPosix(rel);
  const d = toPosix(dir).replace(/\/$/, '');
  return norm === d || norm.startsWith(`${d}/`);
}
