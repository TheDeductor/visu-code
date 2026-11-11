import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import chokidar, { type FSWatcher } from 'chokidar';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  CheckReport,
  EvidenceMap,
  Facts,
  HistoryPoint,
  Issue,
  MapLayoutSidecar,
  MapSummary,
  PatchOp,
  ServerInfo,
  VibeMap,
  VibeNode,
} from '../core/types.js';
import { SCHEMA_VERSION, MAPS_DIR } from '../core/types.js';
import { VERSION } from '../core/version.js';
import {
  loadProject,
  readLayout,
  writeLayout,
  listMapIds,
  readLocks,
  writeLocks,
  gitInfo,
  type Project,
} from '../core/project.js';
import { loadAllMaps, parseMapContent, mapNodeCount, mapEdgeCount, MapValidationError } from '../core/maps.js';
import { validateProject, validateProjectAsync } from '../core/validate.js';
import { applyOpsToFile, readMapContent } from '../core/writer.js';
import { RevisionConflictError, OpsError, diffPreview } from '../core/ops.js';
import { diffMaps } from '../core/diff.js';
import { resolveEvidence } from '../core/evidence.js';
import { loadFacts } from '../core/scanner.js';
import { listHistory, mapAtRev, diffRevs } from '../core/history.js';
import {
  addChangeEntry,
  listChanges,
  parseChange,
  type ParsedChange,
} from '../core/changes.js';
import { listNotes, listNotePaths, parseNote, readNoteBody, writeNote, notePathFromApi } from '../core/notes.js';
import { addPhase, finishPhase, phaseProgress, startPhase } from '../core/phases.js';
import { computeCoverage, computeSuggestions } from '../core/suggest.js';
import { computeDrift, readPending } from '../core/drift.js';
import { lockKey, lockNode, nodeLockHash, unlockNode } from '../core/locks.js';
import { renderFormat, type ExportFormat } from '../core/render.js';
import { layoutMap } from '../core/layout.js';
import { recordJournal } from '../core/journal.js';
import { isSecretFile, mapFileFromId, mapIdFromFile, normalizeRelPath, resolveInsideReal, toPosix } from '../core/paths.js';
import { sha1, stringifyYaml, writeFileAtomicSync } from '../core/yaml.js';
import { syncAgents } from '../core/init.js';
import { scanProject } from '../core/scanner.js';
import { createMap } from '../core/create-map.js';
import { bootstrapProject } from '../core/bootstrap.js';

const API_PREFIX = '/api/';
const SOCKET_PATH = '/ws';

interface MapRuntime {
  id: string;
  file: string;
  rev: string;
  content: string;
  map: VibeMap;
  layout: MapLayoutSidecar | null;
  evidence: EvidenceMap;
  error?: { issues: Issue[]; message: string };
  updatedAt: string;
}

interface WsEnvelope {
  type: string;
  data: unknown;
  at: string;
}

export interface ServerOptions {
  root: string;
  host?: string;
  port?: number;
  token?: string;
  staticDir?: string;
  quiet?: boolean;
}

export interface RunningServer {
  port: number;
  host: string;
  token: string;
  url: string;
  close: () => Promise<void>;
  broadcast: (type: string, data: unknown) => void;
}

class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function json(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

function text(res: ServerResponse, status: number, data: string, type = 'text/plain; charset=utf-8'): void {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'content-length': Buffer.byteLength(data) });
  res.end(data);
}

function securityHeaders(res: ServerResponse): void {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
}

async function readBody(req: IncomingMessage, limit = 2 * 1024 * 1024): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > limit) throw new HttpError(413, 'BODY_TOO_LARGE', 'Request body is too large.');
    chunks.push(buf);
  }
  if (!chunks.length) return null;
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
}

function cookieValue(req: IncomingMessage, name: string): string | null {
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  for (const part of cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function staticCandidates(): string[] {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return [
    process.env.VIBEMAP_WEB_DIR ?? '',
    path.join(here, 'web'),
    path.join(here, '..', 'dist', 'web'),
    path.join(here, '..', '..', 'dist', 'web'),
    path.join(process.cwd(), 'dist', 'web'),
  ].filter(Boolean);
}

function findStaticDir(explicit?: string): string | null {
  const candidates = explicit ? [explicit, ...staticCandidates()] : staticCandidates();
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(path.join(candidate, 'index.html'))) return candidate;
    } catch {
      // ignore
    }
  }
  return null;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

class VibeMapServer {
  project: Project;
  readonly root: string;
  readonly host: string;
  readonly quiet: boolean;
  token: string;
  port: number;
  server: http.Server | null = null;
  wss: WebSocketServer;
  clients = new Set<WebSocket>();
  watcher: FSWatcher | null = null;
  maps = new Map<string, MapRuntime>();
  check: CheckReport | null = null;
  facts: Facts | null = null;
  staticDir: string | null;
  recentWrites = new Map<string, number>();
  debounce = new Map<string, NodeJS.Timeout>();
  checkTimer: NodeJS.Timeout | null = null;
  heartbeat: NodeJS.Timeout | null = null;
  startedAt = new Date().toISOString();
  closed = false;
  private serverFile: string;

  constructor(options: ServerOptions) {
    this.root = path.resolve(options.root);
    this.project = loadProject(this.root);
    this.host = options.host ?? this.project.config.viewer.host ?? '127.0.0.1';
    this.port = options.port ?? this.project.config.viewer.port ?? 4317;
    this.token = options.token ?? crypto.randomBytes(24).toString('base64url');
    this.quiet = !!options.quiet;
    this.staticDir = findStaticDir(options.staticDir);
    this.wss = new WebSocketServer({ noServer: true });
    this.serverFile = path.join(this.project.vibemapDir, '.cache', 'server.json');
  }

  async start(): Promise<RunningServer> {
    await this.refreshAll();
    await this.listen();
    this.startWatcher();
    this.startHeartbeat();
    this.writeServerInfo();
    return {
      port: this.port,
      host: this.host,
      token: this.token,
      url: this.url(),
      close: () => this.close(),
      broadcast: (type, data) => this.broadcast(type, data),
    };
  }

  url(): string {
    const displayHost = this.host === '0.0.0.0' || this.host === '::' ? '127.0.0.1' : this.host;
    return `http://${displayHost}:${this.port}`;
  }

  private async listen(): Promise<void> {
    const handler = (req: IncomingMessage, res: ServerResponse): void => {
      this.handle(req, res).catch((err: unknown) => this.handleError(res, err));
    };
    this.server = http.createServer(handler);
    this.server.on('upgrade', (req, socket, head) => this.handleUpgrade(req, socket, head));
    const startPort = this.port;
    for (let attempt = 0; attempt < 25; attempt++) {
      const candidate = startPort === 0 ? 0 : startPort + attempt;
      try {
        await new Promise<void>((resolve, reject) => {
          const onError = (err: NodeJS.ErrnoException): void => {
            this.server!.off('listening', onListening);
            reject(err);
          };
          const onListening = (): void => {
            this.server!.off('error', onError);
            resolve();
          };
          this.server!.once('error', onError);
          this.server!.once('listening', onListening);
          this.server!.listen(candidate, this.host);
        });
        const address = this.server.address();
        this.port = typeof address === 'object' && address ? address.port : candidate;
        return;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== 'EADDRINUSE' || startPort === 0) throw err;
      }
    }
    throw new Error(`No free port found near ${startPort}`);
  }

  private allowedHosts(): Set<string> {
    const hosts = new Set<string>([
      `127.0.0.1:${this.port}`,
      `localhost:${this.port}`,
      `[::1]:${this.port}`,
      `${this.host}:${this.port}`,
      // Vite dev server proxy, local-only.
      '127.0.0.1:4318',
      'localhost:4318',
    ]);
    return hosts;
  }

  private hostAllowed(req: IncomingMessage): boolean {
    const header = req.headers.host;
    if (!header) return false;
    if (this.host === '0.0.0.0' || this.host === '::') return true;
    return this.allowedHosts().has(header.toLowerCase());
  }

  private originAllowed(req: IncomingMessage): boolean {
    const origin = req.headers.origin;
    if (!origin) return true;
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
      const host = parsed.host.toLowerCase();
      if (this.allowedHosts().has(host)) return true;
      // Vite dev proxy (viewer dev server) is local-only.
      if (host === 'localhost:4318' || host === '127.0.0.1:4318') return true;
      return false;
    } catch {
      return false;
    }
  }

  private tokenFrom(req: IncomingMessage, url: URL): string | null {
    const header = req.headers['x-vibemap-token'];
    if (typeof header === 'string' && header) return header;
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7);
    const query = url.searchParams.get('token');
    if (query) return query;
    return cookieValue(req, 'vibemap_token');
  }

  private authorized(req: IncomingMessage, url: URL): boolean {
    const token = this.tokenFrom(req, url);
    return !!token && safeEqual(token, this.token);
  }

  private startHeartbeat(): void {
    this.heartbeat = setInterval(() => {
      for (const ws of this.clients) {
        const state = (ws as WebSocket & { isAlive?: boolean }).isAlive;
        if (state === false) {
          ws.terminate();
          this.clients.delete(ws);
          continue;
        }
        (ws as WebSocket & { isAlive?: boolean }).isAlive = false;
        try {
          ws.ping();
        } catch {
          // closed
        }
      }
    }, 30_000);
    this.heartbeat.unref();
    this.wss.on('connection', (ws) => {
      (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
      ws.on('pong', () => {
        (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
      });
      this.clients.add(ws);
      this.send(ws, 'hello', {
        project: this.projectInfo(),
        maps: this.summaries(),
        check: this.check,
        token: undefined,
      });
      ws.on('message', async (raw) => {
        try {
          const message = JSON.parse(raw.toString()) as { type?: string };
          if (message.type === 'ping') this.send(ws, 'pong', { now: Date.now() });
          if (message.type === 'refresh') {
            await this.refreshAll();
            this.send(ws, 'maps.updated', this.summaries());
          }
        } catch {
          this.send(ws, 'error', { message: 'Invalid WebSocket message' });
        }
      });
      ws.on('close', () => this.clients.delete(ws));
      ws.on('error', () => this.clients.delete(ws));
    });
  }

  private handleUpgrade(req: IncomingMessage, socket: import('node:stream').Duplex, head: Buffer): void {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      if (url.pathname !== SOCKET_PATH || !this.hostAllowed(req) || !this.originAllowed(req) || !this.authorized(req, url)) {
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }
      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.wss.emit('connection', ws, req);
      });
    } catch {
      socket.destroy();
    }
  }

  private startWatcher(): void {
    const ignored = (p: string): boolean =>
      p.includes(`${path.sep}.cache${path.sep}`) ||
      p.endsWith('.tmp') ||
      path.basename(p).startsWith('.');
    this.watcher = chokidar.watch(this.project.vibemapDir, {
      ignoreInitial: true,
      ignored,
      awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 25 },
      depth: 6,
    });
    this.watcher.on('add', (abs) => this.onFsEvent(abs));
    this.watcher.on('change', (abs) => this.onFsEvent(abs));
    this.watcher.on('unlink', (abs) => this.onFsUnlink(abs));
    this.watcher.on('error', (err) => this.sendAll('error', { message: `Watcher error: ${(err as Error).message}` }));
  }

  private onFsEvent(abs: string): void {
    if (this.closed) return;
    const rel = toPosix(path.relative(this.root, abs));
    const writeAt = this.recentWrites.get(rel);
    if (writeAt && Date.now() - writeAt < 2500) {
      this.recentWrites.delete(rel);
      return;
    }
    if (rel.startsWith(`${MAPS_DIR}/maps/`) && rel.endsWith('.vmap.yaml')) {
      const id = mapIdFromFile(rel);
      this.schedule(`map:${id}`, 120, () => this.onMapFileChanged(id, rel));
    } else if (rel.startsWith(`${MAPS_DIR}/layouts/`)) {
      this.sendAll('layout.updated', { path: rel });
    } else if (rel.startsWith(`${MAPS_DIR}/notes/`)) {
      this.sendAll('notes.updated', { path: rel });
    } else if (rel.startsWith(`${MAPS_DIR}/changes/`)) {
      this.sendAll('changes.updated', { path: rel });
    } else if (rel === `${MAPS_DIR}/phases.yaml`) {
      this.sendAll('phases.updated', {});
    } else if (rel === `${MAPS_DIR}/locks.json`) {
      this.sendAll('locks.updated', {});
    } else if (rel === `${MAPS_DIR}/config.yaml` || rel === `${MAPS_DIR}/theme.yaml`) {
      this.schedule('config', 200, () => this.reloadConfig());
    }
    if (this.checkTimer) clearTimeout(this.checkTimer);
    this.checkTimer = setTimeout(() => {
      void this.refreshCheck(true);
    }, 500);
  }

  private onFsUnlink(abs: string): void {
    const rel = toPosix(path.relative(this.root, abs));
    if (rel.startsWith(`${MAPS_DIR}/maps/`) && rel.endsWith('.vmap.yaml')) {
      const id = mapIdFromFile(rel);
      if (this.maps.delete(id)) this.sendAll('map.removed', { id });
      void this.refreshCheck(true);
    }
  }

  private schedule(key: string, ms: number, fn: () => void): void {
    const existing = this.debounce.get(key);
    if (existing) clearTimeout(existing);
    this.debounce.set(
      key,
      setTimeout(() => {
        this.debounce.delete(key);
        fn();
      }, ms),
    );
  }

  private async onMapFileChanged(id: string, rel: string): Promise<void> {
    const previous = this.maps.get(id);
    const abs = path.join(this.root, rel);
    if (!fs.existsSync(abs)) return;
    const content = fs.readFileSync(abs, 'utf8');
    const rev = sha1(content);
    if (previous && previous.rev === rev) return;
    const parsed = parseMapContent(content, rel, id);
    if (!parsed.map) {
      if (previous) {
        previous.error = { issues: parsed.issues, message: 'Map file is invalid; showing last good version.' };
        previous.content = content;
        previous.rev = rev;
      }
      this.sendAll('map.error', { id, issues: parsed.issues });
      await this.refreshCheck(true);
      return;
    }
    const layout = this.readLayoutSafe(id);
    const evidence = resolveEvidence(this.project, parsed.map, this.facts);
    this.maps.set(id, {
      id,
      file: rel,
      rev,
      content,
      map: parsed.map,
      layout,
      evidence,
      updatedAt: new Date().toISOString(),
    });
    await recordJournal(this.project, id, content, 'external', 'Changed on disk');
    this.sendAll('map.changed', {
      id,
      rev,
      by: 'agent',
      summary: previous ? 'Map changed on disk' : 'Map created',
      changedNodeIds: [],
    });
    await this.refreshCheck(true);
  }

  private async reloadConfig(): Promise<void> {
    try {
      this.project = loadProject(this.root);
      this.sendAll('config.updated', { config: this.project.config, theme: this.project.theme });
      await this.refreshAll();
    } catch (err) {
      this.sendAll('error', { message: `Config invalid: ${(err as Error).message}` });
    }
  }

  private readLayoutSafe(id: string): MapLayoutSidecar | null {
    try {
      return readLayout(this.project, id);
    } catch {
      return null;
    }
  }

  async refreshAll(): Promise<void> {
    const result = loadAllMaps(this.project);
    const validIds = new Set<string>();
    const errors = new Map(result.errors.map((e) => [e.id, e]));
    for (const loaded of result.maps) {
      validIds.add(loaded.id);
      this.maps.set(loaded.id, {
        id: loaded.id,
        file: loaded.file,
        rev: loaded.rev,
        content: loaded.content,
        map: loaded.map,
        layout: this.readLayoutSafe(loaded.id),
        evidence: resolveEvidence(this.project, loaded.map, this.facts ?? loadFacts(this.project)),
        updatedAt: new Date().toISOString(),
      });
    }
    for (const error of result.errors) {
      const previous = this.maps.get(error.id);
      if (previous && error.content) {
        previous.error = { issues: error.issues, message: 'Map file is invalid; showing last good version.' };
        previous.content = error.content;
        previous.rev = sha1(error.content);
      } else if (error.content) {
        // Keep an error shell so the UI can show the broken map without a last-good version.
        this.maps.delete(error.id);
      }
    }
    for (const id of [...this.maps.keys()]) if (!validIds.has(id) && !errors.has(id)) this.maps.delete(id);
    this.facts = loadFacts(this.project);
    await this.refreshCheck(false);
    this.facts = loadFacts(this.project);
  }

  async refreshCheck(broadcast: boolean): Promise<void> {
    try {
      this.check = await validateProjectAsync(this.project, { strict: this.project.config.validation.strict });
    } catch (err) {
      this.check = {
        ok: false,
        errors: [{ code: 'E-CHECK', severity: 'error', file: '.vibemap', message: (err as Error).message }],
        warnings: [],
        stats: { maps: this.maps.size, nodes: 0, edges: 0, verified: 0, declared: 0, stale: 0, planned: 0 },
        generatedAt: new Date().toISOString(),
      };
    }
    if (broadcast) this.sendAll('check.updated', { report: this.check });
  }

  summaries(): MapSummary[] {
    const locks = safeLocks(this.project);
    const pending = readPending(this.project);
    const driftIds = new Set(pending?.direct.map((d) => d.map) ?? []);
    return [...this.maps.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((runtime) => {
        const fileIssues = this.issuesFor(runtime.file);
        return {
          id: runtime.id,
          path: runtime.file,
          title: runtime.map.title,
          type: runtime.map.type,
          level: runtime.map.level,
          phase: runtime.map.phase,
          summary: runtime.map.summary,
          nodeCount: mapNodeCount(runtime.map),
          edgeCount: mapEdgeCount(runtime.map),
          rev: runtime.rev,
          updatedAt: runtime.updatedAt,
          errors: fileIssues.errors.length + (runtime.error ? 1 : 0),
          warnings: fileIssues.warnings.length,
          drift: driftIds.has(runtime.id),
          stale: !!runtime.error,
        };
      });
  }

  issuesFor(file: string): { errors: Issue[]; warnings: Issue[] } {
    if (!this.check) return { errors: [], warnings: [] };
    return {
      errors: this.check.errors.filter((e) => e.file === file),
      warnings: this.check.warnings.filter((w) => w.file === file),
    };
  }

  mapDetail(id: string): Record<string, unknown> {
    const runtime = this.maps.get(id);
    if (!runtime) throw new HttpError(404, 'MAP_NOT_FOUND', `Map "${id}" was not found.`);
    const issues = this.issuesFor(runtime.file);
    const locks = safeLocks(this.project);
    const locked = Object.keys(locks.locks)
      .filter((key) => key.startsWith(`${id}#`))
      .map((key) => key.slice(id.length + 1));
    return {
      id,
      rev: runtime.rev,
      file: runtime.file,
      map: runtime.map,
      layout: runtime.layout,
      evidence: runtime.evidence,
      issues,
      locked,
      error: runtime.error ?? null,
      stale: !!runtime.error,
      theme: this.project.theme,
      project: {
        name: this.project.config.project.name,
        tracking: this.project.config.tracking,
        glossary: this.project.config.glossary,
        editing: this.project.config.editing,
      },
    };
  }

  projectInfo(): Record<string, unknown> {
    const git = gitInfo(this.project.root);
    return {
      root: this.project.root,
      name: this.project.config.project.name,
      config: this.project.config,
      theme: this.project.theme,
      git,
      versions: { vibemap: VERSION, schema: SCHEMA_VERSION, node: process.version },
      server: { port: this.port, host: this.host, startedAt: this.startedAt },
      check: this.check ? { ok: this.check.ok, errors: this.check.errors.length, warnings: this.check.warnings.length } : null,
    };
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    securityHeaders(res);
    if (!this.hostAllowed(req)) {
      text(res, 403, 'Forbidden host. This server only accepts loopback hostnames.');
      return;
    }
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (url.pathname.startsWith(API_PREFIX) || url.pathname === SOCKET_PATH) {
      if (!this.authorized(req, url)) {
        json(res, 401, { error: { code: 'UNAUTHORIZED', message: 'Missing or invalid VibeMap token.' } });
        return;
      }
      if (!this.originAllowed(req)) {
        json(res, 403, { error: { code: 'BAD_ORIGIN', message: 'Origin is not allowed.' } });
        return;
      }
    }
    if (url.pathname.startsWith(API_PREFIX)) {
      await this.handleApi(req, res, url);
      return;
    }
    this.serveStatic(req, res, url);
  }

  private handleError(res: ServerResponse, err: unknown): void {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    if (err instanceof HttpError) {
      json(res, err.status, { error: { code: err.code, message: err.message, details: err.details } });
      return;
    }
    if (err instanceof RevisionConflictError) {
      json(res, 409, {
        error: { code: 'REVISION_CONFLICT', message: err.message },
        currentRev: err.currentRev,
        currentContent: err.currentContent,
      });
      return;
    }
    if (err instanceof OpsError) {
      json(res, err.code === 'E009' ? 423 : 422, { error: { code: err.code, message: err.message, issues: err.issues } });
      return;
    }
    if (!this.quiet) console.error('[vibemap]', err);
    json(res, 500, { error: { code: 'INTERNAL', message: (err as Error).message } });
  }

  private async handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const pathname = url.pathname;
    const method = req.method ?? 'GET';

    if (pathname === '/api/health' && method === 'GET') {
      json(res, 200, { ok: true, version: VERSION, port: this.port });
      return;
    }
    if (pathname === '/api/project' && method === 'GET') {
      json(res, 200, this.projectInfo());
      return;
    }
    if (pathname === '/api/maps' && method === 'GET') {
      json(res, 200, { maps: this.summaries(), check: this.check });
      return;
    }
    if (pathname === '/api/maps' && method === 'POST') {
      const body = (await readBody(req)) as { id?: string; title?: string; type?: string; level?: string } | null;
      if (!body?.id) throw new HttpError(400, 'BAD_REQUEST', 'id is required.');
      const created = await createMap(this.project, body.id, {
        title: body.title,
        type: body.type as 'graph' | 'sequence' | 'erd' | 'mermaid' | undefined,
        level: body.level as 'overview' | 'feature' | 'detail' | undefined,
      });
      await this.refreshAll();
      this.sendAll('maps.updated', this.summaries());
      json(res, 201, { ...created, detail: this.mapDetail(body.id) });
      return;
    }
    if (pathname === '/api/bootstrap' && method === 'POST') {
      const result = await bootstrapProject(this.project);
      json(res, 200, result);
      return;
    }
    if (pathname.startsWith('/api/maps/')) {
      await this.handleMapApi(req, res, url);
      return;
    }
    if (pathname === '/api/diff' && method === 'GET') {
      const map = url.searchParams.get('map');
      const base = url.searchParams.get('base');
      const head = url.searchParams.get('head') ?? 'working';
      if (!map || !base) throw new HttpError(400, 'BAD_REQUEST', 'map and base query parameters are required.');
      const diff = await diffRevs(this.project, map, base, head);
      if (!diff) throw new HttpError(404, 'REVISION_NOT_FOUND', 'Could not load one of the revisions.');
      json(res, 200, diff);
      return;
    }
    if (pathname === '/api/changes' && method === 'GET') {
      json(res, 200, { changes: listChanges(this.project) });
      return;
    }
    if (pathname.startsWith('/api/changes/') && method === 'GET') {
      const id = decodeURIComponent(pathname.slice('/api/changes/'.length));
      const change = listChanges(this.project).find((c) => c.id === id);
      if (!change) throw new HttpError(404, 'CHANGE_NOT_FOUND', `Change "${id}" was not found.`);
      json(res, 200, change);
      return;
    }
    if (pathname === '/api/phases' && method === 'GET') {
      json(res, 200, { phases: phaseProgress(this.project) });
      return;
    }
    if (pathname === '/api/phases' && method === 'POST') {
      const body = (await readBody(req)) as { title?: string; goal?: string } | null;
      if (!body?.title) throw new HttpError(400, 'BAD_REQUEST', 'title is required.');
      const phase = await addPhase(this.project, body.title, body.goal);
      this.sendAll('phases.updated', {});
      json(res, 201, phase);
      return;
    }
    if (pathname.startsWith('/api/phases/') && method === 'POST') {
      const match = pathname.match(/^\/api\/phases\/([^/]+)\/(start|done)$/);
      if (!match) throw new HttpError(404, 'NOT_FOUND', 'Unknown phase action.');
      const phase = match[2] === 'start' ? await startPhase(this.project, match[1]!) : await finishPhase(this.project, match[1]!);
      this.sendAll('phases.updated', {});
      json(res, 200, phase);
      return;
    }
    if (pathname === '/api/notes' && method === 'GET') {
      json(res, 200, { notes: listNotes(this.project, false) });
      return;
    }
    if (pathname.startsWith('/api/notes/')) {
      const rel = decodeURIComponent(pathname.slice('/api/notes/'.length));
      if (method === 'GET') {
        const note = parseNote(this.project, `.vibemap/notes/${rel}`);
        json(res, 200, note.entry);
        return;
      }
      if (method === 'PUT') {
        const body = (await readBody(req)) as { content?: string } | null;
        if (typeof body?.content !== 'string') throw new HttpError(400, 'BAD_REQUEST', 'content is required.');
        notePathFromApi(this.project, rel);
        await writeNote(this.project, rel, body.content);
        this.sendAll('notes.updated', { path: rel });
        const updated = parseNote(this.project, `.vibemap/notes/${rel}`);
        json(res, 200, updated.entry);
        return;
      }
      throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Use GET or PUT.');
    }
    if (pathname === '/api/check' && method === 'GET') {
      json(res, 200, this.check);
      return;
    }
    if (pathname === '/api/check/run' && method === 'POST') {
      await this.refreshCheck(false);
      this.sendAll('check.updated', { report: this.check });
      json(res, 200, this.check);
      return;
    }
    if (pathname === '/api/coverage' && method === 'GET') {
      json(res, 200, computeCoverage(this.project));
      return;
    }
    if (pathname === '/api/suggest' && method === 'GET') {
      const limit = Number(url.searchParams.get('limit') ?? 20);
      json(res, 200, { suggestions: computeSuggestions(this.project, Number.isFinite(limit) ? limit : 20) });
      return;
    }
    if (pathname === '/api/drift' && method === 'GET') {
      json(res, 200, computeDrift(this.project));
      return;
    }
    if (pathname === '/api/drift/run' && method === 'POST') {
      const report = computeDrift(this.project);
      this.sendAll('drift.updated', report);
      json(res, 200, report);
      return;
    }
    if (pathname === '/api/code' && method === 'GET') {
      this.handleCode(res, url);
      return;
    }
    if (pathname === '/api/search' && method === 'GET') {
      json(res, 200, this.search(url.searchParams.get('q') ?? ''));
      return;
    }
    if (pathname === '/api/activity' && method === 'GET') {
      const changes = listChanges(this.project).slice(0, 10);
      json(res, 200, { changes });
      return;
    }
    if (pathname === '/api/locks' && method === 'POST') {
      const body = (await readBody(req)) as { map?: string; node?: string; locked?: boolean } | null;
      if (!body?.map || !body.node) throw new HttpError(400, 'BAD_REQUEST', 'map and node are required.');
      const runtime = this.maps.get(body.map);
      if (!runtime) throw new HttpError(404, 'MAP_NOT_FOUND', `Map "${body.map}" was not found.`);
      if (runtime.map.type !== 'graph') throw new HttpError(400, 'BAD_REQUEST', 'Locks apply to graph nodes.');
      const node = runtime.map.nodes.find((n) => n.id === body.node);
      if (!node) throw new HttpError(404, 'NODE_NOT_FOUND', `Node "${body.node}" was not found.`);
      if (body.locked === false) unlockNode(this.project, body.map, body.node);
      else lockNode(this.project, body.map, node);
      this.sendAll('locks.updated', { map: body.map, node: body.node, locked: body.locked !== false });
      json(res, 200, { map: body.map, node: body.node, locked: body.locked !== false });
      return;
    }
    if (pathname === '/api/prompt/explain' && method === 'POST') {
      const body = (await readBody(req)) as { map?: string; node?: string; change?: string } | null;
      json(res, 200, { prompt: this.explainPrompt(body ?? {}) });
      return;
    }
    if (pathname === '/api/scan' && method === 'POST') {
      const result = scanProject(this.project, { full: url.searchParams.get('full') === '1' });
      this.facts = result.facts;
      await this.refreshCheck(false);
      this.sendAll('scan.updated', { stats: result.stats });
      this.sendAll('check.updated', { report: this.check });
      json(res, 200, result.stats);
      return;
    }
    if (pathname === '/api/config' && method === 'POST') {
      const body = (await readBody(req)) as { mode?: string; granularity?: string } | null;
      if (!body) throw new HttpError(400, 'BAD_REQUEST', 'Request body is required.');
      this.updateConfig(body);
      json(res, 200, { config: this.project.config });
      return;
    }
    if (pathname.startsWith('/api/export/') && method === 'GET') {
      this.handleExport(res, url, decodeURIComponent(pathname.slice('/api/export/'.length)));
      return;
    }
    throw new HttpError(404, 'NOT_FOUND', `Unknown API endpoint ${method} ${pathname}`);
  }

  private async handleMapApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const method = req.method ?? 'GET';
    const rest = decodeURIComponent(url.pathname.slice('/api/maps/'.length));
    const action = rest.endsWith('/ops')
      ? 'ops'
      : rest.endsWith('/layout')
        ? 'layout'
        : rest.endsWith('/history')
          ? 'history'
          : rest.includes('/at/')
            ? 'at'
            : 'detail';
    const id = action === 'ops' ? rest.slice(0, -4) : action === 'layout' ? rest.slice(0, -7) : action === 'history' ? rest.slice(0, -8) : action === 'at' ? rest.slice(0, rest.lastIndexOf('/at/')) : rest;
    if (!id) throw new HttpError(400, 'BAD_REQUEST', 'Map id is required.');
    if (action === 'detail' && method === 'GET') {
      json(res, 200, this.mapDetail(id));
      return;
    }
    if (action === 'ops' && method === 'POST') {
      await this.applyOps(req, res, id);
      return;
    }
    if (action === 'layout' && method === 'PUT') {
      await this.saveLayout(req, res, id);
      return;
    }
    if (action === 'history' && method === 'GET') {
      const limit = Number(url.searchParams.get('limit') ?? 80);
      json(res, 200, { history: await listHistory(this.project, id, Number.isFinite(limit) ? limit : 80) });
      return;
    }
    if (action === 'at' && method === 'GET') {
      const rev = rest.slice(rest.lastIndexOf('/at/') + 4);
      const at = await mapAtRev(this.project, id, decodeURIComponent(rev));
      if (!at) throw new HttpError(404, 'REVISION_NOT_FOUND', `Revision "${rev}" was not found for map "${id}".`);
      json(res, 200, at);
      return;
    }
    throw new HttpError(405, 'METHOD_NOT_ALLOWED', `Unsupported ${method} for map ${id}.`);
  }

  private async applyOps(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
    const runtime = this.maps.get(id);
    if (!runtime) throw new HttpError(404, 'MAP_NOT_FOUND', `Map "${id}" was not found.`);
    if (runtime.error) throw new HttpError(422, 'MAP_INVALID', 'Fix the map file before editing it.', runtime.error.issues);
    const body = (await readBody(req)) as { baseRev?: string; ops?: PatchOp[]; origin?: string } | null;
    if (!Array.isArray(body?.ops) || !body.ops.length) throw new HttpError(400, 'BAD_REQUEST', 'ops[] is required.');
    const origin = body.origin === 'agent' ? 'agent' : 'human';
    let result: Awaited<ReturnType<typeof applyOpsToFile>>;
    try {
      result = await applyOpsToFile(this.project, id, body.ops, {
        baseRev: body.baseRev,
        origin,
        newNodeStatus: this.project.config.editing.newNodeStatus,
      });
    } catch (err) {
      if (err instanceof RevisionConflictError) {
        const rebased = await this.tryRebase(id, body.ops, runtime.map, body.baseRev);
        if (!rebased) throw err;
        result = rebased;
      } else {
        throw err;
      }
    }
    this.recentWrites.set(runtime.file, Date.now());
    await this.reloadMapRuntime(id);
    await this.refreshCheck(true);
    const changed = result.changedNodeIds;
    this.sendAll('map.changed', {
      id,
      rev: result.rev,
      by: origin,
      summary: result.journalSummary,
      changedNodeIds: changed,
      changedEdgeIds: result.changedEdgeIds,
      delta: diffPreview(runtime.map, result.map),
    });
    json(res, 200, { ...this.mapDetail(id), rev: result.rev, changedNodeIds: changed });
  }

  private async tryRebase(id: string, ops: PatchOp[], previousMap: VibeMap, baseRev?: string): Promise<Awaited<ReturnType<typeof applyOpsToFile>> | null> {
    const current = readMapContent(this.project, id);
    const parsed = parseMapContent(current.content, mapFileFromId(id), id);
    if (!parsed.map) return null;
    const changed = diffMaps(id, previousMap, parsed.map, baseRev ?? '', current.rev);
    const touched = new Set<string>();
    for (const op of ops) {
      if (op.op === 'update_node' || op.op === 'remove_node' || op.op === 'rename_node') touched.add(op.id);
      if (op.op === 'update_edge' || op.op === 'remove_edge') touched.add(op.id);
      if (op.op === 'update_group' || op.op === 'remove_group') touched.add(op.id);
      if (op.op === 'add_edge') {
        touched.add(op.edge.from);
        touched.add(op.edge.to);
      }
      if (op.op === 'add_node' && op.node.id) touched.add(op.node.id);
    }
    const conflictIds = new Set<string>([
      ...changed.added.map((n) => n.id),
      ...changed.removed.map((n) => n.id),
      ...changed.modified.map((n) => n.id),
      ...changed.addedEdges.map((e) => e.id ?? ''),
      ...changed.removedEdges.map((e) => e.id ?? ''),
    ]);
    for (const id2 of touched) if (conflictIds.has(id2)) return null;
    try {
      return await applyOpsToFile(this.project, id, ops, { origin: 'human', newNodeStatus: this.project.config.editing.newNodeStatus });
    } catch {
      return null;
    }
  }

  private async reloadMapRuntime(id: string): Promise<void> {
    const rel = mapFileFromId(id);
    const abs = path.join(this.root, rel);
    if (!fs.existsSync(abs)) {
      this.maps.delete(id);
      return;
    }
    const content = fs.readFileSync(abs, 'utf8');
    const parsed = parseMapContent(content, rel, id);
    if (!parsed.map) return;
    this.maps.set(id, {
      id,
      file: rel,
      rev: sha1(content),
      content,
      map: parsed.map,
      layout: this.readLayoutSafe(id),
      evidence: resolveEvidence(this.project, parsed.map, this.facts),
      updatedAt: new Date().toISOString(),
    });
  }

  private async saveLayout(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
    if (!this.maps.has(id)) throw new HttpError(404, 'MAP_NOT_FOUND', `Map "${id}" was not found.`);
    const body = (await readBody(req)) as { layout?: MapLayoutSidecar } | null;
    if (!body?.layout || typeof body.layout !== 'object') throw new HttpError(400, 'BAD_REQUEST', 'layout is required.');
    const layout: MapLayoutSidecar = { ...body.layout, schema: 1, map: id, nodes: body.layout.nodes ?? {} };
    const runtime = this.maps.get(id)!;
    if (runtime.map.type === 'graph') {
      const known = new Set(runtime.map.nodes.map((n) => n.id));
      for (const nodeId of Object.keys(layout.nodes)) if (!known.has(nodeId)) delete layout.nodes[nodeId];
    }
    await writeLayout(this.project, id, layout);
    runtime.layout = layout;
    this.recentWrites.set(`.vibemap/layouts/${id}.layout.json`, Date.now());
    this.sendAll('layout.updated', { map: id, layout });
    json(res, 200, layout);
  }

  private handleCode(res: ServerResponse, url: URL): void {
    const rel = normalizeRelPath(url.searchParams.get('path') ?? '');
    if (!rel) throw new HttpError(400, 'BAD_REQUEST', 'path is required.');
    if (isSecretFile(rel)) throw new HttpError(403, 'SECRET_FILE', 'Secret-like files are never read by VibeMap.');
    let abs: string;
    try {
      abs = resolveInsideReal(this.root, rel);
    } catch {
      throw new HttpError(400, 'BAD_PATH', 'Path escapes the project root.');
    }
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw new HttpError(404, 'FILE_NOT_FOUND', `File "${rel}" was not found.`);
    const stat = fs.statSync(abs);
    if (stat.size > 1_000_000) throw new HttpError(413, 'FILE_TOO_LARGE', 'Code preview is limited to 1 MB.');
    const full = fs.readFileSync(abs, 'utf8');
    const from = Math.max(1, Number(url.searchParams.get('from') ?? 1));
    const to = Math.min(Number(url.searchParams.get('to') ?? from + 80), from + 200);
    const lines = full.split('\n').slice(from - 1, to);
    json(res, 200, {
      path: rel,
      from,
      to: Math.min(to, full.split('\n').length),
      content: lines.join('\n'),
      language: path.extname(rel).replace('.', ''),
      truncated: to < full.split('\n').length,
    });
  }

  private search(raw: string): unknown {
    const q = raw.trim().toLowerCase();
    if (!q) return { results: [] };
    const results: Array<Record<string, unknown>> = [];
    for (const runtime of this.maps.values()) {
      if (runtime.map.title.toLowerCase().includes(q) || runtime.id.toLowerCase().includes(q)) {
        results.push({ type: 'map', id: runtime.id, label: runtime.map.title, map: runtime.id });
      }
      if (runtime.map.type === 'graph') {
        for (const node of runtime.map.nodes) {
          if (node.label.toLowerCase().includes(q) || node.id.includes(q) || node.description?.toLowerCase().includes(q)) {
            results.push({ type: 'node', id: `${runtime.id}#${node.id}`, label: node.label, map: runtime.id, node: node.id });
          }
        }
      }
    }
    for (const change of listChanges(this.project)) {
      if (change.title.toLowerCase().includes(q) || change.body.toLowerCase().includes(q)) {
        results.push({ type: 'change', id: change.id, label: change.title, map: change.maps[0] });
      }
    }
    for (const note of listNotes(this.project, false)) {
      if (note.title.toLowerCase().includes(q) || note.path.toLowerCase().includes(q)) {
        results.push({ type: 'note', id: note.path, label: note.title });
      }
    }
    return { results: results.slice(0, 40) };
  }

  private explainPrompt(body: { map?: string; node?: string; change?: string }): string {
    if (body.change) {
      const change = listChanges(this.project).find((c) => c.id === body.change);
      if (!change) throw new HttpError(404, 'CHANGE_NOT_FOUND', 'Change not found.');
      return `Explain the VibeMap change "${change.title}" (${change.id}) to a beginner. Here is the change entry:\n\n${change.body}\n\nUse plain language, then describe what data moved where and why it matters. Do not invent code that is not in the project.`;
    }
    if (!body.map || !body.node) throw new HttpError(400, 'BAD_REQUEST', 'map and node (or change) are required.');
    const runtime = this.maps.get(body.map);
    if (!runtime) throw new HttpError(404, 'MAP_NOT_FOUND', 'Map not found.');
    if (runtime.map.type !== 'graph') throw new HttpError(400, 'BAD_REQUEST', 'Only graph nodes can be explained.');
    const node = runtime.map.nodes.find((n) => n.id === body.node);
    if (!node) throw new HttpError(404, 'NODE_NOT_FOUND', 'Node not found.');
    const refs = (node.refs ?? []).map((r) => `${r.path}${r.symbol ? `#${r.symbol}` : ''}${r.lines ? `:${r.lines[0]}-${r.lines[1]}` : ''}`);
    return `Explain \`${node.label}\` (${body.map}#${node.id}) to a beginner who is vibe-coding this project.\n\nNode kind: ${node.kind}\nStatus: ${node.status ?? 'unspecified'}\nDescription: ${node.description ?? node.label}\n${node.plain ? `Plain-language note: ${node.plain}\n` : ''}Code refs: ${refs.length ? refs.join(', ') : '(none declared)'}\nMap: ${body.map} — ${runtime.map.title}\n\nShow the data flow with one concrete example request/response, then list the two most likely places a change here could break something. Be concrete; do not invent components.`;
  }

  private handleExport(res: ServerResponse, url: URL, id: string): void {
    const runtime = this.maps.get(id);
    if (!runtime) throw new HttpError(404, 'MAP_NOT_FOUND', `Map "${id}" was not found.`);
    const format = (url.searchParams.get('format') ?? 'svg') as ExportFormat;
    if (!['svg', 'png', 'excalidraw', 'mermaid', 'md'].includes(format)) throw new HttpError(400, 'BAD_FORMAT', 'Unknown export format.');
    if (format === 'png') throw new HttpError(501, 'PNG_UNAVAILABLE', 'PNG export needs the optional Playwright dependency. Use SVG, Mermaid, Markdown or Excalidraw.');
    const body = renderFormat(runtime.map, this.project.theme, format, runtime.evidence, runtime.layout, id);
    const ext = format === 'md' ? 'md' : format === 'mermaid' ? 'mmd' : format === 'excalidraw' ? 'excalidraw' : format;
    const type =
      format === 'svg'
        ? 'image/svg+xml'
        : format === 'excalidraw'
          ? 'application/json'
          : format === 'md'
            ? 'text/markdown; charset=utf-8'
            : 'text/plain; charset=utf-8';
    res.writeHead(200, {
      'content-type': type,
      'content-disposition': `attachment; filename="${id.replace(/\//g, '-')}.${ext}"`,
      'cache-control': 'no-store',
    });
    res.end(body);
  }

  private updateConfig(body: { mode?: string; granularity?: string }): void {
    const project = this.project;
    if (body.mode && ['every-change', 'per-phase', 'manual', 'off'].includes(body.mode)) {
      project.config.tracking.mode = body.mode as typeof project.config.tracking.mode;
    }
    if (body.granularity && ['overview', 'feature', 'detail'].includes(body.granularity)) {
      project.config.tracking.granularity = body.granularity as typeof project.config.tracking.granularity;
    }
    writeFileAtomicSync(project.configPath, stringifyYaml(project.config));
    syncAgents(project.root).catch(() => undefined);
    this.project = loadProject(this.root);
    this.sendAll('config.updated', { config: this.project.config, theme: this.project.theme });
  }

  private serveStatic(req: IncomingMessage, res: ServerResponse, url: URL): void {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      text(res, 405, 'Method not allowed');
      return;
    }
    const index = this.staticDir ? path.join(this.staticDir, 'index.html') : null;
    if (!index || !fs.existsSync(index)) {
      text(
        res,
        200,
        `<!doctype html><html><head><meta charset="utf-8"><title>VibeMap server</title><style>body{font-family:system-ui;background:#f8f9fa;color:#212529;max-width:720px;margin:10vh auto;padding:0 24px}code{background:#e9ecef;padding:2px 5px;border-radius:4px}</style></head><body><h1>VibeMap server is running</h1><p>The API is live at <code>/api/project</code>, but the viewer has not been built.</p><p>Run <code>npm run build</code> in the VibeMap checkout, then restart <code>vibemap view</code>.</p></body></html>`,
        'text/html; charset=utf-8',
      );
      return;
    }
    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      text(res, 400, 'Bad path');
      return;
    }
    const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    let abs = path.resolve(this.staticDir!, requested);
    const relative = path.relative(this.staticDir!, abs);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      text(res, 403, 'Forbidden');
      return;
    }
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) abs = index;
    if (!fs.existsSync(abs)) {
      text(res, 404, 'Not found');
      return;
    }
    if (path.basename(abs) === 'index.html') {
      let html = fs.readFileSync(abs, 'utf8');
      const boot = {
        token: this.token,
        port: this.port,
        host: this.host,
        version: VERSION,
        projectName: this.project.config.project.name,
        mode: 'server',
      };
      const script = `<script>window.__VIBEMAP__=${JSON.stringify(boot).replace(/</g, '\\u003c')};</script>`;
      html = html.includes('</head>') ? html.replace('</head>', `${script}\n</head>`) : `${script}\n${html}`;
      res.setHeader('set-cookie', `vibemap_token=${encodeURIComponent(this.token)}; HttpOnly; SameSite=Strict; Path=/`);
      text(res, 200, html, 'text/html; charset=utf-8');
      return;
    }
    const ext = path.extname(abs).toLowerCase();
    const type = MIME[ext] ?? 'application/octet-stream';
    const data = fs.readFileSync(abs);
    res.writeHead(200, {
      'content-type': type,
      'content-length': data.length,
      'cache-control': ext === '.html' ? 'no-store' : 'public, max-age=3600',
    });
    if (req.method === 'HEAD') res.end();
    else res.end(data);
  }

  private writeServerInfo(): void {
    const info: ServerInfo = {
      port: this.port,
      token: this.token,
      pid: process.pid,
      url: this.url(),
      startedAt: this.startedAt,
      root: this.root,
    };
    try {
      fs.mkdirSync(path.dirname(this.serverFile), { recursive: true });
      fs.writeFileSync(this.serverFile, `${JSON.stringify(info, null, 2)}\n`, 'utf8');
    } catch {
      // Server can run without the discovery file.
    }
  }

  private send(ws: WebSocket, type: string, data: unknown): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    const envelope: WsEnvelope = { type, data, at: new Date().toISOString() };
    ws.send(JSON.stringify(envelope));
  }

  broadcast(type: string, data: unknown): void {
    for (const ws of this.clients) this.send(ws, type, data);
  }

  private sendAll(type: string, data: unknown): void {
    this.broadcast(type, data);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    for (const timer of this.debounce.values()) clearTimeout(timer);
    this.debounce.clear();
    if (this.checkTimer) clearTimeout(this.checkTimer);
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.watcher) await this.watcher.close().catch(() => undefined);
    for (const ws of this.clients) ws.close();
    this.clients.clear();
    this.wss.close();
    if (this.server) {
      await new Promise<void>((resolve) => this.server!.close(() => resolve()));
    }
    try {
      if (fs.existsSync(this.serverFile)) {
        const info = JSON.parse(fs.readFileSync(this.serverFile, 'utf8')) as ServerInfo;
        if (info.token === this.token) fs.rmSync(this.serverFile, { force: true });
      }
    } catch {
      // ignore
    }
  }
}

function safeLocks(project: Project) {
  try {
    return readLocks(project);
  } catch {
    return { schema: SCHEMA_VERSION, locks: {} };
  }
}

function execGit(root: string, args: string[]): string | undefined {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return undefined;
  }
}

export async function startServer(options: ServerOptions): Promise<RunningServer> {
  const server = new VibeMapServer(options);
  return server.start();
}

export { VibeMapServer };
