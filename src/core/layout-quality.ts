import type { GraphLayout, LayoutResult, Theme } from './types.js';
import { defaultTheme } from './defaults.js';
import { measureText } from './theme.js';

export interface LayoutQualityMetrics {
  nodeOverlaps: number;
  groupOverlaps: number;
  groupMarginViolations: number;
  groupContainmentViolations: number;
  edgeNodeCrossings: number;
  edgeCrossings: number;
  edgeGroupCrossings: number;
  groupLabelOverlaps: number;
  labelOverlaps: number;
  portViolations: number;
  maxNodeDegree: number;
  aspectRatio: number;
  bends: number;
  warnings: string[];
}

function sampleEdge(points: Array<{ x: number; y: number }>, steps = 24): Array<{ x: number; y: number }> {
  if (points.length < 4) return points;
  const [p0, p1, p2, p3] = points as [typeof points[number], typeof points[number], typeof points[number], typeof points[number]];
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    out.push({
      x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
      y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return out;
}

function pointInBox(p: { x: number; y: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
}

function segmentIntersectsBox(
  a: { x: number; y: number },
  b: { x: number; y: number },
  box: { x: number; y: number; w: number; h: number },
): boolean {
  const corners = [
    { x: box.x, y: box.y },
    { x: box.x + box.w, y: box.y },
    { x: box.x + box.w, y: box.y + box.h },
    { x: box.x, y: box.y + box.h },
  ];
  for (let i = 0; i < 4; i++) {
    if (segmentsIntersect(a, b, corners[i]!, corners[(i + 1) % 4]!)) return true;
  }
  return pointInBox(a, box) || pointInBox(b, box);
}

function orientation(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): number {
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}

function onSegment(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): boolean {
  return (
    Math.min(a.x, c.x) - 1e-9 <= b.x &&
    b.x <= Math.max(a.x, c.x) + 1e-9 &&
    Math.min(a.y, c.y) - 1e-9 <= b.y &&
    b.y <= Math.max(a.y, c.y) + 1e-9
  );
}

function segmentsIntersect(
  p1: { x: number; y: number },
  q1: { x: number; y: number },
  p2: { x: number; y: number },
  q2: { x: number; y: number },
): boolean {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  if (o1 * o2 < 0 && o3 * o4 < 0) return true;
  if (Math.abs(o1) < 1e-9 && onSegment(p1, p2, q1)) return true;
  if (Math.abs(o2) < 1e-9 && onSegment(p1, q2, q1)) return true;
  if (Math.abs(o3) < 1e-9 && onSegment(p2, p1, q2)) return true;
  if (Math.abs(o4) < 1e-9 && onSegment(p2, q1, q2)) return true;
  return false;
}

function detectSide(
  p: { x: number; y: number },
  box: { x: number; y: number; w: number; h: number },
): 'left' | 'right' | 'top' | 'bottom' {
  const dLeft = Math.abs(p.x - box.x);
  const dRight = Math.abs(p.x - (box.x + box.w));
  const dTop = Math.abs(p.y - box.y);
  const dBottom = Math.abs(p.y - (box.y + box.h));
  const min = Math.min(dLeft, dRight, dTop, dBottom);
  if (min === dLeft) return 'left';
  if (min === dRight) return 'right';
  if (min === dTop) return 'top';
  return 'bottom';
}

export function layoutQuality(layout: LayoutResult, theme?: Theme): LayoutQualityMetrics {
  const t = theme ?? defaultTheme();
  if (layout.type !== 'graph') {
    return {
      nodeOverlaps: 0,
      groupOverlaps: 0,
      groupMarginViolations: 0,
      groupContainmentViolations: 0,
      edgeNodeCrossings: 0,
      edgeCrossings: 0,
      edgeGroupCrossings: 0,
      groupLabelOverlaps: 0,
      labelOverlaps: 0,
      portViolations: 0,
      maxNodeDegree: 0,
      aspectRatio: layout.width / Math.max(1, layout.height),
      bends: 0,
      warnings: [],
    };
  }

  const graph: GraphLayout = layout;
  const nodeMargin = t.nodeMargin ?? 28;
  const groupSep = t.groupSep ?? 40;

  // 1. Node overlaps with nodeMargin (excluding pinned-pinned)
  let nodeOverlaps = 0;
  for (let i = 0; i < graph.nodes.length; i++) {
    for (let j = i + 1; j < graph.nodes.length; j++) {
      const a = graph.nodes[i]!;
      const b = graph.nodes[j]!;
      if (a.pinned && b.pinned) continue;
      const overlapX = a.x < b.x + b.w + nodeMargin - 1e-4 && a.x + a.w + nodeMargin > b.x + 1e-4;
      const overlapY = a.y < b.y + b.h + nodeMargin - 1e-4 && a.y + a.h + nodeMargin > b.y + 1e-4;
      if (overlapX && overlapY) nodeOverlaps++;
    }
  }

  // 2. Group overlaps & group margin violations
  let groupOverlaps = 0;
  let groupMarginViolations = 0;
  for (let i = 0; i < graph.groups.length; i++) {
    for (let j = i + 1; j < graph.groups.length; j++) {
      const g1 = graph.groups[i]!;
      const g2 = graph.groups[j]!;
      const overlaps =
        g1.x < g2.x + g2.w - 1e-4 &&
        g1.x + g1.w > g2.x + 1e-4 &&
        g1.y < g2.y + g2.h - 1e-4 &&
        g1.y + g1.h > g2.y + 1e-4;
      if (overlaps) {
        groupOverlaps++;
        groupMarginViolations++;
      } else {
        const dx = Math.max(0, Math.max(g1.x, g2.x) - Math.min(g1.x + g1.w, g2.x + g2.w));
        const dy = Math.max(0, Math.max(g1.y, g2.y) - Math.min(g1.y + g1.h, g2.y + g2.h));
        const dist = dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy);
        if (dist < groupSep - 1e-4) groupMarginViolations++;
      }
    }
  }

  // 3. Group containment: each group rect contains exactly its member nodes and no others
  let groupContainmentViolations = 0;
  for (const group of graph.groups) {
    for (const node of graph.nodes) {
      if (node.group === group.id) {
        const inside =
          node.x >= group.x - 1e-4 &&
          node.x + node.w <= group.x + group.w + 1e-4 &&
          node.y >= group.y - 1e-4 &&
          node.y + node.h <= group.y + group.h + 1e-4;
        if (!inside) groupContainmentViolations++;
      } else {
        const overlaps =
          node.x < group.x + group.w - 1e-4 &&
          node.x + node.w > group.x + 1e-4 &&
          node.y < group.y + group.h - 1e-4 &&
          node.y + node.h > group.y + 1e-4;
        if (overlaps) groupContainmentViolations++;
      }
    }
  }

  // Edge polyline points & segments (support legacy cubic Béziers if path contains 'C')
  const edgeSegments: Array<Array<{ x: number; y: number }>> = graph.edges.map((e) => {
    if (e.points.length === 4 && e.path.includes('C')) return sampleEdge(e.points, 24);
    return e.points;
  });

  // 4. Edge-node crossings: polyline segment crosses non-endpoint node rect (inflated 6px)
  let edgeNodeCrossings = 0;
  for (let i = 0; i < graph.edges.length; i++) {
    const edge = graph.edges[i]!;
    const pts = edgeSegments[i]!;
    for (const node of graph.nodes) {
      if (node.id === edge.from || node.id === edge.to) continue;
      const inflated = { x: node.x - 6, y: node.y - 6, w: node.w + 12, h: node.h + 12 };
      let hit = false;
      for (let k = 0; k < pts.length - 1; k++) {
        if (segmentIntersectsBox(pts[k]!, pts[k + 1]!, inflated)) {
          hit = true;
          break;
        }
      }
      if (hit) edgeNodeCrossings++;
    }
  }

  // 5. Edge-edge crossings
  let edgeCrossings = 0;
  for (let i = 0; i < graph.edges.length; i++) {
    const e1 = graph.edges[i]!;
    const pts1 = edgeSegments[i]!;
    for (let j = i + 1; j < graph.edges.length; j++) {
      const e2 = graph.edges[j]!;
      if (e1.from === e2.from || e1.from === e2.to || e1.to === e2.from || e1.to === e2.to) continue;
      const pts2 = edgeSegments[j]!;
      let hit = false;
      for (let a = 0; a < pts1.length - 1 && !hit; a++) {
        for (let b = 0; b < pts2.length - 1 && !hit; b++) {
          if (segmentsIntersect(pts1[a]!, pts1[a + 1]!, pts2[b]!, pts2[b + 1]!)) {
            hit = true;
          }
        }
      }
      if (hit) edgeCrossings++;
    }
  }

  // 6. Edge-group crossings: the edge crosses a group border while neither
  //    endpoint is inside that group. Edges that connect a group to the
  //    outside are legitimate and are not counted.
  let edgeGroupCrossings = 0;
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n] as const));
  const insideGroup = (
    nodeId: string,
    g: { x: number; y: number; w: number; h: number },
  ): boolean => {
    const n = nodeById.get(nodeId);
    if (!n) return false;
    return (
      n.x >= g.x - 1e-4 &&
      n.x + n.w <= g.x + g.w + 1e-4 &&
      n.y >= g.y - 1e-4 &&
      n.y + n.h <= g.y + g.h + 1e-4
    );
  };
  for (let i = 0; i < graph.edges.length; i++) {
    const edge = graph.edges[i]!;
    const pts = edgeSegments[i]!;
    for (const g of graph.groups) {
      if (insideGroup(edge.from, g) || insideGroup(edge.to, g)) continue;
      let hit = false;
      for (let k = 0; k < pts.length - 1 && !hit; k++) {
        if (segmentIntersectsBox(pts[k]!, pts[k + 1]!, g)) hit = true;
      }
      if (hit) edgeGroupCrossings++;
    }
  }

  // 7. Label overlaps: label rect overlaps node, any other label, or group header band (top 44px)
  let labelOverlaps = 0;
  const labelBoxes: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (const edge of graph.edges) {
    if (!edge.label || !edge.labelLines.length) continue;
    const lw = Math.max(...edge.labelLines.map((l) => measureText(l, 13)), 0) + 14;
    const lh = edge.labelLines.length * 17 + 8;
    labelBoxes.push({
      x: edge.labelPos.x - lw / 2,
      y: edge.labelPos.y - lh / 2,
      w: lw,
      h: lh,
    });
  }

  for (let i = 0; i < labelBoxes.length; i++) {
    const l1 = labelBoxes[i]!;
    for (const node of graph.nodes) {
      if (l1.x < node.x + node.w && l1.x + l1.w > node.x && l1.y < node.y + node.h && l1.y + l1.h > node.y) {
        labelOverlaps++;
        break;
      }
    }
    for (let j = i + 1; j < labelBoxes.length; j++) {
      const l2 = labelBoxes[j]!;
      if (l1.x < l2.x + l2.w && l1.x + l1.w > l2.x && l1.y < l2.y + l2.h && l1.y + l1.h > l2.y) {
        labelOverlaps++;
      }
    }
    for (const g of graph.groups) {
      const header = { x: g.x, y: g.y, w: g.w, h: 44 };
      if (l1.x < header.x + header.w && l1.x + l1.w > header.x && l1.y < header.y + header.h && l1.y + l1.h > header.y) {
        labelOverlaps++;
      }
    }
  }

  // 8. Group label overlaps: the group label rect against edge segments and
  //    edge labels. Matches the viewer label position (x+14, y+23 baseline).
  const GROUP_LABEL_PAD_X = 14;
  const GROUP_LABEL_PAD_Y = 8;
  const GROUP_LABEL_HEIGHT = 18;
  let groupLabelOverlaps = 0;
  const groupLabelBoxes = graph.groups.map((g) => ({
    x: g.x + GROUP_LABEL_PAD_X,
    y: g.y + GROUP_LABEL_PAD_Y,
    w: measureText(g.label, 13),
    h: GROUP_LABEL_HEIGHT,
  }));
  for (let i = 0; i < graph.edges.length; i++) {
    const pts = edgeSegments[i]!;
    for (const box of groupLabelBoxes) {
      let hit = false;
      for (let k = 0; k < pts.length - 1 && !hit; k++) {
        if (segmentIntersectsBox(pts[k]!, pts[k + 1]!, box)) hit = true;
      }
      if (hit) groupLabelOverlaps++;
    }
  }
  for (const label of labelBoxes) {
    for (const box of groupLabelBoxes) {
      if (
        label.x < box.x + box.w &&
        label.x + label.w > box.x &&
        label.y < box.y + box.h &&
        label.y + label.h > box.y
      ) {
        groupLabelOverlaps++;
      }
    }
  }

  // 9. Ports: no two edges share an anchor point on the same node side (distance >= 12 px)
  let portViolations = 0;
  for (const node of graph.nodes) {
    type Side = 'left' | 'right' | 'top' | 'bottom';
    const sidePorts: Record<Side, number[]> = { left: [], right: [], top: [], bottom: [] };
    for (const edge of graph.edges) {
      if (edge.from === node.id && edge.points.length > 0) {
        const pt = edge.points[0]!;
        const side = detectSide(pt, node);
        sidePorts[side].push(side === 'left' || side === 'right' ? pt.y : pt.x);
      }
      if (edge.to === node.id && edge.points.length > 0) {
        const pt = edge.points[edge.points.length - 1]!;
        const side = detectSide(pt, node);
        sidePorts[side].push(side === 'left' || side === 'right' ? pt.y : pt.x);
      }
    }
    for (const side of ['left', 'right', 'top', 'bottom'] as Side[]) {
      const coords = sidePorts[side].sort((a, b) => a - b);
      for (let k = 0; k < coords.length - 1; k++) {
        if (coords[k + 1]! - coords[k]! < 12 - 1e-4) {
          portViolations++;
        }
      }
    }
  }

  // 10. Degree: incident edge count per node (self-loops count twice)
  const degree = new Map<string, number>();
  for (const edge of graph.edges) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }
  let maxNodeDegree = 0;
  for (const node of graph.nodes) {
    maxNodeDegree = Math.max(maxNodeDegree, degree.get(node.id) ?? 0);
  }

  // 11. Bends: a cubic Bézier counts once; a polyline counts interior vertices.
  let bends = 0;
  for (const edge of graph.edges) {
    bends += edge.path.includes('C') ? 1 : Math.max(0, edge.points.length - 2);
  }

  return {
    nodeOverlaps,
    groupOverlaps,
    groupMarginViolations,
    groupContainmentViolations,
    edgeNodeCrossings,
    edgeCrossings,
    edgeGroupCrossings,
    groupLabelOverlaps,
    labelOverlaps,
    portViolations,
    maxNodeDegree,
    aspectRatio: graph.width / Math.max(1, graph.height),
    bends,
    warnings: graph.warnings,
  };
}
