/**
 * Thin CLI entrypoint.
 *
 * The post-edit hook runs after every agent edit and must stay fast. Importing
 * the full CLI (scanner, server, viewer tooling) costs ~1s, so this file handles
 * that one event with Node built-ins only and lazy-loads the real CLI for
 * everything else.
 */
import fs from 'node:fs';
import path from 'node:path';

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    process.stdin.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 1_000_000) return;
      chunks.push(chunk);
    });
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', () => resolve(''));
  });
}

function findRoot(explicit?: string): string | null {
  let dir = path.resolve(explicit ?? process.cwd());
  if (explicit) return fs.existsSync(path.join(dir, '.vibemap')) ? dir : null;
  for (;;) {
    if (fs.existsSync(path.join(dir, '.vibemap'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

async function postEditHook(args: string[]): Promise<boolean> {
  const hookIndex = args.findIndex((arg) => arg === 'hook');
  if (hookIndex === -1 || args[hookIndex + 1] !== 'post-edit') return false;
  const rootFlag = args.indexOf('--root');
  const root = findRoot(rootFlag !== -1 ? args[rootFlag + 1] : undefined);
  if (!root) return true;
  let payload: Record<string, unknown> = {};
  try {
    const raw = await readStdin();
    if (raw.trim()) payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return true;
  }
  const toolInput = (payload.tool_input ?? {}) as Record<string, unknown>;
  const candidate =
    (toolInput.file_path as string | undefined) ??
    (toolInput.path as string | undefined) ??
    (payload.file_path as string | undefined);
  if (!candidate) return true;
  const abs = path.resolve(candidate);
  const rel = path.relative(root, abs).replace(/\\/g, '/');
  if (!rel || rel.startsWith('..') || rel.startsWith('.vibemap/')) return true;
  const pendingFile = path.join(root, '.vibemap', '.cache', 'pending.json');
  const state = (() => {
    try {
      return JSON.parse(fs.readFileSync(pendingFile, 'utf8')) as { files?: string[]; [key: string]: unknown };
    } catch {
      return { schema: 1, generatedAt: new Date().toISOString(), files: [], direct: [], removedRefs: [], unmapped: [] } as {
        files?: string[];
        [key: string]: unknown;
      };
    }
  })();
  const files = new Set<string>(Array.isArray(state.files) ? state.files : []);
  files.add(rel);
  state.files = [...files].sort().slice(-500);
  state.generatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(pendingFile), { recursive: true });
  fs.writeFileSync(pendingFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  process.exitCode = 0;
  return true;
}

const args = process.argv.slice(2);
if (!(await postEditHook(args))) {
  await import('./main.js');
}
