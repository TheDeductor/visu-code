import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { initProject } from '../src/core/init.js';
import { loadProject, type Project } from '../src/core/project.js';
import { scanProject } from '../src/core/scanner.js';
import { createMap } from '../src/core/create-map.js';
import { applyOpsToFile } from '../src/core/writer.js';

export const SAMPLE_FILES: Record<string, string> = {
  'package.json': JSON.stringify(
    {
      name: 'test-app',
      private: true,
      dependencies: { express: '^4.19.0' },
      devDependencies: { vitest: '^3.0.0' },
    },
    null,
    2,
  ),
  'src/server.ts': `import express from 'express';
import { loginHandler } from './routes/auth';
const app = express();
app.post('/api/login', loginHandler);
app.get('/health', (req, res) => res.json({ ok: true }));
export default app;
`,
  'src/routes/auth.ts': `import { db } from '../db';
export async function loginHandler(req: any, res: any) {
  const user = await db.user.findUnique({ where: { email: req.body.email } });
  res.json({ user });
}
`,
  'src/db.ts': `import { PrismaClient } from '@prisma/client';
export const db = new PrismaClient();
const secret = process.env.DATABASE_URL;
export const mode = process.env.NODE_ENV;
`,
  'src/components/LoginForm.tsx': `export function LoginForm() {
  return <form><input name="email" /></form>;
}
`,
  'prisma/schema.prisma': `model User {
  id    String @id
  email String @unique
}

model Note {
  id     String @id
  body   String?
  userId String
}
`,
  '.env': 'DATABASE_URL=postgres://secret-not-read\nPRIVATE_KEY=super-secret\n',
  '.gitignore': '.vibemap/.cache/\nnode_modules/\n',
  'README.md': '# test app\n',
};

export function writeSample(root: string): void {
  for (const [rel, content] of Object.entries(SAMPLE_FILES)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }
}

export async function makeProject(): Promise<{ root: string; project: Project; cleanup: () => void }> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibemap-test-'));
  writeSample(root);
  await initProject(root, { agents: ['generic'], hooks: false, scan: false });
  scanProject(loadProject(root), { full: true });
  return {
    root,
    project: loadProject(root),
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

export async function makeLoginMap(project: Project): Promise<void> {
  await createMap(project, 'auth/login-flow', { title: 'Login flow', level: 'feature' });
  await applyOpsToFile(
    project,
    'auth/login-flow',
    [
      {
        op: 'add_group',
        group: { id: 'frontend', label: 'Frontend', kind: 'boundary' },
      },
      {
        op: 'add_group',
        group: { id: 'backend', label: 'Backend', kind: 'boundary' },
      },
      {
        op: 'add_node',
        node: {
          id: 'login-form',
          label: 'Login form',
          kind: 'ui',
          group: 'frontend',
          status: 'built',
          refs: [{ path: 'src/components/LoginForm.tsx', symbol: 'LoginForm' }],
        },
      },
      {
        op: 'add_node',
        node: {
          id: 'auth-api',
          label: 'POST /api/login',
          kind: 'api',
          group: 'backend',
          status: 'built',
          refs: [{ path: 'src/routes/auth.ts', symbol: 'loginHandler' }],
        },
      },
      {
        op: 'add_node',
        node: {
          id: 'users-db',
          label: 'User table',
          kind: 'database',
          group: 'backend',
          status: 'built',
          refs: [{ path: 'prisma/schema.prisma' }],
        },
      },
      {
        op: 'add_edge',
        edge: { from: 'login-form', to: 'auth-api', label: 'email + password', kind: 'calls' },
      },
      {
        op: 'add_edge',
        edge: { from: 'auth-api', to: 'users-db', label: 'lookup', kind: 'reads' },
      },
      {
        op: 'set_walkthrough',
        steps: [{ focus: ['login-form'], text: 'The user types credentials.' }],
      },
    ],
    { origin: 'agent' },
  );
}

export async function makeOverview(project: Project): Promise<void> {
  await createMap(project, '00-overview', { title: 'Overview', level: 'overview' });
  await applyOpsToFile(
    project,
    '00-overview',
    [
      {
        op: 'add_node',
        node: { id: 'ui', label: 'Browser', kind: 'ui', status: 'built', refs: [{ path: 'src/components/LoginForm.tsx' }] },
      },
      {
        op: 'add_node',
        node: { id: 'api', label: 'API', kind: 'service', status: 'built', refs: [{ path: 'src/server.ts' }] },
      },
      {
        op: 'add_node',
        node: { id: 'db', label: 'Database', kind: 'database', status: 'built', refs: [{ path: 'prisma/schema.prisma' }] },
      },
      { op: 'add_edge', edge: { from: 'ui', to: 'api', kind: 'calls' } },
      { op: 'add_edge', edge: { from: 'api', to: 'db', kind: 'reads' } },
    ],
    { origin: 'agent' },
  );
}

export function gitInit(root: string): void {
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root });
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['commit', '-q', '-m', 'initial'], { cwd: root });
}

export function gitCommit(root: string, message: string): string {
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['commit', '-q', '-m', message], { cwd: root });
  return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}

export function readMapYaml(project: Project, id: string): string {
  return fs.readFileSync(path.join(project.root, '.vibemap', 'maps', `${id}.vmap.yaml`), 'utf8');
}

export function loadFreshProject(root: string): Project {
  return loadProject(root);
}
