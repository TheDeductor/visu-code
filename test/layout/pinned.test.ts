import { describe, expect, it } from 'vitest';
import type { GraphMap, Theme } from '../../src/core/types.js';
import { defaultTheme } from '../../src/core/defaults.js';
import { layoutMap } from '../../src/core/layout.js';
import { layoutQuality } from '../../src/core/layout-quality.js';

describe('Phase 7 pinned nodes policy and routing', () => {
  const theme: Theme = defaultTheme();

  it('honors exact pinned coordinates from sidecar', () => {
    const map: GraphMap = {
      schema: 1,
      title: 'Pinned Test',
      type: 'graph',
      level: 'feature',
      direction: 'right',
      nodes: [
        { id: 'a', label: 'Node A', kind: 'service' },
        { id: 'b', label: 'Node B', kind: 'service' },
      ],
      edges: [{ from: 'a', to: 'b', kind: 'calls' }],
    };

    const res = layoutMap(map, theme, {
      sidecar: {
        schema: 1,
        map: 'pinned-test',
        nodes: {
          a: { x: 450, y: 350, w: 140, h: 56, pinned: true },
        },
      },
    });

    if (res.type !== 'graph') throw new Error('Expected graph');
    const nodeA = res.nodes.find((n) => n.id === 'a');
    expect(nodeA?.x).toBe(450);
    expect(nodeA?.y).toBe(350);
    expect(nodeA?.pinned).toBe(true);
  });

  it('pinned node outside its original group enlarges the group box', () => {
    const map: GraphMap = {
      schema: 1,
      title: 'Enlarged Group Test',
      type: 'graph',
      level: 'feature',
      direction: 'right',
      groups: [{ id: 'g1', label: 'Group 1', kind: 'boundary' }],
      nodes: [
        { id: 'a', label: 'Node A', kind: 'service', group: 'g1' },
        { id: 'b', label: 'Node B', kind: 'service', group: 'g1' },
      ],
      edges: [{ from: 'a', to: 'b', kind: 'calls' }],
    };

    // Default layout without pin
    const unpinnedRes = layoutMap(map, theme);
    if (unpinnedRes.type !== 'graph') throw new Error('Expected graph');
    const unpinnedGroup = unpinnedRes.groups.find((g) => g.id === 'g1')!;

    // Pin node B far away to the right and down
    const pinnedRes = layoutMap(map, theme, {
      sidecar: {
        schema: 1,
        map: 'enlarged-group',
        nodes: {
          b: { x: 800, y: 600, w: 140, h: 56, pinned: true },
        },
      },
    });

    if (pinnedRes.type !== 'graph') throw new Error('Expected graph');
    const pinnedGroup = pinnedRes.groups.find((g) => g.id === 'g1')!;
    const pinnedNodeB = pinnedRes.nodes.find((n) => n.id === 'b')!;

    // The group must have expanded to contain pinned node B
    expect(pinnedGroup.w).toBeGreaterThan(unpinnedGroup.w);
    expect(pinnedGroup.h).toBeGreaterThan(unpinnedGroup.h);
    expect(pinnedNodeB.x).toBeGreaterThanOrEqual(pinnedGroup.x);
    expect(pinnedNodeB.x + pinnedNodeB.w).toBeLessThanOrEqual(pinnedGroup.x + pinnedGroup.w + 1e-4);
    expect(pinnedNodeB.y).toBeGreaterThanOrEqual(pinnedGroup.y);
    expect(pinnedNodeB.y + pinnedNodeB.h).toBeLessThanOrEqual(pinnedGroup.y + pinnedGroup.h + 1e-4);
  });

  it('pinned node collision produces W-PINNED-OVERLAP warning', () => {
    const map: GraphMap = {
      schema: 1,
      title: 'Overlap Test',
      type: 'graph',
      level: 'feature',
      direction: 'right',
      nodes: [
        { id: 'a', label: 'Node A', kind: 'service' },
        { id: 'b', label: 'Node B', kind: 'service' },
      ],
      edges: [],
    };

    const res = layoutMap(map, theme, {
      sidecar: {
        schema: 1,
        map: 'overlap-test',
        nodes: {
          a: { x: 100, y: 100, w: 140, h: 56, pinned: true },
          b: { x: 105, y: 105, w: 140, h: 56, pinned: true },
        },
      },
    });

    if (res.type !== 'graph') throw new Error('Expected graph');
    expect(res.warnings.some((w) => w.includes('W-PINNED-OVERLAP'))).toBe(true);
  });

  it('pinned node causing group overlap produces W-PINNED-GROUP warning', () => {
    const map: GraphMap = {
      schema: 1,
      title: 'Group Overlap Test',
      type: 'graph',
      level: 'feature',
      direction: 'right',
      groups: [
        { id: 'g1', label: 'Group 1', kind: 'boundary' },
        { id: 'g2', label: 'Group 2', kind: 'boundary' },
      ],
      nodes: [
        { id: 'a', label: 'Node A', kind: 'service', group: 'g1' },
        { id: 'b', label: 'Node B', kind: 'service', group: 'g2' },
      ],
      edges: [],
    };

    // Pin node a right on top of where group 2 node b is placed
    const res = layoutMap(map, theme, {
      sidecar: {
        schema: 1,
        map: 'group-overlap-test',
        nodes: {
          a: { x: 200, y: 200, w: 140, h: 56, pinned: true },
          b: { x: 220, y: 210, w: 140, h: 56, pinned: true },
        },
      },
    });

    if (res.type !== 'graph') throw new Error('Expected graph');
    expect(res.warnings.some((w) => w.includes('W-PINNED-GROUP'))).toBe(true);
  });

  it('unpinned maps maintain zero hard violations', () => {
    const map: GraphMap = {
      schema: 1,
      title: 'Clean Unpinned',
      type: 'graph',
      level: 'feature',
      direction: 'right',
      groups: [{ id: 'g1', label: 'Group 1', kind: 'boundary' }],
      nodes: [
        { id: 'a', label: 'Node A', kind: 'service', group: 'g1' },
        { id: 'b', label: 'Node B', kind: 'service', group: 'g1' },
        { id: 'c', label: 'Node C', kind: 'service' },
      ],
      edges: [
        { from: 'a', to: 'b', kind: 'calls' },
        { from: 'b', to: 'c', kind: 'calls' },
      ],
    };

    const res = layoutMap(map, theme);
    const q = layoutQuality(res, theme);
    expect(q.nodeOverlaps).toBe(0);
    expect(q.groupOverlaps).toBe(0);
    expect(q.groupContainmentViolations).toBe(0);
    expect(q.edgeNodeCrossings).toBe(0);
    expect(q.labelOverlaps).toBe(0);
  });
});

