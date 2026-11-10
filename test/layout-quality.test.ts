import { describe, expect, it } from 'vitest';
import type { GraphLayout, LayoutBox, LayoutEdge, LayoutGroup, LayoutResult, SequenceLayout } from '../src/core/types.js';
import { defaultTheme } from '../src/core/defaults.js';
import { layoutQuality } from '../src/core/layout-quality.js';

const theme = defaultTheme();

function node(id: string, x: number, y: number, w = 100, h = 50, extra: Partial<LayoutBox> = {}): LayoutBox {
  return { id, x, y, w, h, labelLines: [id], kind: 'service', ...extra };
}

function group(id: string, x: number, y: number, w: number, h: number): LayoutGroup {
  return { id, label: id, x, y, w, h };
}

function edge(
  id: string,
  from: string,
  to: string,
  points: Array<{ x: number; y: number }>,
  options: { label?: string; labelPos?: { x: number; y: number }; path?: string } = {},
): LayoutEdge {
  const path = options.path ?? `M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')}`;
  return {
    id,
    from,
    to,
    kind: 'calls',
    labelLines: options.label ? [options.label] : [],
    path,
    points,
    labelPos: options.labelPos ?? { x: 0, y: 0 },
    ...(options.label ? { label: options.label } : {}),
  };
}

function graph(parts: Partial<GraphLayout> = {}): GraphLayout {
  return {
    type: 'graph',
    width: 600,
    height: 400,
    nodes: [],
    edges: [],
    groups: [],
    direction: 'right',
    warnings: [],
    ...parts,
  };
}

describe('layoutQuality', () => {
  it('returns zeros for a clean layout', () => {
    const layout = graph({
      nodes: [node('a', 0, 0), node('b', 400, 0)],
      edges: [edge('e', 'a', 'b', [{ x: 100, y: 25 }, { x: 400, y: 25 }])],
    });
    const q = layoutQuality(layout, theme);
    expect(q.nodeOverlaps).toBe(0);
    expect(q.groupOverlaps).toBe(0);
    expect(q.groupMarginViolations).toBe(0);
    expect(q.groupContainmentViolations).toBe(0);
    expect(q.edgeNodeCrossings).toBe(0);
    expect(q.edgeCrossings).toBe(0);
    expect(q.labelOverlaps).toBe(0);
    expect(q.portViolations).toBe(0);
    expect(q.maxNodeDegree).toBe(1);
    expect(q.bends).toBe(0);
  });

  it('counts node overlaps with the theme margin', () => {
    const layout = graph({ nodes: [node('a', 0, 0), node('b', 110, 0)] });
    expect(layoutQuality(layout, theme).nodeOverlaps).toBe(1);
  });

  it('counts group overlaps and margin violations', () => {
    const layout = graph({ groups: [group('g1', 0, 0, 100, 100), group('g2', 50, 50, 100, 100)] });
    const q = layoutQuality(layout, theme);
    expect(q.groupOverlaps).toBe(1);
    expect(q.groupMarginViolations).toBe(1);
  });

  it('counts a foreign node inside a group as a containment violation', () => {
    const layout = graph({
      groups: [group('g1', 0, 0, 200, 200)],
      nodes: [node('member', 10, 10, 60, 40, { group: 'g1' }), node('foreign', 80, 80, 60, 40)],
    });
    expect(layoutQuality(layout, theme).groupContainmentViolations).toBe(1);
  });

  it('counts an edge passing through an unrelated node', () => {
    const layout = graph({
      nodes: [node('a', 0, 0), node('b', 400, 0), node('c', 100, -20, 60, 40)],
      edges: [edge('e', 'a', 'b', [{ x: 100, y: 0 }, { x: 400, y: 0 }])],
    });
    expect(layoutQuality(layout, theme).edgeNodeCrossings).toBe(1);
  });

  it('counts crossing edges', () => {
    const layout = graph({
      nodes: [node('a', 0, 0, 40, 20), node('b', 400, 0, 40, 20), node('c', 0, 200, 40, 20), node('d', 400, 200, 40, 20)],
      edges: [
        edge('e1', 'a', 'b', [{ x: 20, y: 10 }, { x: 420, y: 210 }]),
        edge('e2', 'c', 'd', [{ x: 20, y: 210 }, { x: 420, y: 10 }]),
      ],
    });
    expect(layoutQuality(layout, theme).edgeCrossings).toBe(1);
  });

  it('counts overlapping edge labels', () => {
    const layout = graph({
      edges: [
        edge('e1', 'a', 'b', [{ x: 0, y: 0 }, { x: 100, y: 100 }], { label: 'reads', labelPos: { x: 50, y: 50 } }),
        edge('e2', 'c', 'd', [{ x: 0, y: 100 }, { x: 100, y: 0 }], { label: 'writes', labelPos: { x: 50, y: 50 } }),
      ],
    });
    expect(layoutQuality(layout, theme).labelOverlaps).toBe(1);
  });

  it('samples a cubic path and counts one bend', () => {
    const layout = graph({
      nodes: [node('a', 0, 0), node('b', 300, 300)],
      edges: [
        edge('e', 'a', 'b', [
          { x: 100, y: 25 },
          { x: 150, y: 25 },
          { x: 250, y: 300 },
          { x: 300, y: 300 },
        ], { path: 'M 100 25 C 150 25, 250 300, 300 300' }),
      ],
    });
    const q = layoutQuality(layout, theme);
    expect(q.bends).toBe(1);
    expect(Number.isFinite(q.edgeCrossings)).toBe(true);
  });

  it('counts an edge that crosses a foreign group while both endpoints are outside it', () => {
    const layout = graph({
      nodes: [
        node('a', 0, 300, 40, 20),
        node('b', 400, 300, 40, 20),
        node('member', 20, 60, 60, 40, { group: 'g1' }),
      ],
      groups: [{ id: 'g1', label: 'Group A', x: 0, y: 0, w: 300, h: 200 }],
      edges: [
        edge('through', 'a', 'b', [{ x: 20, y: 300 }, { x: 20, y: 100 }]),
        edge('boundary', 'member', 'b', [{ x: 80, y: 80 }, { x: 400, y: 300 }]),
      ],
    });
    expect(layoutQuality(layout, theme).edgeGroupCrossings).toBe(1);
  });

  it('counts group label overlaps with an edge and with an edge label', () => {
    const layout = graph({
      nodes: [
        node('a', 0, 300, 40, 20),
        node('b', 400, 300, 40, 20),
        node('c', 500, 500, 40, 20),
        node('d', 600, 600, 40, 20),
      ],
      groups: [{ id: 'g1', label: 'Group A', x: 0, y: 0, w: 300, h: 200 }],
      edges: [
        edge('path-through-label', 'a', 'b', [{ x: 0, y: 10 }, { x: 300, y: 10 }]),
        edge('label-over-label', 'c', 'd', [{ x: 500, y: 500 }, { x: 600, y: 600 }], {
          label: 'x',
          labelPos: { x: 30, y: 15 },
        }),
      ],
    });
    expect(layoutQuality(layout, theme).groupLabelOverlaps).toBe(2);
  });

  it('returns zeros and an aspect ratio for non-graph layouts', () => {
    const layout: SequenceLayout = { type: 'sequence', width: 200, height: 100, participants: [], steps: [], fragments: [] };
    const q: ReturnType<typeof layoutQuality> = layoutQuality(layout as LayoutResult, theme);
    expect(q.nodeOverlaps).toBe(0);
    expect(q.edgeGroupCrossings).toBe(0);
    expect(q.groupLabelOverlaps).toBe(0);
    expect(q.maxNodeDegree).toBe(0);
    expect(q.bends).toBe(0);
    expect(q.aspectRatio).toBe(2);
  });
});
