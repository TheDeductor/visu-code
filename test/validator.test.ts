import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { Project } from '../src/core/project.js';
import { loadProject, readLocks } from '../src/core/project.js';
import { validateProject } from '../src/core/validate.js';
import { loadMap } from '../src/core/maps.js';
import { applyOpsToFile } from '../src/core/writer.js';
import { OpsError } from '../src/core/ops.js';
import { lockNode } from '../src/core/locks.js';
import { createMap } from '../src/core/create-map.js';
import { makeLoginMap, makeOverview, makeProject, readMapYaml } from './helpers.js';

let root = '';
let project: Project;
let cleanup: () => void;

beforeEach(async () => {
  const made = await makeProject();
  root = made.root;
  project = made.project;
  cleanup = made.cleanup;
});

afterEach(() => {
  cleanup?.();
});

function codes(report: ReturnType<typeof validateProject>): string[] {
  return [...report.errors, ...report.warnings].map((issue) => issue.code);
}

function rawMap(id: string, body: string): void {
  const file = path.join(root, '.vibemap', 'maps', `${id}.vmap.yaml`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body, 'utf8');
}

describe('validator', () => {
  it('passes a valid map with verified evidence', async () => {
    await makeLoginMap(project);
    const report = validateProject(project);
    expect(report.errors).toEqual([]);
    expect(report.stats.verified).toBe(3);
    expect(report.stats.maps).toBe(1);
    expect(report.stats.coverage).toBeGreaterThan(0);
  });

  it('reports E007 for a missing ref path', async () => {
    await makeLoginMap(project);
    await applyOpsToFile(
      project,
      'auth/login-flow',
      [{ op: 'update_node', id: 'auth-api', set: { refs: [{ path: 'src/routes/missing.ts' }] } }],
      { origin: 'agent' },
    );
    const report = validateProject(project);
    expect(report.errors.some((issue) => issue.code === 'E007')).toBe(true);
    expect(report.errors.find((issue) => issue.code === 'E007')?.line).toBeGreaterThan(0);
  });

  it('reports E008 for a wrong symbol', async () => {
    await makeLoginMap(project);
    await applyOpsToFile(
      project,
      'auth/login-flow',
      [{ op: 'update_node', id: 'auth-api', set: { refs: [{ path: 'src/routes/auth.ts', symbol: 'nope' }] } }],
      { origin: 'agent' },
    );
    const report = validateProject(project);
    expect(report.errors.some((issue) => issue.code === 'E008')).toBe(true);
  });

  it('reports E004 for an edge with an unknown endpoint, with a suggestion', async () => {
    await makeLoginMap(project);
    const yaml = readMapYaml(project, 'auth/login-flow').replace('to: users-db', 'to: users-dbb');
    fs.writeFileSync(path.join(root, '.vibemap', 'maps', 'auth', 'login-flow.vmap.yaml'), yaml);
    const report = validateProject(project);
    const issue = report.errors.find((item) => item.code === 'E004');
    expect(issue).toBeTruthy();
    expect(issue?.hint).toContain('users-db');
  });

  it('reports E013 for forbidden layout fields', async () => {
    rawMap(
      'raw',
      `schema: 1
title: Raw
type: graph
level: feature
nodes:
  - id: a
    label: A
    kind: service
    x: 10
    y: 20
edges: []
`,
    );
    const report = validateProject(project);
    expect(report.errors.some((issue) => issue.code === 'E013')).toBe(true);
  });

  it('reports E003 for duplicate ids', async () => {
    rawMap(
      'raw',
      `schema: 1
title: Raw
type: graph
level: feature
summary: raw
nodes:
  - id: a
    label: A
    kind: external
  - id: a
    label: A2
    kind: external
edges: []
`,
    );
    const report = validateProject(project);
    expect(report.errors.some((issue) => issue.code === 'E003')).toBe(true);
  });

  it('reports E012 for an undeclared phase', async () => {
    await makeLoginMap(project);
    await applyOpsToFile(project, 'auth/login-flow', [{ op: 'set_meta', set: { phase: 'p9' } }], { origin: 'agent' });
    const report = validateProject(project);
    expect(report.errors.some((issue) => issue.code === 'E012')).toBe(true);
  });

  it('warns W101/W111/W115 for a thin map', async () => {
    await createMap(project, 'thin', { title: 'Thin', level: undefined });
    await applyOpsToFile(
      project,
      'thin',
      [{ op: 'add_node', node: { id: 'a', label: 'This label is deliberately much longer than forty characters', kind: 'external' } }],
      { origin: 'agent' },
    );
    // Remove the auto level by rewriting without it.
    const yaml = readMapYaml(project, 'thin').replace(/^level:.*\n/m, '').replace(/^summary:.*\n/m, '');
    fs.writeFileSync(path.join(root, '.vibemap', 'maps', 'thin.vmap.yaml'), yaml);
    const report = validateProject(project);
    expect(codes(report)).toEqual(expect.arrayContaining(['W101', 'W111', 'W115']));
  });

  it('reports E015 above the hard node cap', async () => {
    const nodes = Array.from({ length: 31 }, (_, i) => `  - id: n${i}\n    label: N${i}\n    kind: external\n`).join('');
    rawMap(
      'huge',
      `schema: 1
title: Huge
type: graph
level: feature
summary: huge map
nodes:
${nodes}edges: []
`,
    );
    const report = validateProject(project);
    expect(report.errors.some((issue) => issue.code === 'E015')).toBe(true);
  });

  it('enforces human locks against agent patches and direct edits (E009)', async () => {
    await makeLoginMap(project);
    const loaded = loadMap(project, 'auth/login-flow');
    const node = loaded.map.type === 'graph' ? loaded.map.nodes.find((item) => item.id === 'auth-api')! : null;
    expect(node).toBeTruthy();
    lockNode(project, 'auth/login-flow', node!);
    await expect(
      applyOpsToFile(project, 'auth/login-flow', [{ op: 'update_node', id: 'auth-api', set: { description: 'agent edit' } }], {
        origin: 'agent',
      }),
    ).rejects.toBeInstanceOf(OpsError);
    const yaml = readMapYaml(project, 'auth/login-flow').replace('label: POST /api/login', 'label: Agent rewrote this');
    fs.writeFileSync(path.join(root, '.vibemap', 'maps', 'auth', 'login-flow.vmap.yaml'), yaml);
    const report = validateProject(project);
    expect(report.errors.some((issue) => issue.code === 'E009')).toBe(true);
    expect(Object.keys(readLocks(loadProject(root)).locks)).toContain('auth/login-flow#auth-api');
  });

  it('reports E016 for invalid sequence endpoints and fragments', async () => {
    await createMap(project, 'flows/sequence', { type: 'sequence', title: 'Sequence' });
    rawMap(
      'flows/sequence',
      `schema: 1
title: Sequence
type: sequence
level: feature
summary: a sequence
participants:
  - id: browser
    label: Browser
steps:
  - from: browser
    to: ghost
    label: call
fragments:
  - kind: alt
    label: nope
    from_step: 4
    to_step: 2
`,
    );
    const report = validateProject(project);
    expect(report.errors.filter((issue) => issue.code === 'E016').length).toBeGreaterThanOrEqual(2);
  });

  it('reports E010 for invalid Mermaid source', async () => {
    await createMap(project, 'diagrams/bad', { type: 'mermaid', title: 'Bad' });
    await applyOpsToFile(project, 'diagrams/bad', [{ op: 'set_source', source: 'this is not mermaid' }], { origin: 'agent' });
    const report = validateProject(project);
    expect(report.errors.some((issue) => issue.code === 'E010')).toBe(true);
  });

  it('reports E011 for a note referencing unknown maps/nodes', async () => {
    await makeLoginMap(project);
    const note = path.join(root, '.vibemap', 'notes', 'bad.md');
    fs.mkdirSync(path.dirname(note), { recursive: true });
    fs.writeFileSync(note, `---\nschema: 1\ntitle: Bad\nmaps: [ghost/map]\nnodes: [auth/login-flow#nope]\n---\n\nText.\n`);
    const report = validateProject(project);
    expect(report.errors.filter((issue) => issue.code === 'E011').length).toBeGreaterThanOrEqual(2);
  });

  it('works with an overview map and computes coverage', async () => {
    await makeOverview(project);
    const report = validateProject(project);
    expect(report.errors).toEqual([]);
    expect(report.stats.coverage).toBeGreaterThan(0);
    expect(report.stats.verified).toBe(3);
  });
});
