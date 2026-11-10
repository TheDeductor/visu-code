import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkExtendedEdge, ElkNode, ElkPoint } from 'elkjs/lib/elk-api.js';
import type { Direction, GraphLayout, GraphMap, LayoutBox, LayoutEdge, LayoutGroup, Theme } from './types.js';
import { edgeId, layoutMap, measureNodeBox, type LayoutOptions } from './layout.js';
import { labelFontSize, wrapText, NODE_PADDING_X } from './theme.js';
import { polylinePath } from './geometry.js';
import type { LayoutEngine } from './layout-engine.js';

export type ElkNodePlacement = 'BRANDES_KOEPF' | 'LINEAR_SEGMENTS' | 'NETWORK_SIMPLEX';
export type ElkEdgeRouting = 'ORTHOGONAL' | 'POLYLINE' | 'SPLINES';

export interface ElkLayoutOptions extends LayoutOptions {
  nodePlacement?: ElkNodePlacement;
  edgeRouting?: ElkEdgeRouting;
  direction?: Direction;
  /** Lay nodes out flat, then derive group boxes from member extents. */
  flattenGroups?: boolean;
  spacing?: { rank?: number; node?: number; edgeNode?: number; edgeEdge?: number };
}

interface VibeElkEdge {
  id: string;
  from: string;
  to: string;
  kind: string;
  label?: string;
  labelLines: string[];
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function elkDirection(direction: Direction): string {
  switch (direction) {
    case 'left':
      return 'LEFT';
    case 'down':
      return 'DOWN';
    case 'up':
      return 'UP';
    default:
      return 'RIGHT';
  }
}

function edgeLabelPosition(points: ElkPoint[]): ElkPoint {
  let best = { len: -1, a: points[0]!, b: points[1]! };
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len > best.len) best = { len, a, b };
  }
  const mid = { x: (best.a.x + best.b.x) / 2, y: (best.a.y + best.b.y) / 2 };
  const dx = best.b.x - best.a.x;
  const dy = best.b.y - best.a.y;
  return Math.abs(dx) >= Math.abs(dy) ? { x: mid.x, y: mid.y - 12 } : { x: mid.x + 12, y: mid.y };
}

function directionOf(map: GraphMap, options: ElkLayoutOptions): Direction {
  return options.direction ?? map.direction ?? 'right';
}

export async function layoutGraphElk(
  map: GraphMap,
  theme: Theme,
  options: ElkLayoutOptions = {},
): Promise<GraphLayout> {
  const sidecar = options.sidecar;
  const groups = map.groups ?? [];
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const nodeById = new Map(map.nodes.map((node) => [node.id, node]));
  const nodeGroup = new Map<string, string>();
  for (const node of map.nodes) {
    if (node.group && groupById.has(node.group)) nodeGroup.set(node.id, node.group);
  }

  const dims = new Map<string, { w: number; h: number; lines: string[] }>();
  for (const node of map.nodes) {
    const side = sidecar?.nodes[node.id];
    if (side) {
      dims.set(node.id, {
        w: side.w,
        h: side.h,
        lines: wrapText(node.label, Math.max(60, side.w - NODE_PADDING_X * 2), labelFontSize(theme)),
      });
    } else {
      dims.set(node.id, measureNodeBox(node.label, node.kind, theme));
    }
  }

  const leaf = (nodeId: string): ElkNode => {
    const dim = dims.get(nodeId)!;
    return { id: `n:${nodeId}`, width: dim.w, height: dim.h };
  };

  const membersByGroup = new Map<string, string[]>();
  const ungrouped: string[] = [];
  for (const node of map.nodes) {
    const gid = nodeGroup.get(node.id);
    if (gid) {
      const list = membersByGroup.get(gid) ?? [];
      list.push(node.id);
      membersByGroup.set(gid, list);
    } else {
      ungrouped.push(node.id);
    }
  }

  const padX = theme.groupPad?.x ?? 36;
  const padTop = theme.groupPad?.top ?? 44;
  const padBottom = theme.groupPad?.bottom ?? 28;

  const flattenGroups = !!options.flattenGroups;
  const rootChildren: ElkNode[] = [];
  const dummyEdgesByGroup = new Map<string, ElkExtendedEdge[]>();
  if (flattenGroups) {
    for (const node of map.nodes) rootChildren.push(leaf(node.id));
  } else {
    for (const group of groups) {
      const members = membersByGroup.get(group.id) ?? [];
      if (!members.length) continue;
      const node: ElkNode = {
        id: `g:${group.id}`,
        children: members.map(leaf),
        layoutOptions: {
          'elk.padding': `[top=${padTop},left=${padX},bottom=${padBottom},right=${padX}]`,
        },
      };
      membersByGroup.set(group.id, members);

      // elkjs 0.12 crashes on compound graphs whose groups have no internal
      // edge. A layout-only dummy edge between two members works around it; it
      // is dropped from the returned LayoutResult.
      const hasInternalEdge = map.edges.some(
        (edge) => nodeGroup.get(edge.from) === group.id && nodeGroup.get(edge.to) === group.id,
      );
      if (!hasInternalEdge && members.length >= 2) {
        dummyEdgesByGroup.set(group.id, [
          { id: `dummy:${group.id}`, sources: [`n:${members[0]}`], targets: [`n:${members[1]}`] },
        ]);
      }

      rootChildren.push(node);
    }
    for (const nodeId of ungrouped) rootChildren.push(leaf(nodeId));
  }

  const vibeEdges: VibeElkEdge[] = [];
  const edgesByContainer = new Map<string, ElkExtendedEdge[]>();
  map.edges.forEach((edge, index) => {
    if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) return;
    const id = edgeId(edge, index);
    const lines = edge.label ? wrapText(edge.label, 140, 13) : [];
    vibeEdges.push({ id, from: edge.from, to: edge.to, kind: edge.kind, label: edge.label, labelLines: lines });

    const fromGroup = nodeGroup.get(edge.from);
    const toGroup = nodeGroup.get(edge.to);
    const container = !flattenGroups && fromGroup && fromGroup === toGroup ? `g:${fromGroup}` : 'root';
    // elkjs 0.12 crashes on edge labels inside compound groups, so labels are
    // placed from the routed polyline after layout instead.
    const elkEdge: ElkExtendedEdge = {
      id: `e:${id}`,
      sources: [`n:${edge.from}`],
      targets: [`n:${edge.to}`],
    };
    const list = edgesByContainer.get(container) ?? [];
    list.push(elkEdge);
    edgesByContainer.set(container, list);
  });

  const root: ElkNode = {
    id: 'root',
    children: rootChildren,
    ...(edgesByContainer.get('root') ? { edges: edgesByContainer.get('root') } : {}),
  };
  for (const child of rootChildren) {
    if (!child.id.startsWith('g:')) continue;
    const groupId = child.id.slice(2);
    const edges = [...(edgesByContainer.get(child.id) ?? []), ...(dummyEdgesByGroup.get(groupId) ?? [])];
    if (edges.length) child.edges = edges;
  }

  const layoutOptions: Record<string, string> = {
    'elk.algorithm': 'layered',
    'elk.direction': elkDirection(directionOf(map, options)),
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    'elk.edgeRouting': options.edgeRouting ?? 'ORTHOGONAL',
    'elk.layered.spacing.nodeNodeBetweenLayers': String(options.spacing?.rank ?? 100),
    'elk.spacing.nodeNode': String(options.spacing?.node ?? 48),
    'elk.spacing.edgeNode': String(options.spacing?.edgeNode ?? 24),
    'elk.spacing.edgeEdge': String(options.spacing?.edgeEdge ?? 16),
    'elk.padding': '[top=30,left=30,bottom=30,right=30]',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.layered.nodePlacement.strategy': options.nodePlacement ?? 'BRANDES_KOEPF',
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    'elk.separateConnectedComponents': 'false',
  };

  const elk = new ELK();
  const result = (await elk.layout(root, { layoutOptions })) as ElkNode;

  const layoutNodes: LayoutBox[] = [];
  const layoutGroups: LayoutGroup[] = [];
  const offsets = new Map<string, ElkPoint>([['root', { x: 0, y: 0 }]]);

  const walk = (node: ElkNode, offsetX: number, offsetY: number): void => {
    const x = offsetX + (node.x ?? 0);
    const y = offsetY + (node.y ?? 0);
    offsets.set(node.id, { x, y });
    if (node.id.startsWith('n:')) {
      const nodeId = node.id.slice(2);
      const dim = dims.get(nodeId)!;
      const vibe = nodeById.get(nodeId)!;
      layoutNodes.push({
        id: nodeId,
        x: round(x),
        y: round(y),
        w: round(dim.w),
        h: round(dim.h),
        labelLines: dim.lines,
        kind: vibe.kind,
        group: nodeGroup.get(nodeId),
        pinned: false,
      });
    } else if (node.id.startsWith('g:')) {
      const groupId = node.id.slice(2);
      const group = groupById.get(groupId)!;
      layoutGroups.push({
        id: groupId,
        label: group.label,
        x: round(x),
        y: round(y),
        w: round(node.width ?? 0),
        h: round(node.height ?? 0),
      });
    }
    for (const child of node.children ?? []) walk(child, x, y);
  };
  walk(result, 0, 0);

  if (flattenGroups) {
    for (const group of groups) {
      const members = layoutNodes.filter((node) => node.group === group.id);
      if (!members.length) continue;
      const minX = Math.min(...members.map((node) => node.x));
      const minY = Math.min(...members.map((node) => node.y));
      const maxX = Math.max(...members.map((node) => node.x + node.w));
      const maxY = Math.max(...members.map((node) => node.y + node.h));
      layoutGroups.push({
        id: group.id,
        label: group.label,
        x: round(minX - padX),
        y: round(minY - padTop),
        w: round(maxX - minX + padX * 2),
        h: round(maxY - minY + padTop + padBottom),
      });
    }
  }

  layoutGroups.sort((a, b) => groups.findIndex((g) => g.id === a.id) - groups.findIndex((g) => g.id === b.id));
  const nodeOrder = new Map(map.nodes.map((node, index) => [node.id, index]));
  layoutNodes.sort((a, b) => (nodeOrder.get(a.id) ?? 0) - (nodeOrder.get(b.id) ?? 0));

  const edgeMeta = new Map(vibeEdges.map((edge) => [`e:${edge.id}`, edge]));
  const layoutEdges: LayoutEdge[] = [];
  const collectEdges = (container: ElkNode): void => {
    const offset = offsets.get(container.id) ?? { x: 0, y: 0 };
    for (const elkEdge of container.edges ?? []) {
      if (elkEdge.id.startsWith('dummy:')) continue;
      const meta = edgeMeta.get(elkEdge.id);
      if (!meta) continue;
      const section = elkEdge.sections?.[0];
      if (!section) continue;
      const points: ElkPoint[] = [
        section.startPoint,
        ...(section.bendPoints ?? []),
        section.endPoint,
      ].map((point) => ({ x: offset.x + point.x, y: offset.y + point.y }));
      if (points.length < 2) continue;

      const labelPos = edgeLabelPosition(points);

      layoutEdges.push({
        id: meta.id,
        from: meta.from,
        to: meta.to,
        kind: meta.kind,
        label: meta.label,
        labelLines: meta.labelLines,
        path: polylinePath(points, 10),
        points: points.map((point) => ({ x: round(point.x), y: round(point.y) })),
        labelPos: { x: round(labelPos.x), y: round(labelPos.y) },
      });
    }
    for (const child of container.children ?? []) collectEdges(child);
  };
  collectEdges(result);

  const maxX = Math.max(
    0,
    ...layoutNodes.map((node) => node.x + node.w),
    ...layoutGroups.map((group) => group.x + group.w),
  );
  const maxY = Math.max(
    0,
    ...layoutNodes.map((node) => node.y + node.h),
    ...layoutGroups.map((group) => group.y + group.h),
  );

  return {
    type: 'graph',
    width: Math.ceil(Math.max(result.width ?? 0, maxX + 30, 420)),
    height: Math.ceil(Math.max(result.height ?? 0, maxY + 30, 300)),
    nodes: layoutNodes,
    edges: layoutEdges,
    groups: layoutGroups,
    direction: directionOf(map, options),
    warnings: flattenGroups ? ['ELK_FLAT_GROUPS'] : [],
  };
}

export const elkEngine: LayoutEngine = {
  name: 'elk',
  async layout(map, theme, options = {}) {
    if (map.type !== 'graph') return layoutMap(map, theme, options);
    const elkOptions = options as ElkLayoutOptions;
    try {
      return await layoutGraphElk(map, theme, elkOptions);
    } catch {
      // elkjs 0.12 compound bug: fall back to a flat layout with derived
      // group boxes rather than failing the whole map.
      const flat = await layoutGraphElk(map, theme, { ...elkOptions, flattenGroups: true });
      return {
        ...flat,
        warnings: [...flat.warnings, 'W-ELK-FLAT: compound layout failed; groups flattened.'],
      };
    }
  },
};
