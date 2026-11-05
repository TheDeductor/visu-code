import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GraphMap, LayoutResult, Theme, VibeEdge, VibeMap, VibeNode } from '../../src/core/types.js';
import { defaultTheme } from '../../src/core/defaults.js';
import { layoutMap } from '../../src/core/layout.js';
import { layoutQuality, type LayoutQuality } from '../../src/core/inspect.js';
import { parseYamlText } from '../../src/core/yaml.js';

const theme: Theme = defaultTheme();

function loadMapFixture(name: string): VibeMap {
  const filePath = path.join(process.cwd(), '.vibemap', 'maps', `${name}.vmap.yaml`);
  const text = fs.readFileSync(filePath, 'utf8');
  return parseYamlText(text).doc.toJS() as VibeMap;
}

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeFuzzedGraph(seed: number): GraphMap {
  const rand = mulberry32(seed);
  const nodeCount = 3 + Math.floor(rand() * 28); // 3 to 30 nodes
  const groupCount = Math.floor(rand() * 7); // 0 to 6 groups
  const density = 1.0 + rand() * 1.5; // 1.0 to 2.5 edges per node
  const totalEdges = Math.max(1, Math.floor(nodeCount * density));

  const groups = Array.from({ length: groupCount }, (_, i) => ({
    id: `g-${i}`,
    label: `Group ${i}`,
    kind: (['boundary', 'layer', 'team'] as const)[i % 3],
  }));

  const nodes: VibeNode[] = Array.from({ length: nodeCount }, (_, i) => {
    const assignGroup = groupCount > 0 && rand() < 0.65;
    const group = assignGroup ? `g-${Math.floor(rand() * groupCount)}` : undefined;
    return {
      id: `node-${i}`,
      label: `Node ${i} ${['Service', 'Database', 'Client', 'Worker', 'Cache', 'API'][i % 6]}`,
      kind: (['service', 'database', 'ui', 'process', 'cache', 'api'] as const)[i % 6]!,
      group,
      status: rand() < 0.2 ? 'planned' : 'built',
    };
  });

  const edges: VibeEdge[] = [];
  const edgeSet = new Set<string>();

  // Ensure connectivity and back/long edges
  for (let i = 0; i < nodeCount - 1; i++) {
    const from = `node-${i}`;
    const to = `node-${i + 1}`;
    edges.push({ from, to, kind: 'calls', label: `step-${i}` });
    edgeSet.add(`${from}->${to}`);
  }

  let attempts = 0;
  while (edges.length < totalEdges && attempts < totalEdges * 4) {
    attempts++;
    const fromIdx = Math.floor(rand() * nodeCount);
    const toIdx = Math.floor(rand() * nodeCount);
    const from = `node-${fromIdx}`;
    const to = `node-${toIdx}`;
    const key = `${from}->${to}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      edges.push({
        from,
        to,
        kind: fromIdx === toIdx ? 'flow' : fromIdx > toIdx ? 'returns' : 'calls',
        label: rand() < 0.7 ? `call-${edges.length}` : undefined,
      });
    }
  }

  return {
    schema: 1,
    title: `Fuzzed Graph ${seed}`,
    type: 'graph',
    level: 'feature',
    direction: (['right', 'down', 'left', 'up'] as const)[seed % 4],
    nodes,
    edges,
    groups: groups.length ? groups : undefined,
  };
}

describe('acceptance tests: layout quality and invariants', () => {
  const fixtureNames = [
    '00-overview',
    'agent-workflow',
    'diagram-pipeline',
    'drift-detection',
    'frontend-ui',
    'user-journey',
  ];

  describe('baseline inspection on repo fixtures', () => {
    it('captures baseline quality numbers for all 6 graph fixtures', () => {
      const summary: Record<string, LayoutQuality> = {};
      for (const name of fixtureNames) {
        const map = loadMapFixture(name);
        const layout = layoutMap(map, theme);
        const q = layoutQuality(layout, theme);
        summary[name] = q;
      }
      // Print table for visibility
      console.log('BASELINE QUALITY SUMMARY ON REPO FIXTURES:');
      console.table(
        Object.entries(summary).map(([name, q]) => ({
          map: name,
          nodeOverlaps: q.nodeOverlaps,
          groupOverlaps: q.groupOverlaps,
          groupMarginViolations: q.groupMarginViolations,
          groupContainmentViolations: q.groupContainmentViolations,
          edgeNodeCrossings: q.edgeNodeCrossings,
          edgeCrossings: q.edgeCrossings,
          labelOverlaps: q.labelOverlaps,
          portViolations: q.portViolations,
          aspect: Number(q.aspectRatio.toFixed(2)),
        }))
      );
      expect(Object.keys(summary)).toHaveLength(6);
    });
  });

  describe('invariants check across all fixtures and fuzzed graphs', () => {
    for (const name of fixtureNames) {
      it(`evaluates 10 invariants on fixture: ${name}`, () => {
        const map = loadMapFixture(name);
        const layout = layoutMap(map, theme);
        expect(layout.type).toBe('graph');
        const q = layoutQuality(layout, theme);

        // 1. No node-node overlap with nodeMargin
        expect(q.nodeOverlaps, `node overlaps in ${name}`).toBe(0);

        // 2. No group-group overlap and exact group containment
        expect(q.groupOverlaps, `group overlaps in ${name}`).toBe(0);
        expect(q.groupContainmentViolations, `group containment violations in ${name}`).toBe(0);

        // 3. Gap between any two group rects >= groupSep
        expect(q.groupMarginViolations, `group margin violations in ${name}`).toBe(0);

        // 4. No edge polyline segment crosses a non-endpoint node rect
        expect(q.edgeNodeCrossings, `edge-node crossings in ${name}`).toBe(0);

        // 5. No label rect overlaps node, other label, or group header band
        expect(q.labelOverlaps, `label overlaps in ${name}`).toBe(0);

        // 6. Ports >= 12px apart on the same side
        expect(q.portViolations, `port violations in ${name}`).toBe(0);

        // 7. Aspect ratio <= 2.5 for <= 14 nodes
        if (map.type === 'graph' && map.nodes.length <= 14) {
          expect(q.aspectRatio, `aspect ratio in ${name}`).toBeLessThanOrEqual(2.5);
        }

        // 8. Determinism
        const run1 = JSON.stringify(layout);
        const run2 = JSON.stringify(layoutMap(map, theme));
        expect(run1).toBe(run2);

        // 9. Pinned nodes
        const sidecar = {
          schema: 1 as const,
          map: name,
          nodes: { [map.type === 'graph' ? map.nodes[0]!.id : 'x']: { x: 500, y: 300, w: 180, h: 70, pinned: true } },
        };
        const pinnedLayout = layoutMap(map, theme, { sidecar });
        if (pinnedLayout.type === 'graph' && map.type === 'graph') {
          const pinnedNode = pinnedLayout.nodes.find((n) => n.id === map.nodes[0]!.id);
          expect(pinnedNode?.x).toBe(500);
          expect(pinnedNode?.y).toBe(300);
          expect(pinnedNode?.pinned).toBe(true);
        }
      });
    }

    it('evaluates invariants across 200 fuzzed graphs', () => {
      let totalViolations = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const graph = makeFuzzedGraph(seed);
        const layout = layoutMap(graph, theme);
        if (layout.type !== 'graph') continue;
        const q = layoutQuality(layout, theme);
        const violations =
          q.nodeOverlaps +
          q.groupOverlaps +
          q.groupMarginViolations +
          q.groupContainmentViolations +
          q.edgeNodeCrossings +
          q.labelOverlaps +
          q.portViolations;
        totalViolations += violations;
      }
      expect(totalViolations).toBe(0);
    });
  });
});
