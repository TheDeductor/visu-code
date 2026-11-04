import type { GraphLayout, LayoutResult, VibeMap } from './types.js';
import type { Project } from './project.js';
import { loadMap } from './maps.js';
import { readLayout } from './project.js';
import { layoutMap } from './layout.js';
import { measureText } from './theme.js';
import { mapFileFromId } from './paths.js';

export interface InspectReport {
  id: string;
  type: string;
  title: string;
  direction?: string;
  width: number;
  height: number;
  nodes: number;
  edges: number;
  groups: number;
  overlaps: number;
  edgeCrossings: number;
  edgeNodeCrossings: number;
  labelOverflow: number;
  pinned: number;
  warnings: string[];
  layout: LayoutResult;
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

function segmentIntersectsBox(a: { x: number; y: number }, b: { x: number; y: number }, box: { x: number; y: number; w: number; h: number }): boolean {
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
    Math.min(a.x, c.x) - 1e-9 <= b.x && b.x <= Math.max(a.x, c.x) + 1e-9 &&
    Math.min(a.y, c.y) - 1e-9 <= b.y && b.y <= Math.max(a.y, c.y) + 1e-9
  );
}

function segmentsIntersect(p1: { x: number; y: number }, q1: { x: number; y: number }, p2: { x: number; y: number }, q2: { x: number; y: number }): boolean {
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

export function inspectMap(project: Project, id: string): InspectReport {
  const loaded = loadMap(project, id);
  const sidecar = readLayout(project, id);
  const layout = layoutMap(loaded.map, project.theme, { sidecar });
  let overlaps = 0;
  let edgeCrossings = 0;
  let edgeNodeCrossings = 0;
  let labelOverflow = 0;
  const warnings: string[] = [];
  if (layout.type === 'graph') {
    const graph: GraphLayout = layout;
    for (let i = 0; i < graph.nodes.length; i++) {
      for (let j = i + 1; j < graph.nodes.length; j++) {
        const a = graph.nodes[i]!;
        const b = graph.nodes[j]!;
        if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) overlaps++;
      }
    }
    const samples = graph.edges.map((edge) => sampleEdge(edge.points));
    for (let i = 0; i < graph.edges.length; i++) {
      const edge = graph.edges[i]!;
      const points = samples[i]!;
      for (let j = 0; j < graph.nodes.length; j++) {
        const node = graph.nodes[j]!;
        if (node.id === edge.from || node.id === edge.to) continue;
        for (let k = 0; k < points.length - 1; k++) {
          if (segmentIntersectsBox(points[k]!, points[k + 1]!, node)) {
            edgeNodeCrossings++;
            break;
          }
        }
      }
      for (let j = i + 1; j < graph.edges.length; j++) {
        const other = graph.edges[j]!;
        if (other.from === edge.from || other.from === edge.to || other.to === edge.from || other.to === edge.to) continue;
        const otherPoints = samples[j]!;
        let hit = false;
        for (let a = 0; a < points.length - 1 && !hit; a++) {
          for (let b = 0; b < otherPoints.length - 1 && !hit; b++) {
            if (segmentsIntersect(points[a]!, points[a + 1]!, otherPoints[b]!, otherPoints[b + 1]!)) hit = true;
          }
        }
        if (hit) edgeCrossings++;
      }
    }
    for (const node of graph.nodes) {
      const maxWidth = node.w - 18 * 2;
      if (node.labelLines.some((line) => measureText(line, 16) > maxWidth + 1)) labelOverflow++;
    }
    warnings.push(...graph.warnings);
  }
  return {
    id,
    type: loaded.map.type,
    title: loaded.map.title,
    direction: loaded.map.direction,
    width: layout.width,
    height: layout.height,
    nodes: layout.type === 'graph' ? layout.nodes.length : layout.type === 'sequence' ? layout.participants.length : layout.type === 'erd' ? layout.entities.length : 0,
    edges: layout.type === 'graph' ? layout.edges.length : layout.type === 'sequence' ? layout.steps.length : layout.type === 'erd' ? layout.relations.length : 0,
    groups: layout.type === 'graph' ? layout.groups.length : 0,
    overlaps,
    edgeCrossings,
    edgeNodeCrossings,
    labelOverflow,
    pinned: layout.type === 'graph' ? layout.nodes.filter((n) => n.pinned).length : 0,
    warnings,
    layout,
  };
}

export function formatInspect(report: InspectReport): string {
  const lines: string[] = [];
  lines.push(`${report.id}  ${report.type}${report.direction ? `  direction=${report.direction}` : ''}  nodes=${report.nodes} edges=${report.edges} groups=${report.groups}`);
  if (report.layout.type === 'graph') {
    for (const node of report.layout.nodes) {
      lines.push(` ${node.id.padEnd(20)} (${Math.round(node.x)},${Math.round(node.y)})  ${Math.round(node.w)}x${Math.round(node.h)}${node.group ? `  group=${node.group}` : ''}${node.pinned ? '  pinned' : ''}`);
    }
  } else if (report.layout.type === 'sequence') {
    for (const p of report.layout.participants) lines.push(` ${p.id.padEnd(20)} x=${Math.round(p.x)} w=${Math.round(p.w)}`);
  } else if (report.layout.type === 'erd') {
    for (const e of report.layout.entities) lines.push(` ${e.id.padEnd(20)} (${Math.round(e.x)},${Math.round(e.y)})  ${e.fields.length} fields`);
  }
  lines.push(`overlaps: ${report.overlaps}   edge crossings: ${report.edgeCrossings}   edge/node crossings: ${report.edgeNodeCrossings}   label overflow: ${report.labelOverflow}   pinned: ${report.pinned}`);
  lines.push(`canvas: ${Math.round(report.width)}x${Math.round(report.height)}`);
  if (report.warnings.length) lines.push(`warnings: ${report.warnings.join(' | ')}`);
  return lines.join('\n');
}

export function inspectMapFile(project: Project, id: string): string {
  return mapFileFromId(id);
}
