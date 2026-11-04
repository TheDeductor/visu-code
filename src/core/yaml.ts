import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  Document,
  LineCounter,
  parseDocument,
  stringify,
  type ParsedNode,
  isMap as isYamlMap,
  isSeq as isYamlSeq,
} from 'yaml';

export class YamlParseError extends Error {
  readonly file: string;
  readonly line?: number;
  readonly col?: number;

  constructor(message: string, file: string, line?: number, col?: number) {
    super(message);
    this.name = 'YamlParseError';
    this.file = file;
    this.line = line;
    this.col = col;
  }
}

export interface ParsedYaml<T = unknown> {
  doc: Document.Parsed<ParsedNode, true>;
  data: T;
  text: string;
  lineCounter: LineCounter;
}

/** Normalise text read from disk: strip BOM, tolerate CRLF, keep a final newline decision to callers. */
export function normalizeText(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function readText(file: string): string {
  return normalizeText(fs.readFileSync(file, 'utf8'));
}

export function readTextIfExists(file: string): string | null {
  try {
    return readText(file);
  } catch {
    return null;
  }
}

export function parseYamlText<T = unknown>(text: string, file = '<yaml>'): ParsedYaml<T> {
  const lineCounter = new LineCounter();
  const doc = parseDocument(normalizeText(text), {
    lineCounter,
    keepSourceTokens: true,
    prettyErrors: true,
    uniqueKeys: true,
  }) as Document.Parsed<ParsedNode, true>;
  if (doc.errors.length > 0) {
    const err = doc.errors[0]!;
    const pos = err.pos ? lineCounter.linePos(err.pos[0]) : undefined;
    throw new YamlParseError(err.message, file, pos?.line, pos?.col);
  }
  const data = doc.toJS({ maxAliasCount: 100 }) as T;
  return { doc, data, text: normalizeText(text), lineCounter };
}

export function parseYamlFile<T = unknown>(file: string): ParsedYaml<T> {
  const text = readText(file);
  return parseYamlText<T>(text, file);
}

/** Find the 1-based line for a logical YAML path such as ['nodes', 0, 'refs', 0, 'path']. */
export function lineForPath(
  doc: Document.Parsed<ParsedNode, true>,
  lineCounter: LineCounter,
  logicalPath: Array<string | number>,
): number | undefined {
  try {
    const node = doc.getIn(logicalPath, true) as ParsedNode | undefined;
    const range = node && 'range' in node ? node.range : undefined;
    if (range && range.length >= 2) {
      return lineCounter.linePos(range[0])?.line;
    }
  } catch {
    // fall through
  }
  return undefined;
}

export function colForPath(
  doc: Document.Parsed<ParsedNode, true>,
  lineCounter: LineCounter,
  logicalPath: Array<string | number>,
): number | undefined {
  try {
    const node = doc.getIn(logicalPath, true) as ParsedNode | undefined;
    const range = node && 'range' in node ? node.range : undefined;
    if (range && range.length >= 2) {
      return lineCounter.linePos(range[0])?.col;
    }
  } catch {
    // fall through
  }
  return undefined;
}

/** List all logical key paths with their starting line. Useful for validator hints. */
export function collectLines(
  doc: Document.Parsed<ParsedNode, true>,
  lineCounter: LineCounter,
  maxDepth = 8,
): Map<string, number> {
  const out = new Map<string, number>();
  const walk = (node: unknown, logical: Array<string | number>, depth: number): void => {
    if (depth > maxDepth) return;
    if (!node || typeof node !== 'object') return;
    const range = (node as { range?: [number, number, number] }).range;
    if (range) {
      const line = lineCounter.linePos(range[0])?.line;
      if (line) out.set(JSON.stringify(logical), line);
    }
    if (isYamlMap(node)) {
      for (const pair of node.items) {
        const key = (pair.key as { value?: unknown } | null)?.value;
        if (key === undefined) continue;
        walk(pair.value, [...logical, String(key)], depth + 1);
      }
    } else if (isYamlSeq(node)) {
      node.items.forEach((item, index) => walk(item, [...logical, index], depth + 1));
    }
  };
  walk(doc.contents, [], 0);
  return out;
}

export function stringifyYaml(value: unknown): string {
  return stringify(value, {
    lineWidth: 0,
    aliasDuplicateObjects: false,
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN',
  });
}

export function createYamlDocument(value: unknown): Document.Parsed<ParsedNode, true> {
  return parseDocument(stringifyYaml(value)) as Document.Parsed<ParsedNode, true>;
}

/**
 * VibeMap files are optimised for git diffs: every collection is block style.
 * YAML documents created by adding to an empty `[]` default to flow style and
 * would otherwise turn a whole map into one enormous line after the first patch.
 */
export function forceBlockStyle(doc: Document): void {
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const collection = node as { flow?: boolean; items?: unknown[]; value?: unknown };
    if ('flow' in collection && (isYamlMap(node) || isYamlSeq(node))) {
      // Empty collections stay as `[]` / `{}`; non-empty ones are block style for diffs.
      collection.flow = (collection.items?.length ?? 0) === 0;
    }
    if (isYamlMap(node)) {
      for (const pair of node.items) {
        visit(pair.key);
        visit(pair.value);
      }
    } else if (isYamlSeq(node)) {
      for (const item of node.items) visit(item);
    }
  };
  visit(doc.contents);
}

export function documentToString(doc: Document): string {
  forceBlockStyle(doc);
  let out = doc.toString({ lineWidth: 0, minContentWidth: 0 });
  if (!out.endsWith('\n')) out += '\n';
  // Our files are always LF, even on Windows.
  return out.replace(/\r\n/g, '\n');
}

/** Atomic write: temp file in the same directory, fsync, rename. */
export async function writeFileAtomic(file: string, content: string): Promise<void> {
  const dir = path.dirname(file);
  await fsp.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  const normalized = content.replace(/\r\n/g, '\n');
  const handle = await fsp.open(tmp, 'w');
  try {
    await handle.writeFile(normalized, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fsp.rename(tmp, file);
  } catch (err) {
    await fsp.rm(tmp, { force: true }).catch(() => undefined);
    throw err;
  }
}

export function writeFileAtomicSync(file: string, content: string): void {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeFileSync(fd, content.replace(/\r\n/g, '\n'), 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.renameSync(tmp, file);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

export function readJsonFile<T>(file: string): T | null {
  try {
    return JSON.parse(readText(file)) as T;
  } catch {
    return null;
  }
}

export function sha1(content: string | Buffer): string {
  return crypto.createHash('sha1').update(content).digest('hex');
}

export function shortHash(content: string | Buffer, length = 8): string {
  return sha1(content).slice(0, length);
}

/** Stable JSON serialisation used for lock hashes and comparisons. */
export function canonicalJson(value: unknown): string {
  const seen = new WeakSet<object>();
  const sort = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') return input;
    if (seen.has(input as object)) return '[circular]';
    seen.add(input as object);
    if (Array.isArray(input)) return input.map(sort);
    const obj = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      if (obj[key] !== undefined) out[key] = sort(obj[key]);
    }
    return out;
  };
  return JSON.stringify(sort(value));
}

export function hashObject(value: unknown): string {
  return sha1(canonicalJson(value));
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

export function countLines(text: string): number {
  if (!text) return 0;
  return text.split('\n').length;
}
