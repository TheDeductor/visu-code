import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { Project } from '../src/core/project.js';
import { validateProject } from '../src/core/validate.js';
import { makeProject } from './helpers.js';

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

function nodes(ids: string[], kind = 'external'): string {
  return ids.map((id) => `  - id: ${id}\n    label: ${id}\n    kind: ${kind}\n`).join('');
}

function edges(pairs: Array<[string, string]>, label?: string): string {
  return pairs
    .map(([from, to]) => `  - from: ${from}\n    to: ${to}\n    kind: calls\n${label ? `    label: ${label}\n` : ''}`)
    .join('');
}

describe('validator content-density rules', () => {
  it('E017 flags an overview above its per-level hard cap', () => {
    const ids = Array.from({ length: 13 }, (_, i) => `n${i}`);
    rawMap(
      'overview-big',
      `schema: 1\ntitle: Big overview\ntype: graph\nlevel: overview\nsummary: too many nodes for an overview\nnodes:\n${nodes(ids)}edges: []\n`,
    );
    const report = validateProject(project);
    expect(codes(report)).toContain('E017');
  });

  it('E017 does not flag an overview at its cap', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `n${i}`);
    rawMap(
      'overview-ok',
      `schema: 1\ntitle: Overview\ntype: graph\nlevel: overview\nsummary: at the cap\nnodes:\n${nodes(ids)}edges: []\n`,
    );
    const report = validateProject(project);
    expect(codes(report)).not.toContain('E017');
  });

  it('E018 flags an edge/node ratio above 2.0', () => {
    const pairs: Array<[string, string]> = [
      ['a', 'b'], ['a', 'c'], ['a', 'd'],
      ['b', 'a'], ['b', 'c'], ['b', 'd'],
      ['c', 'a'], ['c', 'b'], ['c', 'd'],
    ];
    rawMap(
      'dense',
      `schema: 1\ntitle: Dense\ntype: graph\nlevel: feature\nsummary: dense graph\nnodes:\n${nodes(['a', 'b', 'c', 'd'])}edges:\n${edges(pairs)}`,
    );
    const report = validateProject(project);
    expect(codes(report)).toContain('E018');
  });

  it('W120 flags a hub above the degree limit', () => {
    const ids = ['hub', 'a', 'b', 'c', 'd', 'e', 'f'];
    const pairs: Array<[string, string]> = [['hub', 'a'], ['hub', 'b'], ['hub', 'c'], ['hub', 'd'], ['hub', 'e'], ['hub', 'f']];
    rawMap(
      'hub',
      `schema: 1\ntitle: Hub\ntype: graph\nlevel: feature\nsummary: hub graph\nnodes:\n${nodes(ids)}edges:\n${edges(pairs)}`,
    );
    const report = validateProject(project);
    expect(codes(report)).toContain('W120');
  });

  it('W122 flags a map where most edges carry labels', () => {
    rawMap(
      'labelled',
      `schema: 1\ntitle: Labelled\ntype: graph\nlevel: feature\nsummary: labels everywhere\nnodes:\n${nodes(['a', 'b', 'c'])}edges:\n${edges([['a', 'b'], ['b', 'c'], ['a', 'c']], 'calls')}`,
    );
    const report = validateProject(project);
    expect(codes(report)).toContain('W122');
  });

  it('W123 flags more than four groups', () => {
    const groups = Array.from({ length: 5 }, (_, i) => `  - id: g${i}\n    label: Group ${i}\n`).join('');
    rawMap(
      'many-groups',
      `schema: 1\ntitle: Groups\ntype: graph\nlevel: feature\nsummary: five groups\ngroups:\n${groups}nodes:\n${nodes(['a', 'b'])}edges:\n${edges([['a', 'b']])}`,
    );
    const report = validateProject(project);
    expect(codes(report)).toContain('W123');
  });

  it('W124 flags a chain deeper than six ranks', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const pairs: Array<[string, string]> = [
      ['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'f'], ['f', 'g'], ['g', 'h'],
    ];
    rawMap(
      'deep',
      `schema: 1\ntitle: Deep\ntype: graph\nlevel: detail\nsummary: long chain\nnodes:\n${nodes(ids)}edges:\n${edges(pairs)}`,
    );
    const report = validateProject(project);
    expect(codes(report)).toContain('W124');
  });

  it('W125 flags a process-like graph that should be a sequence', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const pairs: Array<[string, string]> = [
      ['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'f'], ['f', 'g'],
    ];
    rawMap(
      'process-graph',
      `schema: 1\ntitle: Process\ntype: graph\nlevel: feature\nsummary: looks like a sequence\nnodes:\n${nodes(ids, 'process')}edges:\n${edges(pairs)}`,
    );
    const report = validateProject(project);
    expect(codes(report)).toContain('W125');
  });

  it('W126 flags a map whose edges mostly cross groups', () => {
    const groups = `  - id: left\n    label: Left\n  - id: right\n    label: Right\n`;
    const bodyNodes = `  - id: a1\n    label: A1\n    kind: external\n    group: left\n  - id: a2\n    label: A2\n    kind: external\n    group: left\n  - id: b1\n    label: B1\n    kind: external\n    group: right\n  - id: b2\n    label: B2\n    kind: external\n    group: right\n`;
    rawMap(
      'cross-group',
      `schema: 1\ntitle: Cross\ntype: graph\nlevel: feature\nsummary: cross group edges\ngroups:\n${groups}nodes:\n${bodyNodes}edges:\n${edges([['a1', 'b1'], ['a2', 'b2'], ['a1', 'b2'], ['b1', 'a2']])}`,
    );
    const report = validateProject(project);
    expect(codes(report)).toContain('W126');
  });

  it('W127 flags an edge that spans more than two ranks', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const pairs: Array<[string, string]> = [
      ['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['a', 'e'],
    ];
    rawMap(
      'skip-edge',
      `schema: 1\ntitle: Skip\ntype: graph\nlevel: feature\nsummary: long edge\nnodes:\n${nodes(ids)}edges:\n${edges(pairs)}`,
    );
    const report = validateProject(project);
    expect(codes(report)).toContain('W127');
  });

  it('W101 flags an edge label longer than the configured cap', () => {
    rawMap(
      'long-edge-label',
      `schema: 1\ntitle: Labels\ntype: graph\nlevel: feature\nsummary: long edge label\nnodes:\n${nodes(['a', 'b'])}edges:\n${edges([['a', 'b']], 'this edge label is far too long to read')}`,
    );
    const report = validateProject(project);
    expect(codes(report)).toContain('W101');
  });
});
