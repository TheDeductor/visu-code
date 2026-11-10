import { describe, expect, it } from 'vitest';
import type { GraphMap, SequenceMap } from '../src/core/types.js';
import { defaultTheme } from '../src/core/defaults.js';
import { layoutMap } from '../src/core/layout.js';
import { getLayoutEngine, layoutMapAsync, legacyEngine } from '../src/core/layout-engine.js';

const theme = defaultTheme();

const graph: GraphMap = {
  schema: 1,
  title: 'Engine test',
  type: 'graph',
  level: 'feature',
  summary: 'two groups',
  direction: 'right',
  groups: [
    { id: 'left', label: 'Left', kind: 'boundary' },
    { id: 'right', label: 'Right', kind: 'boundary' },
  ],
  nodes: [
    { id: 'a', label: 'A', kind: 'service', status: 'built', group: 'left' },
    { id: 'b', label: 'B', kind: 'service', status: 'built', group: 'left' },
    { id: 'c', label: 'C', kind: 'service', status: 'built', group: 'right' },
    { id: 'd', label: 'D', kind: 'service', status: 'built', group: 'right' },
  ],
  edges: [
    { from: 'a', to: 'b', kind: 'calls' },
    { from: 'b', to: 'c', kind: 'calls' },
    { from: 'c', to: 'd', kind: 'calls' },
  ],
};

const sequence: SequenceMap = {
  schema: 1,
  title: 'Seq',
  type: 'sequence',
  level: 'feature',
  summary: 'seq',
  participants: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  steps: [{ from: 'a', to: 'b', label: 'call' }],
};

describe('layout engines', () => {
  it('legacyEngine matches layoutMap', async () => {
    const sync = layoutMap(graph, theme);
    const asyncResult = await legacyEngine.layout(graph, theme);
    expect(asyncResult).toEqual(sync);
    expect(await getLayoutEngine('legacy')).toBe(legacyEngine);
  });

  it('elk engine lays out a grouped graph', async () => {
    const layout = await layoutMapAsync(graph, theme, { engine: 'elk' });
    expect(layout.type).toBe('graph');
    if (layout.type !== 'graph') return;
    expect(layout.nodes.map((node) => node.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(layout.edges).toHaveLength(3);
    expect(layout.groups).toHaveLength(2);
    for (const node of layout.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.w).toBeGreaterThan(0);
      expect(node.h).toBeGreaterThan(0);
    }
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });

  it('elk engine is deterministic for the same input', async () => {
    const one = await layoutMapAsync(graph, theme, { engine: 'elk' });
    const two = await layoutMapAsync(graph, theme, { engine: 'elk' });
    expect(JSON.stringify(one)).toBe(JSON.stringify(two));
  });

  it('delegates non-graph maps to legacy', async () => {
    const layout = await layoutMapAsync(sequence, theme, { engine: 'elk' });
    expect(layout.type).toBe('sequence');
    expect(layout).toEqual(layoutMap(sequence, theme));
  });
});
