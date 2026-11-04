import { describe, expect, it } from 'vitest';
import type { GraphMap, Theme, VibeEdge, VibeNode } from '../src/core/types.js';
import { defaultTheme } from '../src/core/defaults.js';
import { layoutMap } from '../src/core/layout.js';

const theme: Theme = defaultTheme();

function makeGraph(seed: number, count: number): GraphMap {
  let state = seed;
  const random = (): number => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  const nodes: VibeNode[] = Array.from({ length: count }, (_, i) => ({
    id: `node-${i}`,
    label: ['Login form', 'API', 'Database', 'Session store', 'External service', 'Worker'][i % 6]! + (i > 5 ? ` ${i}` : ''),
    kind: (['ui', 'api', 'database', 'cache', 'external', 'process'] as const)[i % 6]!,
    status: i % 7 === 0 ? 'planned' : 'built',
    group: i % 3 === 0 ? 'frontend' : i % 3 === 1 ? 'backend' : undefined,
    refs: i % 5 === 4 ? undefined : [{ path: `src/file-${i}.ts` }],
  }));
  const edges: VibeEdge[] = [];
  for (let i = 0; i < count - 1; i++) {
    if (random() < 0.7) edges.push({ from: `node-${i}`, to: `node-${i + 1}`, kind: i % 3 === 0 ? 'calls' : 'reads' });
  }
  for (let k = 0; k < Math.floor(count / 2); k++) {
    const from = Math.floor(random() * count);
    const to = Math.floor(random() * count);
    if (from !== to) edges.push({ from: `node-${from}`, to: `node-${to}`, kind: 'flow', label: `flow ${k}` });
  }
  return {
    schema: 1,
    title: `Generated ${seed}`,
    type: 'graph',
    level: 'feature',
    summary: 'generated',
    direction: (['right', 'down', 'left', 'up'] as const)[seed % 4],
    nodes,
    edges,
    groups: [
      { id: 'frontend', label: 'Frontend', kind: 'boundary' },
      { id: 'backend', label: 'Backend', kind: 'boundary' },
    ],
  };
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w - 0.01 && a.x + a.w > b.x + 0.01 && a.y < b.y + b.h - 0.01 && a.y + a.h > b.y + 0.01;
}

describe('layout', () => {
  it('never overlaps nodes on fuzzed graphs', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const graph = makeGraph(seed, 1 + (seed % 22));
      const layout = layoutMap(graph, theme);
      expect(layout.type).toBe('graph');
      if (layout.type !== 'graph') continue;
      for (let i = 0; i < layout.nodes.length; i++) {
        for (let j = i + 1; j < layout.nodes.length; j++) {
          expect(
            overlaps(layout.nodes[i]!, layout.nodes[j]!),
            `seed ${seed}: ${layout.nodes[i]!.id} overlaps ${layout.nodes[j]!.id}`,
          ).toBe(false);
        }
      }
      for (const node of layout.nodes) {
        expect(Number.isFinite(node.x)).toBe(true);
        expect(Number.isFinite(node.y)).toBe(true);
        expect(node.w).toBeGreaterThan(0);
        expect(node.h).toBeGreaterThan(0);
      }
      for (const edge of layout.edges) {
        expect(edge.path).toContain('M ');
        expect(edge.points).toHaveLength(4);
      }
    }
  });

  it('is deterministic for the same input', () => {
    const graph = makeGraph(7, 14);
    const one = JSON.stringify(layoutMap(graph, theme));
    const two = JSON.stringify(layoutMap(graph, theme));
    expect(one).toBe(two);
  });

  it('respects pinned coordinates and labels them pinned', () => {
    const graph = makeGraph(3, 8);
    const layout = layoutMap(graph, theme, {
      sidecar: {
        schema: 1,
        map: 'x',
        nodes: { 'node-0': { x: 500, y: 300, w: 180, h: 70, pinned: true } },
      },
    });
    if (layout.type !== 'graph') throw new Error('graph');
    const pinned = layout.nodes.find((node) => node.id === 'node-0');
    expect(pinned?.x).toBe(500);
    expect(pinned?.y).toBe(300);
    expect(pinned?.pinned).toBe(true);
    for (const node of layout.nodes) {
      if (node.id === 'node-0') continue;
      expect(overlaps(node, pinned!)).toBe(false);
    }
  });

  it('keeps most existing nodes close when one node is added', () => {
    const graph = makeGraph(11, 12);
    const first = layoutMap(graph, theme);
    if (first.type !== 'graph') throw new Error('graph');
    const next: GraphMap = {
      ...graph,
      nodes: [...graph.nodes, { id: 'new-node', label: 'New node', kind: 'service', status: 'planned' }],
      edges: [...graph.edges, { from: 'node-0', to: 'new-node', kind: 'calls' }],
    };
    const second = layoutMap(next, theme, { previous: first });
    if (second.type !== 'graph') throw new Error('graph');
    const before = new Map(first.nodes.map((node) => [node.id, node]));
    const unchanged = second.nodes.filter((node) => {
      const prior = before.get(node.id);
      return prior && Math.abs(prior.x - node.x) < 1 && Math.abs(prior.y - node.y) < 1;
    }).length;
    expect(unchanged / graph.nodes.length).toBeGreaterThan(0.25);
  });

  it('lays out a sequence deterministically', () => {
    const sequence = {
      schema: 1 as const,
      title: 'Login sequence',
      type: 'sequence' as const,
      level: 'feature' as const,
      summary: 'login',
      participants: [
        { id: 'browser', label: 'Browser', kind: 'actor' as const },
        { id: 'api', label: 'API', kind: 'service' as const },
        { id: 'db', label: 'Database', kind: 'database' as const },
      ],
      steps: [
        { from: 'browser', to: 'api', label: 'POST /login', kind: 'call' as const },
        { from: 'api', to: 'db', label: 'find user', kind: 'call' as const },
        { from: 'api', to: 'browser', label: 'Set-Cookie', kind: 'return' as const },
      ],
      fragments: [{ kind: 'alt' as const, label: 'wrong password', from_step: 1, to_step: 2 }],
    };
    const layout = layoutMap(sequence, theme);
    expect(layout.type).toBe('sequence');
    if (layout.type !== 'sequence') return;
    expect(layout.participants).toHaveLength(3);
    expect(layout.steps).toHaveLength(3);
    expect(layout.fragments).toHaveLength(1);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });

  it('lays out entity boxes with all fields', () => {
    const erd = {
      schema: 1 as const,
      title: 'Data',
      type: 'erd' as const,
      level: 'feature' as const,
      summary: 'data',
      entities: [
        { id: 'user', label: 'User', fields: [{ name: 'id', type: 'uuid', key: 'pk' as const }, { name: 'email', type: 'string', key: 'unique' as const }] },
        { id: 'note', label: 'Note', fields: [{ name: 'id', type: 'uuid', key: 'pk' as const }] },
      ],
      relations: [{ from: 'user', to: 'note', card: '1..n' as const, label: 'writes' }],
    };
    const layout = layoutMap(erd, theme);
    expect(layout.type).toBe('erd');
    if (layout.type !== 'erd') return;
    expect(layout.entities).toHaveLength(2);
    expect(layout.entities.find((entity) => entity.id === 'user')?.fields).toHaveLength(2);
    expect(layout.relations).toHaveLength(1);
  });
});
