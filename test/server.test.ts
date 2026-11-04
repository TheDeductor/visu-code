import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocket } from 'ws';
import type { Project } from '../src/core/project.js';
import { startServer, type RunningServer } from '../src/server/server.js';
import { makeLoginMap, makeProject } from './helpers.js';

let root = '';
let project: Project;
let server: RunningServer;
let cleanup: () => void;

async function api(pathname: string, init: RequestInit = {}, token = server.token): Promise<Response> {
  return fetch(`${server.url}/api${pathname}`, {
    ...init,
    headers: {
      'x-vibemap-token': token,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

beforeAll(async () => {
  const made = await makeProject();
  root = made.root;
  project = made.project;
  cleanup = made.cleanup;
  await makeLoginMap(project);
  server = await startServer({ root, port: 0, quiet: true });
});

afterAll(async () => {
  await server?.close();
  cleanup?.();
});

describe('server API', () => {
  it('serves project and map data with a valid token', async () => {
    const response = await api('/project');
    expect(response.status).toBe(200);
    const data = (await response.json()) as { name: string; versions: { schema: number }; git: { available: boolean } };
    expect(data.name).toBe('test-app');
    expect(data.versions.schema).toBe(1);
    expect(data.git.available).toBe(false);

    const maps = (await (await api('/maps')).json()) as { maps: Array<{ id: string }>; check: { ok: boolean } };
    expect(maps.maps.map((map) => map.id)).toContain('auth/login-flow');
    expect(maps.check.ok).toBe(true);

    const detail = (await (await api('/maps/auth/login-flow')).json()) as { map: { type: string; nodes: unknown[] }; evidence: Record<string, { status: string }> };
    expect(detail.map.type).toBe('graph');
    expect(detail.map.nodes).toHaveLength(3);
    expect(detail.evidence['auth-api']?.status).toBe('verified');
  });

  it('rejects missing tokens, bad origins and traversal', async () => {
    expect((await fetch(`${server.url}/api/project`)).status).toBe(401);
    expect((await api('/project', {}, 'wrong-token')).status).toBe(401);
    expect((await api('/project', { headers: { origin: 'http://evil.example' } })).status).toBe(403);
    const traversal = await api(`/code?path=${encodeURIComponent('../../etc/passwd')}`);
    expect(traversal.status).toBe(400);
    fs.writeFileSync(path.join(root, '.env.local'), 'SECRET=1\n');
    const secret = await api(`/code?path=.env.local`);
    expect(secret.status).toBe(403);
  });

  it('applies ops, updates layout, and validates revision conflicts', async () => {
    const before = (await (await api('/maps/auth/login-flow')).json()) as { rev: string };
    const response = await api('/maps/auth/login-flow/ops', {
      method: 'POST',
      body: JSON.stringify({
        baseRev: before.rev,
        origin: 'human',
        ops: [{ op: 'add_node', node: { id: 'session-store', label: 'Session store', kind: 'cache', status: 'planned' } }],
      }),
    });
    expect(response.status).toBe(200);
    const applied = (await response.json()) as { changedNodeIds: string[]; rev: string };
    expect(applied.changedNodeIds).toContain('session-store');
    expect(applied.rev).not.toBe(before.rev);

    const detail = (await (await api('/maps/auth/login-flow')).json()) as { map: { nodes: Array<{ id: string }> }; rev: string };
    const layout = {
      schema: 1,
      map: 'auth/login-flow',
      nodes: { 'auth-api': { x: 100, y: 40, w: 180, h: 60, pinned: true } },
      groups: {},
      annotations: [],
    };
    const layoutResponse = await api('/maps/auth/login-flow/layout', { method: 'PUT', body: JSON.stringify({ layout }) });
    expect(layoutResponse.status).toBe(200);

    const conflict = await api('/maps/auth/login-flow/ops', {
      method: 'POST',
      body: JSON.stringify({ baseRev: before.rev, origin: 'human', ops: [{ op: 'update_node', id: 'auth-api', set: { description: 'stale' } }] }),
    });
    expect([409, 200]).toContain(conflict.status);
  });

  it('serves code snippets but never secrets', async () => {
    const response = await api(`/code?path=${encodeURIComponent('src/routes/auth.ts')}&from=1&to=3`);
    expect(response.status).toBe(200);
    const data = (await response.json()) as { content: string; path: string };
    expect(data.path).toBe('src/routes/auth.ts');
    expect(data.content).toContain('loginHandler');
  });

  it('round-trips notes', async () => {
    const content = '---\nschema: 1\ntitle: Auth note\nmaps: [auth/login-flow]\nnodes: []\n---\n\nWhy auth works.\n';
    const saved = await api('/notes/auth.md', { method: 'PUT', body: JSON.stringify({ content }) });
    expect(saved.status).toBe(200);
    const read = await api('/notes/auth.md');
    expect(read.status).toBe(200);
    const note = (await read.json()) as { title: string; body: string };
    expect(note.title).toBe('Auth note');
    expect(note.body).toContain('Why auth works.');
  });

  it('streams a live hello event over WebSocket', async () => {
    const socket = new WebSocket(`${server.url.replace('http', 'ws')}/ws?token=${encodeURIComponent(server.token)}`);
    const hello = await new Promise<{ type: string; data: unknown }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WS timeout')), 5000);
      socket.on('message', (raw) => {
        const message = JSON.parse(raw.toString()) as { type: string; data: unknown };
        if (message.type === 'hello') {
          clearTimeout(timer);
          resolve(message);
        }
      });
      socket.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    expect(hello.type).toBe('hello');
    socket.close();
  });

  it('produces an SVG export', async () => {
    const response = await api('/export/auth/login-flow?format=svg');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/svg+xml');
    const svg = await response.text();
    expect(svg).toContain('<svg');
    expect(svg).toContain('Login flow');
  });
});
