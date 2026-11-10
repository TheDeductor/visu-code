import type { GraphLayout, LayoutResult } from './types.js';
import type { Project } from './project.js';
import { loadMap } from './maps.js';
import { readLayout } from './project.js';
import { layoutMap } from './layout.js';
import { measureText } from './theme.js';
import { mapFileFromId } from './paths.js';
import { layoutQuality, type LayoutQualityMetrics } from './layout-quality.js';

export { layoutQuality };
export type LayoutQuality = LayoutQualityMetrics;
export type { LayoutQualityMetrics };

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
  quality: LayoutQualityMetrics;
  layout: LayoutResult;
}

export function inspectMap(project: Project, id: string): InspectReport {
  const loaded = loadMap(project, id);
  const sidecar = readLayout(project, id);
  const layout = layoutMap(loaded.map, project.theme, { sidecar });
  const quality = layoutQuality(layout, project.theme);
  const overlaps = quality.nodeOverlaps;
  const edgeCrossings = quality.edgeCrossings;
  const edgeNodeCrossings = quality.edgeNodeCrossings;
  let labelOverflow = 0;
  const warnings: string[] = [...quality.warnings];
  if (layout.type === 'graph') {
    const graph: GraphLayout = layout;
    for (const node of graph.nodes) {
      const maxWidth = node.w - 18 * 2;
      if (node.labelLines.some((line) => measureText(line, 16) > maxWidth + 1)) labelOverflow++;
    }
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
    quality,
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
  const q = report.quality;
  lines.push(`quality: nodeOverlaps=${q.nodeOverlaps} groupOverlaps=${q.groupOverlaps} groupMarginViolations=${q.groupMarginViolations} groupContainmentViolations=${q.groupContainmentViolations} edgeNodeCrossings=${q.edgeNodeCrossings} edgeCrossings=${q.edgeCrossings} labelOverlaps=${q.labelOverlaps} portViolations=${q.portViolations} maxNodeDegree=${q.maxNodeDegree} aspect=${q.aspectRatio.toFixed(2)} bends=${q.bends}`);
  lines.push(`canvas: ${Math.round(report.width)}x${Math.round(report.height)}`);
  if (report.warnings.length) lines.push(`warnings: ${report.warnings.join(' | ')}`);
  return lines.join('\n');
}

export function inspectMapFile(project: Project, id: string): string {
  return mapFileFromId(id);
}
