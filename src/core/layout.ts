import type {
  Direction,
  ErdMap,
  ErdRelation,
  GraphLayout,
  GraphMap,
  LayoutBox,
  LayoutEdge,
  LayoutGroup,
  LayoutResult,
  MapLayoutSidecar,
  SequenceLayout,
  Theme,
  VibeEdge,
  VibeMap,
  VibeNode,
} from './types.js';
import {
  NODE_PADDING_X,
  NODE_PADDING_Y,
  labelFontSize,
  labelLineHeight,
  measureText,
  wrapText,
} from './theme.js';

export interface LayoutOptions {
  sidecar?: MapLayoutSidecar | null;
  previous?: LayoutResult | null;
}

interface InternalBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  pinned: boolean;
  group?: string;
  localX?: number;
  localY?: number;
}

interface EdgeInput {
  id: string;
  from: string;
  to: string;
  kind: string;
  label?: string;
  weight?: number;
}

interface Point {
  x: number;
  y: number;
}

const PAD = 30;
const NODE_MARGIN = 28;

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function edgeId(edge: { id?: string; from: string; to: string; kind: string }, index: number): string {
  return edge.id ?? `${edge.from}>${edge.to}:${edge.kind}#${index}`;
}

function previousByName(previous?: LayoutResult | null): Map<string, { x: number; y: number; w: number; h: number }> {
  const out = new Map<string, { x: number; y: number; w: number; h: number }>();
  if (!previous) return out;
  if (previous.type === 'graph') for (const n of previous.nodes) out.set(n.id, n);
  if (previous.type === 'erd') for (const n of previous.entities) out.set(n.id, n);
  return out;
}

function measureNodeBox(
  label: string,
  kind: string,
  theme: Theme,
  incidentDegree = 0,
  minW = theme.minNodeSize.w,
  minH = theme.minNodeSize.h
): { w: number; h: number; lines: string[] } {
  const fontSize = labelFontSize(theme);
  const lineHeight = labelLineHeight(theme);
  const maxText = Math.max(80, theme.maxLabelWidth - NODE_PADDING_X * 2);
  const lines = wrapText(label, maxText, fontSize);
  const textWidth = Math.max(...lines.map((line) => measureText(line, fontSize)), 0);

  // Ensure perimeter can fit all incident edges with >= 14px pitch
  const requiredSpan = incidentDegree > 2 ? (Math.ceil(incidentDegree / 4) + 1) * 16 + 28 : 0;
  const w = Math.max(minW, requiredSpan, Math.ceil(textWidth + NODE_PADDING_X * 2));
  const h = Math.max(minH, requiredSpan, Math.ceil(lines.length * lineHeight + NODE_PADDING_Y * 2));
  return { w, h, lines };
}

/** Stable layered ranks: cycles are made acyclic by dropping DFS back edges. */
function rankNodes(ids: string[], edges: EdgeInput[]): Map<string, number> {
  const adj = new Map<string, Array<{ to: string; weight: number }>>();
  for (const id of ids) adj.set(id, []);
  for (const edge of edges) {
    if (edge.from === edge.to) continue;
    if (!adj.has(edge.from) || !adj.has(edge.to)) continue;
    adj.get(edge.from)!.push({ to: edge.to, weight: edge.weight ?? 1 });
  }
  for (const list of adj.values()) {
    list.sort((a, b) => b.weight - a.weight || a.to.localeCompare(b.to));
  }
  const state = new Map<string, 0 | 1 | 2>();
  const back = new Set<string>();
  const visit = (u: string): void => {
    state.set(u, 1);
    for (const v of adj.get(u) ?? []) {
      const s = state.get(v.to) ?? 0;
      if (s === 1) back.add(`${u}\u0000${v.to}`);
      else if (s === 0) visit(v.to);
    }
    state.set(u, 2);
  };
  const netWeight = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const edge of edges) {
    if (edge.from === edge.to) continue;
    const w = edge.weight ?? 1;
    if (netWeight.has(edge.from)) netWeight.set(edge.from, (netWeight.get(edge.from) ?? 0) + w);
    if (netWeight.has(edge.to)) netWeight.set(edge.to, (netWeight.get(edge.to) ?? 0) - w);
  }
  const startOrder = [...ids].sort((a, b) => (netWeight.get(b) ?? 0) - (netWeight.get(a) ?? 0) || a.localeCompare(b));
  for (const id of startOrder) if ((state.get(id) ?? 0) === 0) visit(id);

  const indegree = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const u of ids) {
    for (const v of adj.get(u) ?? []) {
      if (back.has(`${u}\u0000${v.to}`)) continue;
      indegree.set(v.to, (indegree.get(v.to) ?? 0) + 1);
    }
  }
  const queue = ids.filter((id) => (indegree.get(id) ?? 0) === 0).sort();
  const ranks = new Map<string, number>(ids.map((id) => [id, 0]));
  const topo: string[] = [];
  while (queue.length) {
    const u = queue.shift()!;
    topo.push(u);
    for (const v of adj.get(u) ?? []) {
      if (back.has(`${u}\u0000${v.to}`)) continue;
      ranks.set(v.to, Math.max(ranks.get(v.to) ?? 0, (ranks.get(u) ?? 0) + 1));
      indegree.set(v.to, (indegree.get(v.to) ?? 1) - 1);
      if ((indegree.get(v.to) ?? 0) === 0) {
        queue.push(v.to);
        queue.sort();
      }
    }
  }
  for (const id of ids) if (!topo.includes(id)) ranks.set(id, ranks.get(id) ?? 0);
  return ranks;
}

function getPrevPos(
  id: string,
  previous: Map<string, { x: number; y: number }>
): { x: number; y: number } | undefined {
  if (previous.has(id)) return previous.get(id);
  if (id.startsWith('n:')) {
    const rawId = id.slice(2);
    if (previous.has(rawId)) return previous.get(rawId);
  }
  return undefined;
}

/** Barycenter layer ordering with 4+ sweeps followed by adjacent-swap refinement. */
function orderLayersWithRefinement(
  initialLayers: string[][],
  edges: EdgeInput[],
  previous: Map<string, { x: number; y: number }>
): string[][] {
  const layers = initialLayers.map((l) => [...l]);
  const allIds = new Set<string>();
  for (const l of layers) for (const id of l) allIds.add(id);

  const preds = new Map<string, string[]>();
  const succs = new Map<string, string[]>();
  for (const id of allIds) {
    preds.set(id, []);
    succs.set(id, []);
  }
  for (const edge of edges) {
    if (edge.from === edge.to || !allIds.has(edge.from) || !allIds.has(edge.to)) continue;
    succs.get(edge.from)!.push(edge.to);
    preds.get(edge.to)!.push(edge.from);
  }

  for (const layer of layers) {
    layer.sort((a, b) => {
      const pa = getPrevPos(a, previous);
      const pb = getPrevPos(b, previous);
      if (pa && pb) return pa.y - pb.y || pa.x - pb.x || a.localeCompare(b);
      if (pa) return -1;
      if (pb) return 1;
      return a.localeCompare(b);
    });
  }

  const sortLayerByBarycenter = (layer: string[], neighbours: Map<string, string[]>, targetLayer: string[]): string[] => {
    const targetPos = new Map<string, number>();
    targetLayer.forEach((id, idx) => targetPos.set(id, idx));

    const scores = new Map<string, number>();
    layer.forEach((id, idx) => {
      const ns = neighbours.get(id) ?? [];
      const values = ns.map((n) => targetPos.get(n)).filter((v): v is number => v !== undefined);
      scores.set(id, values.length ? values.reduce((a, b) => a + b, 0) / values.length : idx);
    });

    return [...layer].sort((a, b) => {
      const sa = scores.get(a) ?? 0;
      const sb = scores.get(b) ?? 0;
      if (Math.abs(sa - sb) > 1e-9) return sa - sb;
      const pa = getPrevPos(a, previous);
      const pb = getPrevPos(b, previous);
      if (pa && pb) return pa.y - pb.y || pa.x - pb.x || a.localeCompare(b);
      return a.localeCompare(b);
    });
  };

  for (let sweep = 0; sweep < 4; sweep++) {
    for (let i = 1; i < layers.length; i++) {
      layers[i] = sortLayerByBarycenter(layers[i]!, preds, layers[i - 1]!);
    }
    for (let i = layers.length - 2; i >= 0; i--) {
      layers[i] = sortLayerByBarycenter(layers[i]!, succs, layers[i + 1]!);
    }
  }

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i]!;
      let improved = true;
      while (improved) {
        improved = false;
        for (let j = 0; j < layer.length - 1; j++) {
          const u = layer[j]!;
          const v = layer[j + 1]!;
          const crossUV = countPairCrossings(u, v, i, layers, preds, succs);
          const crossVU = countPairCrossings(v, u, i, layers, preds, succs);
          if (crossVU < crossUV) {
            layer[j] = v;
            layer[j + 1] = u;
            improved = true;
          }
        }
      }
    }
  }

  return layers;
}

function countPairCrossings(
  first: string,
  second: string,
  layerIndex: number,
  layers: string[][],
  preds: Map<string, string[]>,
  succs: Map<string, string[]>
): number {
  let crossings = 0;
  if (layerIndex > 0) {
    const prevLayer = layers[layerIndex - 1]!;
    const posMap = new Map<string, number>();
    prevLayer.forEach((id, idx) => posMap.set(id, idx));
    const firstPreds = (preds.get(first) ?? []).map((id) => posMap.get(id)).filter((p): p is number => p !== undefined);
    const secondPreds = (preds.get(second) ?? []).map((id) => posMap.get(id)).filter((p): p is number => p !== undefined);
    for (const p1 of firstPreds) {
      for (const p2 of secondPreds) {
        if (p1 > p2) crossings++;
      }
    }
  }
  if (layerIndex < layers.length - 1) {
    const nextLayer = layers[layerIndex + 1]!;
    const posMap = new Map<string, number>();
    nextLayer.forEach((id, idx) => posMap.set(id, idx));
    const firstSuccs = (succs.get(first) ?? []).map((id) => posMap.get(id)).filter((p): p is number => p !== undefined);
    const secondSuccs = (succs.get(second) ?? []).map((id) => posMap.get(id)).filter((p): p is number => p !== undefined);
    for (const s1 of firstSuccs) {
      for (const s2 of secondSuccs) {
        if (s1 > s2) crossings++;
      }
    }
  }
  return crossings;
}

interface GroupLayoutInternal {
  id: string;
  w: number;
  h: number;
  memberOffsets: Map<string, { x: number; y: number; w: number; h: number }>;
}

function layoutGroupInternal(
  group: { id: string; label: string },
  members: VibeNode[],
  dims: Map<string, { w: number; h: number }>,
  allEdges: EdgeInput[],
  direction: Direction,
  theme: Theme,
  prev: Map<string, { x: number; y: number }>
): GroupLayoutInternal {
  const memberIds = members.map((m) => m.id);
  const memberSet = new Set(memberIds);
  const intraEdges = allEdges.filter((e) => memberSet.has(e.from) && memberSet.has(e.to));

  const padX = theme.groupPad?.x ?? 36;
  const padTop = theme.groupPad?.top ?? 44;
  const padBottom = theme.groupPad?.bottom ?? 28;
  const nodeSep = theme.nodeSep ?? 56;
  const rankSep = Math.max(theme.nodeSep ?? 56, Math.min(theme.rankSep ?? 120, 80));

  const memberOffsets = new Map<string, { x: number; y: number; w: number; h: number }>();
  if (members.length === 1) {
    const m = members[0]!;
    const d = dims.get(m.id)!;
    memberOffsets.set(m.id, { x: padX, y: padTop, w: d.w, h: d.h });
    return {
      id: group.id,
      w: d.w + padX * 2,
      h: d.h + padTop + padBottom,
      memberOffsets,
    };
  }

  const ranks = rankNodes(memberIds, intraEdges);
  const maxRank = Math.max(0, ...memberIds.map((id) => ranks.get(id) ?? 0));
  const layers: string[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const id of [...memberIds].sort()) layers[ranks.get(id) ?? 0]!.push(id);

  const orderedLayers = orderLayersWithRefinement(layers, intraEdges, prev);
  const horizontal = direction === 'right' || direction === 'left';

  // Compact layout: fold if more than 2 ranks
  if (orderedLayers.length > 2 && members.length >= 3) {
    const mid = Math.ceil(orderedLayers.length / 2);
    const row0 = orderedLayers.slice(0, mid);
    const row1 = orderedLayers.slice(mid);

    let maxRowW = 0;
    let row0H = 0;
    let row1H = 0;

    let curX0 = 0;
    for (const layer of row0) {
      const colW = Math.max(0, ...layer.map((id) => dims.get(id)!.w));
      let curY = 0;
      for (const id of layer) {
        const d = dims.get(id)!;
        memberOffsets.set(id, { x: curX0, y: curY, w: d.w, h: d.h });
        curY += d.h + nodeSep;
      }
      row0H = Math.max(row0H, curY - nodeSep);
      curX0 += colW + rankSep;
    }
    maxRowW = Math.max(maxRowW, curX0 - rankSep);

    let curX1 = 0;
    const yOffset = row0H + rankSep;
    for (const layer of row1) {
      const colW = Math.max(0, ...layer.map((id) => dims.get(id)!.w));
      let curY = yOffset;
      for (const id of layer) {
        const d = dims.get(id)!;
        memberOffsets.set(id, { x: curX1, y: curY, w: d.w, h: d.h });
        curY += d.h + nodeSep;
      }
      row1H = Math.max(row1H, curY - nodeSep - yOffset);
      curX1 += colW + rankSep;
    }
    maxRowW = Math.max(maxRowW, curX1 - rankSep);

    for (const off of memberOffsets.values()) {
      off.x += padX;
      off.y += padTop;
    }
    return {
      id: group.id,
      w: maxRowW + padX * 2,
      h: row0H + rankSep + row1H + padTop + padBottom,
      memberOffsets,
    };
  }

  let cursorRank = 0;
  let maxCross = 0;

  if (horizontal) {
    orderedLayers.forEach((layer) => {
      const colWidth = Math.max(0, ...layer.map((id) => dims.get(id)?.w ?? 0));
      let y = 0;
      for (const id of layer) {
        const d = dims.get(id)!;
        memberOffsets.set(id, { x: cursorRank, y, w: d.w, h: d.h });
        y += d.h + nodeSep;
      }
      const colHeight = Math.max(0, y - nodeSep);
      maxCross = Math.max(maxCross, colHeight);
      cursorRank += colWidth + rankSep;
    });
    const totalRankWidth = Math.max(0, cursorRank - rankSep);
    for (const off of memberOffsets.values()) {
      off.x += padX;
      off.y += padTop;
    }
    return {
      id: group.id,
      w: totalRankWidth + padX * 2,
      h: maxCross + padTop + padBottom,
      memberOffsets,
    };
  }

  orderedLayers.forEach((layer) => {
    const rowHeight = Math.max(0, ...layer.map((id) => dims.get(id)?.h ?? 0));
    let x = 0;
    for (const id of layer) {
      const d = dims.get(id)!;
      memberOffsets.set(id, { x, y: cursorRank, w: d.w, h: d.h });
      x += d.w + nodeSep;
    }
    const rowWidth = Math.max(0, x - nodeSep);
    maxCross = Math.max(maxCross, rowWidth);
    cursorRank += rowHeight + rankSep;
  });
  const totalRankHeight = Math.max(0, cursorRank - rankSep);
  for (const off of memberOffsets.values()) {
    off.x += padX;
    off.y += padTop;
  }
  return {
    id: group.id,
    w: maxCross + padX * 2,
    h: totalRankHeight + padTop + padBottom,
    memberOffsets,
  };
}

interface SuperItem {
  id: string;
  isGroup: boolean;
  w: number;
  h: number;
  groupId?: string;
  nodeId?: string;
}

interface SuperEdge {
  id: string;
  from: string;
  to: string;
  weight: number;
  originalEdges: EdgeInput[];
}

function layoutGraph(map: GraphMap, theme: Theme, options: LayoutOptions): GraphLayout {
  const warnings: string[] = [];
  const prev = previousByName(options.previous);
  const sidecar = options.sidecar;

  const nodeSep = theme.nodeSep ?? 56;
  const rankSep = theme.rankSep ?? 120;
  const groupSep = theme.groupSep ?? 40;
  const direction = map.direction ?? 'right';
  const horizontal = direction === 'right' || direction === 'left';

  const incidentDegrees = new Map<string, number>();
  for (const edge of map.edges) {
    incidentDegrees.set(edge.from, (incidentDegrees.get(edge.from) ?? 0) + 1);
    incidentDegrees.set(edge.to, (incidentDegrees.get(edge.to) ?? 0) + 1);
  }

  // 1. Measure all nodes
  const dims = new Map<string, { w: number; h: number; lines: string[] }>();
  for (const node of map.nodes) {
    const side = sidecar?.nodes[node.id];
    if (side) {
      const fontSize = labelFontSize(theme);
      const lines = wrapText(node.label, Math.max(60, side.w - NODE_PADDING_X * 2), fontSize);
      dims.set(node.id, { w: side.w, h: side.h, lines });
    } else {
      const deg = incidentDegrees.get(node.id) ?? 0;
      dims.set(node.id, measureNodeBox(node.label, node.kind, theme, deg));
    }
  }

  const edgeInputs: EdgeInput[] = map.edges.map((edge, i) => ({
    id: edgeId(edge, i),
    from: edge.from,
    to: edge.to,
    kind: edge.kind,
    label: edge.label,
  }));

  // 2. Identify groups & members
  const groupById = new Map((map.groups ?? []).map((g) => [g.id, g]));
  const membersByGroup = new Map<string, VibeNode[]>();
  for (const g of map.groups ?? []) membersByGroup.set(g.id, []);
  const ungroupedNodes: VibeNode[] = [];
  const nodeToGroup = new Map<string, string>();

  for (const node of map.nodes) {
    if (node.group && groupById.has(node.group)) {
      membersByGroup.get(node.group)!.push(node);
      nodeToGroup.set(node.id, node.group);
    } else {
      ungroupedNodes.push(node);
    }
  }

  // 3. Bottom-up group sizing
  const groupLayouts = new Map<string, GroupLayoutInternal>();
  for (const [gid, members] of membersByGroup.entries()) {
    if (!members.length) continue;
    const groupDef = groupById.get(gid)!;
    const gl = layoutGroupInternal(groupDef, members, dims, edgeInputs, direction, theme, prev);
    groupLayouts.set(gid, gl);
  }

  // 4. Construct super-graph
  const superItems = new Map<string, SuperItem>();
  for (const [gid, gl] of groupLayouts.entries()) {
    superItems.set(`g:${gid}`, { id: `g:${gid}`, isGroup: true, w: gl.w, h: gl.h, groupId: gid });
  }
  for (const node of ungroupedNodes) {
    const d = dims.get(node.id)!;
    superItems.set(`n:${node.id}`, { id: `n:${node.id}`, isGroup: false, w: d.w, h: d.h, nodeId: node.id });
  }

  const getSuperId = (nodeId: string): string => {
    const gid = nodeToGroup.get(nodeId);
    if (gid && groupLayouts.has(gid)) return `g:${gid}`;
    return `n:${nodeId}`;
  };

  const superEdgeMap = new Map<string, SuperEdge>();
  for (const edge of edgeInputs) {
    const sf = getSuperId(edge.from);
    const st = getSuperId(edge.to);
    if (sf === st) continue;
    const key = `${sf}->${st}`;
    const existing = superEdgeMap.get(key);
    if (existing) {
      existing.weight++;
      existing.originalEdges.push(edge);
    } else {
      superEdgeMap.set(key, { id: key, from: sf, to: st, weight: 1, originalEdges: [edge] });
    }
  }
  const superEdges = [...superEdgeMap.values()];

  // 5. Rank super-graph
  const superIds = [...superItems.keys()];
  const superRanks = rankNodes(
    superIds,
    superEdges.map((e) => ({ id: e.id, from: e.from, to: e.to, kind: 'super', weight: e.weight }))
  );
  const maxSuperRank = Math.max(0, ...superIds.map((id) => superRanks.get(id) ?? 0));

  // 6. Long edges & dummy nodes for multi-rank super edges
  interface DummyNode {
    id: string;
    rank: number;
    superEdgeId: string;
    w: number;
    h: number;
    x: number;
    y: number;
  }
  const dummyNodes = new Map<string, DummyNode>();
  const dummyEdges: EdgeInput[] = [];

  for (const se of superEdges) {
    const rFrom = superRanks.get(se.from) ?? 0;
    const rTo = superRanks.get(se.to) ?? 0;
    const span = Math.abs(rTo - rFrom);
    if (span > 1) {
      const step = rTo > rFrom ? 1 : -1;
      let lastNode = se.from;
      for (let r = rFrom + step; r !== rTo; r += step) {
        const dummyId = `d:${se.id}:${r}`;
        const dummy: DummyNode = {
          id: dummyId,
          rank: r,
          superEdgeId: se.id,
          w: 24,
          h: 24,
          x: 0,
          y: 0,
        };
        dummyNodes.set(dummyId, dummy);
        dummyEdges.push({ id: `de:${lastNode}->${dummyId}`, from: lastNode, to: dummyId, kind: 'dummy' });
        lastNode = dummyId;
      }
      dummyEdges.push({ id: `de:${lastNode}->${se.to}`, from: lastNode, to: se.to, kind: 'dummy' });
    } else {
      dummyEdges.push({ id: se.id, from: se.from, to: se.to, kind: 'super' });
    }
  }

  // 7. Partition into layers & order with barycenter and adjacent swap
  const layersWithDummies: string[][] = Array.from({ length: maxSuperRank + 1 }, () => []);
  for (const id of superIds) {
    layersWithDummies[superRanks.get(id) ?? 0]!.push(id);
  }
  for (const dummy of dummyNodes.values()) {
    layersWithDummies[dummy.rank]!.push(dummy.id);
  }

  const orderedSuperLayers = orderLayersWithRefinement(layersWithDummies, dummyEdges, prev);

  // 8. Wide layer folding
  interface LayerSlot {
    id: string;
    subRank: number;
  }
  const foldedLayers: LayerSlot[][] = [];
  for (let r = 0; r < orderedSuperLayers.length; r++) {
    const layer = orderedSuperLayers[r]!;
    if (layer.length > 5) {
      const half = Math.ceil(layer.length / 2);
      const row0 = layer.slice(0, half).map((id) => ({ id, subRank: 0 }));
      const row1 = layer.slice(half).map((id) => ({ id, subRank: 1 }));
      foldedLayers.push([...row0, ...row1]);
    } else {
      foldedLayers.push(layer.map((id) => ({ id, subRank: 0 })));
    }
  }

  // 9. Coordinate assignment
  const superPositions = new Map<string, { x: number; y: number; w: number; h: number }>();
  let rankCursorRow0 = 0;
  let maxRow0H = 0;

  if (horizontal) {
    const getItemDim = (id: string): { w: number; h: number } => {
      if (dummyNodes.has(id)) {
        const d = dummyNodes.get(id)!;
        return { w: d.w, h: d.h };
      }
      const item = superItems.get(id)!;
      return { w: item.w, h: item.h };
    };

    let estW = 0;
    let estH = 0;
    for (let r = 0; r < foldedLayers.length; r++) {
      const slots = foldedLayers[r]!;
      const colW = Math.max(0, ...slots.map((s) => getItemDim(s.id).w));
      let curH = 0;
      for (let i = 0; i < slots.length; i++) {
        const sep = i === 0 ? 0 : groupSep;
        curH += sep + getItemDim(slots[i]!.id).h;
      }
      estW += colW + (r === 0 ? 0 : rankSep);
      estH = Math.max(estH, curH);
    }

    const wrapSuperRows = estW / Math.max(1, estH) > 2.2 && foldedLayers.length >= 3;
    const splitIndex = wrapSuperRows ? Math.ceil(foldedLayers.length / 2) : foldedLayers.length;

    let cursorX = 0;
    let row0H = 0;

    for (let r = 0; r < splitIndex; r++) {
      const slots = foldedLayers[r]!;
      const colW = Math.max(0, ...slots.map((s) => getItemDim(s.id).w));
      let y0 = 0;
      for (let i = 0; i < slots.length; i++) {
        const id = slots[i]!.id;
        const dim = getItemDim(id);
        const sep = i === 0 ? 0 : superItems.get(id)?.isGroup || superItems.get(slots[i - 1]!.id)?.isGroup ? groupSep : nodeSep;
        y0 += sep;
        superPositions.set(id, { x: cursorX, y: y0, w: dim.w, h: dim.h });
        y0 += dim.h;
      }
      row0H = Math.max(row0H, y0);
      cursorX += colW + rankSep;
    }

    if (wrapSuperRows) {
      cursorX = 0;
      const yOffset = row0H + groupSep;
      for (let r = splitIndex; r < foldedLayers.length; r++) {
        const slots = foldedLayers[r]!;
        const colW = Math.max(0, ...slots.map((s) => getItemDim(s.id).w));
        let y1 = yOffset;
        for (let i = 0; i < slots.length; i++) {
          const id = slots[i]!.id;
          const dim = getItemDim(id);
          const sep = i === 0 ? 0 : superItems.get(id)?.isGroup || superItems.get(slots[i - 1]!.id)?.isGroup ? groupSep : nodeSep;
          y1 += sep;
          superPositions.set(id, { x: cursorX, y: y1, w: dim.w, h: dim.h });
          y1 += dim.h;
        }
        cursorX += colW + rankSep;
      }
    }
  } else {
    let rankCursor = 0;
    for (let r = 0; r < foldedLayers.length; r++) {
      const slots = foldedLayers[r]!;
      const sub0 = slots.filter((s) => s.subRank === 0);
      const sub1 = slots.filter((s) => s.subRank === 1);

      const getItemDim = (id: string): { w: number; h: number } => {
        if (dummyNodes.has(id)) {
          const d = dummyNodes.get(id)!;
          return { w: d.w, h: d.h };
        }
        const item = superItems.get(id)!;
        return { w: item.w, h: item.h };
      };

      const h0 = Math.max(0, ...sub0.map((s) => getItemDim(s.id).h));
      const h1 = Math.max(0, ...sub1.map((s) => getItemDim(s.id).h));

      let x0 = 0;
      for (let i = 0; i < sub0.length; i++) {
        const id = sub0[i]!.id;
        const dim = getItemDim(id);
        const sep = i === 0 ? 0 : superItems.get(id)?.isGroup || superItems.get(sub0[i - 1]!.id)?.isGroup ? groupSep : nodeSep;
        x0 += sep;
        superPositions.set(id, { x: x0, y: rankCursor, w: dim.w, h: dim.h });
        x0 += dim.w;
      }

      let x1 = sub1.length ? nodeSep / 2 : 0;
      if (sub1.length) {
        const y1 = rankCursor + h0 + nodeSep;
        for (let i = 0; i < sub1.length; i++) {
          const id = sub1[i]!.id;
          const dim = getItemDim(id);
          const sep = i === 0 ? 0 : superItems.get(id)?.isGroup || superItems.get(sub1[i - 1]!.id)?.isGroup ? groupSep : nodeSep;
          x1 += sep;
          superPositions.set(id, { x: x1, y: y1, w: dim.w, h: dim.h });
          x1 += dim.w;
        }
        rankCursor += h0 + nodeSep + h1 + rankSep;
      } else {
        rankCursor += h0 + rankSep;
      }
    }
  }

  // Update dummy node coordinates
  for (const dummy of dummyNodes.values()) {
    const pos = superPositions.get(dummy.id);
    if (pos) {
      dummy.x = pos.x;
      dummy.y = pos.y;
    }
  }

  // 10. Compute node and group boxes
  const boxes: InternalBox[] = [];
  const layoutGroups: LayoutGroup[] = [];

  for (const [gid, gl] of groupLayouts.entries()) {
    const groupDef = groupById.get(gid)!;
    const spos = superPositions.get(`g:${gid}`)!;
    layoutGroups.push({
      id: gid,
      label: groupDef.label,
      x: round(spos.x + PAD),
      y: round(spos.y + PAD),
      w: round(gl.w),
      h: round(gl.h),
    });

    const members = membersByGroup.get(gid)!;
    for (const m of members) {
      const off = gl.memberOffsets.get(m.id)!;
      const side = sidecar?.nodes[m.id];
      const pinned = !!side;
      boxes.push({
        id: m.id,
        x: pinned ? side!.x : spos.x + off.x + PAD,
        y: pinned ? side!.y : spos.y + off.y + PAD,
        w: off.w,
        h: off.h,
        pinned,
        group: gid,
      });
    }
  }

  for (const node of ungroupedNodes) {
    const spos = superPositions.get(`n:${node.id}`)!;
    const side = sidecar?.nodes[node.id];
    const pinned = !!side;
    boxes.push({
      id: node.id,
      x: pinned ? side!.x : spos.x + PAD,
      y: pinned ? side!.y : spos.y + PAD,
      w: spos.w,
      h: spos.h,
      pinned,
    });
  }

  // Mirror for reverse directions
  if (direction === 'left' || direction === 'up') {
    const maxX = Math.max(...boxes.map((b) => b.x + b.w), ...layoutGroups.map((g) => g.x + g.w));
    const maxY = Math.max(...boxes.map((b) => b.y + b.h), ...layoutGroups.map((g) => g.y + g.h));
    for (const b of boxes) {
      if (b.pinned) continue;
      if (direction === 'left') b.x = maxX - (b.x + b.w) + PAD;
      if (direction === 'up') b.y = maxY - (b.y + b.h) + PAD;
    }
    for (const g of layoutGroups) {
      if (direction === 'left') g.x = maxX - (g.x + g.w) + PAD;
      if (direction === 'up') g.y = maxY - (g.y + g.h) + PAD;
    }
  }

  // 11. Pinned collision resolution: 1D shift only
  resolvePinnedCollisions(boxes, layoutGroups, horizontal, warnings, theme);

  // 12. Edge routing
  const boxById = new Map(boxes.map((b) => [b.id, b]));
  const edges: LayoutEdge[] = routeAllEdges(
    edgeInputs,
    boxById,
    dummyNodes,
    superEdgeMap,
    getSuperId,
    horizontal,
    layoutGroups,
    theme
  );

  const nodeBoxes: LayoutBox[] = boxes.map((box) => {
    const node = map.nodes.find((n) => n.id === box.id)!;
    return {
      id: box.id,
      x: round(box.x),
      y: round(box.y),
      w: round(box.w),
      h: round(box.h),
      labelLines: dims.get(box.id)?.lines ?? [node.label],
      kind: node.kind,
      group: node.group,
      pinned: box.pinned,
    };
  });

  const width = Math.max(420, ...nodeBoxes.map((b) => b.x + b.w + 40), ...layoutGroups.map((g) => g.x + g.w + 40));
  const height = Math.max(300, ...nodeBoxes.map((b) => b.y + b.h + 40), ...layoutGroups.map((g) => g.y + g.h + 40));

  return {
    type: 'graph',
    width: Math.ceil(width),
    height: Math.ceil(height),
    nodes: nodeBoxes,
    edges,
    groups: layoutGroups,
    direction: map.direction ?? 'right',
    warnings,
  };
}

/** Pinned node de-overlap: 1D shift along rank axis only, no spiral. */
function resolvePinnedCollisions(
  boxes: InternalBox[],
  groups: LayoutGroup[],
  horizontal: boolean,
  warnings: string[],
  theme: Theme
): void {
  const pinned = boxes.filter((b) => b.pinned);
  const nodeMargin = theme.nodeMargin ?? 28;

  for (let i = 0; i < pinned.length; i++) {
    for (let j = i + 1; j < pinned.length; j++) {
      if (overlapsBox(pinned[i]!, pinned[j]!, nodeMargin)) {
        warnings.push(`W-PINNED-OVERLAP: pinned nodes "${pinned[i]!.id}" and "${pinned[j]!.id}" overlap.`);
      }
    }
  }

  for (const p of pinned) {
    for (const b of boxes) {
      if (b.pinned || b.id === p.id) continue;
      if (overlapsBox(p, b, nodeMargin)) {
        if (horizontal) {
          if (b.y >= p.y) b.y = p.y + p.h + nodeMargin;
          else b.y = p.y - b.h - nodeMargin;
        } else {
          if (b.x >= p.x) b.x = p.x + p.w + nodeMargin;
          else b.x = p.x - b.w - nodeMargin;
        }
      }
    }
  }

  for (const group of groups) {
    const members = boxes.filter((b) => b.group === group.id);
    if (!members.length) continue;
    const minX = Math.min(...members.map((b) => b.x));
    const maxX = Math.max(...members.map((b) => b.x + b.w));
    const minY = Math.min(...members.map((b) => b.y));
    const maxY = Math.max(...members.map((b) => b.y + b.h));

    const padX = theme.groupPad?.x ?? 36;
    const padTop = theme.groupPad?.top ?? 44;
    const padBottom = theme.groupPad?.bottom ?? 28;

    group.x = minX - padX;
    group.y = minY - padTop;
    group.w = maxX - minX + padX * 2;
    group.h = maxY - minY + padTop + padBottom;
  }

  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const g1 = groups[i]!;
      const g2 = groups[j]!;
      if (overlapsBox(g1, g2, 0)) {
        warnings.push(`W-PINNED-GROUP: group "${g1.id}" overlaps group "${g2.id}".`);
      }
    }
  }
}

function overlapsBox(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  margin: number
): boolean {
  return (
    a.x < b.x + b.w + margin - 1e-4 &&
    a.x + a.w + margin > b.x + 1e-4 &&
    a.y < b.y + b.h + margin - 1e-4 &&
    a.y + a.h + margin > b.y + 1e-4
  );
}

interface ObstacleBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

class MinHeap {
  private data: Array<{ id: number; cost: number }> = [];

  push(id: number, cost: number): void {
    this.data.push({ id, cost });
    let i = this.data.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.data[p]!.cost <= this.data[i]!.cost) break;
      const tmp = this.data[p]!;
      this.data[p] = this.data[i]!;
      this.data[i] = tmp;
      i = p;
    }
  }

  pop(): number | undefined {
    if (!this.data.length) return undefined;
    const res = this.data[0]!.id;
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      let i = 0;
      const len = this.data.length;
      while (true) {
        let best = i;
        const left = (i << 1) + 1;
        const right = left + 1;
        if (left < len && this.data[left]!.cost < this.data[best]!.cost) best = left;
        if (right < len && this.data[right]!.cost < this.data[best]!.cost) best = right;
        if (best === i) break;
        const tmp = this.data[i]!;
        this.data[i] = this.data[best]!;
        this.data[best] = tmp;
        i = best;
      }
    }
    return res;
  }

  isEmpty(): boolean {
    return this.data.length === 0;
  }
}

function segmentHitsBox(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  box: ObstacleBox
): boolean {
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);

  if (maxX <= box.x || minX >= box.x + box.w || maxY <= box.y || minY >= box.y + box.h) {
    return false;
  }
  if (Math.abs(p1.y - p2.y) < 1e-4) {
    return p1.y > box.y && p1.y < box.y + box.h && maxX > box.x && minX < box.x + box.w;
  }
  if (Math.abs(p1.x - p2.x) < 1e-4) {
    return p1.x > box.x && p1.x < box.x + box.w && maxY > box.y && minY < box.y + box.h;
  }
  return segmentIntersectsBox(p1, p2, box);
}

function aStarGrid(
  startPt: { x: number; y: number },
  endPt: { x: number; y: number },
  gridX: number[],
  gridY: number[],
  obstacles: ObstacleBox[]
): Array<{ x: number; y: number }> {
  let startIx = 0;
  let minStartDist = Infinity;
  let endIx = 0;
  let minEndDist = Infinity;
  for (let i = 0; i < gridX.length; i++) {
    const ds = Math.abs(gridX[i]! - startPt.x);
    if (ds < minStartDist) {
      minStartDist = ds;
      startIx = i;
    }
    const de = Math.abs(gridX[i]! - endPt.x);
    if (de < minEndDist) {
      minEndDist = de;
      endIx = i;
    }
  }

  let startIy = 0;
  let minStartDistY = Infinity;
  let endIy = 0;
  let minEndDistY = Infinity;
  for (let j = 0; j < gridY.length; j++) {
    const ds = Math.abs(gridY[j]! - startPt.y);
    if (ds < minStartDistY) {
      minStartDistY = ds;
      startIy = j;
    }
    const de = Math.abs(gridY[j]! - endPt.y);
    if (de < minEndDistY) {
      minEndDistY = de;
      endIy = j;
    }
  }

  const Nx = gridX.length;
  const Ny = gridY.length;
  const total = Nx * Ny;
  const dist = new Float64Array(total).fill(Infinity);
  const parent = new Int32Array(total).fill(-1);
  const dir = new Uint8Array(total); // 0=none, 1=H, 2=V

  const startId = startIy * Nx + startIx;
  const targetId = endIy * Nx + endIx;

  dist[startId] = 0;
  const heap = new MinHeap();
  heap.push(startId, Math.abs(gridX[endIx]! - gridX[startIx]!) + Math.abs(gridY[endIy]! - gridY[startIy]!));

  while (!heap.isEmpty()) {
    const u = heap.pop()!;
    if (u === targetId) break;

    const uix = u % Nx;
    const uiy = Math.floor(u / Nx);
    const ux = gridX[uix]!;
    const uy = gridY[uiy]!;
    const uDist = dist[u]!;

    const neighbors: Array<{ ix: number; iy: number; moveDir: number }> = [];
    if (uix > 0) neighbors.push({ ix: uix - 1, iy: uiy, moveDir: 1 });
    if (uix < Nx - 1) neighbors.push({ ix: uix + 1, iy: uiy, moveDir: 1 });
    if (uiy > 0) neighbors.push({ ix: uix, iy: uiy - 1, moveDir: 2 });
    if (uiy < Ny - 1) neighbors.push({ ix: uix, iy: uiy + 1, moveDir: 2 });

    for (const nb of neighbors) {
      const vx = gridX[nb.ix]!;
      const vy = gridY[nb.iy]!;
      const vid = nb.iy * Nx + nb.ix;

      let blocked = false;
      const p1 = { x: ux, y: uy };
      const p2 = { x: vx, y: vy };
      for (let o = 0; o < obstacles.length; o++) {
        if (segmentHitsBox(p1, p2, obstacles[o]!)) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      const segLen = Math.abs(vx - ux) + Math.abs(vy - uy);
      const isTurn = dir[u] !== 0 && dir[u] !== nb.moveDir ? 80 : 0;
      const gScore = uDist + segLen + isTurn;

      if (gScore < dist[vid]!) {
        dist[vid] = gScore;
        parent[vid] = u;
        dir[vid] = nb.moveDir;
        const h = Math.abs(gridX[endIx]! - vx) + Math.abs(gridY[endIy]! - vy);
        heap.push(vid, gScore + h);
      }
    }
  }

  if (dist[targetId]! === Infinity) {
    const minYAll = Math.min(...obstacles.map((o) => o.y));
    const corridorY = minYAll - 32;
    return [
      startPt,
      { x: startPt.x, y: corridorY },
      { x: endPt.x, y: corridorY },
      endPt,
    ];
  }

  const path: Array<{ x: number; y: number }> = [];
  let curr = targetId;
  while (curr !== -1) {
    const ix = curr % Nx;
    const iy = Math.floor(curr / Nx);
    path.push({ x: gridX[ix]!, y: gridY[iy]! });
    if (curr === startId) break;
    curr = parent[curr]!;
  }
  path.reverse();
  return path;
}

function routeBetweenPoints(
  pStart: { x: number; y: number },
  pEnd: { x: number; y: number },
  startStub: { x: number; y: number },
  endStub: { x: number; y: number },
  obstacles: ObstacleBox[],
  gridX: number[],
  gridY: number[]
): Array<{ x: number; y: number }> {
  const isClear = (pts: Array<{ x: number; y: number }>): boolean => {
    for (let i = 0; i < pts.length - 1; i++) {
      for (const obs of obstacles) {
        if (segmentHitsBox(pts[i]!, pts[i + 1]!, obs)) return false;
      }
    }
    return true;
  };

  // Straight line
  if (Math.abs(startStub.x - endStub.x) < 1 || Math.abs(startStub.y - endStub.y) < 1) {
    const cand = [pStart, startStub, endStub, pEnd];
    if (isClear([pStart, startStub, endStub, pEnd])) return simplifyPolyline(cand);
  }

  // Z-bend with midX
  const midX = (startStub.x + endStub.x) / 2;
  const candMidX = [pStart, startStub, { x: midX, y: startStub.y }, { x: midX, y: endStub.y }, endStub, pEnd];
  if (isClear([pStart, startStub, { x: midX, y: startStub.y }, { x: midX, y: endStub.y }, endStub, pEnd])) {
    return simplifyPolyline(candMidX);
  }

  // Z-bend with midY
  const midY = (startStub.y + endStub.y) / 2;
  const candMidY = [pStart, startStub, { x: startStub.x, y: midY }, { x: endStub.x, y: midY }, endStub, pEnd];
  if (isClear([pStart, startStub, { x: startStub.x, y: midY }, { x: endStub.x, y: midY }, endStub, pEnd])) {
    return simplifyPolyline(candMidY);
  }

  // L-bend X-then-Y
  const candL1 = [pStart, startStub, { x: endStub.x, y: startStub.y }, endStub, pEnd];
  if (isClear([pStart, startStub, { x: endStub.x, y: startStub.y }, endStub, pEnd])) {
    return simplifyPolyline(candL1);
  }

  // L-bend Y-then-X
  const candL2 = [pStart, startStub, { x: startStub.x, y: endStub.y }, endStub, pEnd];
  if (isClear([pStart, startStub, { x: startStub.x, y: endStub.y }, endStub, pEnd])) {
    return simplifyPolyline(candL2);
  }

  // A* search on grid
  const subPath = aStarGrid(startStub, endStub, gridX, gridY, obstacles);
  return simplifyPolyline([pStart, ...subPath, pEnd]);
}

/**
 * Distributed ports, orthogonal polylines with rounded corners (r=10),
 * dummy channel waypoints, obstacle checks, and collision-free label placement.
 */
function routeAllEdges(
  edgeInputs: EdgeInput[],
  boxById: Map<string, InternalBox>,
  dummyNodes: Map<string, { x: number; y: number; rank: number; superEdgeId: string }>,
  superEdgeMap: Map<string, SuperEdge>,
  getSuperId: (nodeId: string) => string,
  horizontal: boolean,
  groups: LayoutGroup[],
  theme: Theme
): LayoutEdge[] {
  type Side = 'left' | 'right' | 'top' | 'bottom';

  interface Attachment {
    edge: EdgeInput;
    isStart: boolean;
    oppositeCoord: number;
  }
  const attachments = new Map<string, Record<Side, Attachment[]>>();
  for (const box of boxById.values()) {
    attachments.set(box.id, { left: [], right: [], top: [], bottom: [] });
  }

  const getSideCapacity = (node: InternalBox, side: Side): number => {
    const isCross = side === 'left' || side === 'right';
    const span = isCross ? node.h : node.w;
    return Math.max(1, Math.floor((span - 24) / 14) + 1);
  };

  const chooseSide = (node: InternalBox, preferredSide: Side): Side => {
    const nodeAtt = attachments.get(node.id)!;
    if (nodeAtt[preferredSide].length < getSideCapacity(node, preferredSide)) {
      return preferredSide;
    }
    const allSides: Side[] =
      preferredSide === 'left' || preferredSide === 'right'
        ? [preferredSide, 'top', 'bottom', preferredSide === 'left' ? 'right' : 'left']
        : [preferredSide, 'left', 'right', preferredSide === 'top' ? 'bottom' : 'top'];

    for (const alt of allSides) {
      if (nodeAtt[alt].length < getSideCapacity(node, alt)) {
        return alt;
      }
    }
    return allSides.sort(
      (a, b) => nodeAtt[a].length / getSideCapacity(node, a) - nodeAtt[b].length / getSideCapacity(node, b)
    )[0]!;
  };

  for (const edge of edgeInputs) {
    const from = boxById.get(edge.from);
    const to = boxById.get(edge.to);
    if (!from || !to) continue;

    if (from.id === to.id) {
      // Find a side with free capacity for 2 ports
      const sides: Side[] = horizontal ? ['right', 'bottom', 'top', 'left'] : ['bottom', 'right', 'left', 'top'];
      let chosenSide = sides[0]!;
      for (const s of sides) {
        if (attachments.get(from.id)![s].length + 2 <= getSideCapacity(from, s)) {
          chosenSide = s;
          break;
        }
      }
      attachments.get(from.id)![chosenSide].push({ edge, isStart: true, oppositeCoord: from.y });
      attachments.get(from.id)![chosenSide].push({ edge, isStart: false, oppositeCoord: from.y + from.h });
      continue;
    }

    let startSide: Side;
    let endSide: Side;

    if (horizontal) {
      if (to.x >= from.x + from.w - 10) {
        startSide = 'right';
        endSide = 'left';
      } else if (from.x >= to.x + to.w - 10) {
        startSide = 'left';
        endSide = 'right';
      } else if (to.y >= from.y) {
        startSide = 'bottom';
        endSide = 'top';
      } else {
        startSide = 'top';
        endSide = 'bottom';
      }
    } else {
      if (to.y >= from.y + from.h - 10) {
        startSide = 'bottom';
        endSide = 'top';
      } else if (from.y >= to.y + to.h - 10) {
        startSide = 'top';
        endSide = 'bottom';
      } else if (to.x >= from.x) {
        startSide = 'right';
        endSide = 'left';
      } else {
        startSide = 'left';
        endSide = 'right';
      }
    }

    const finalStartSide = chooseSide(from, startSide);
    const finalEndSide = chooseSide(to, endSide);

    attachments.get(from.id)![finalStartSide].push({
      edge,
      isStart: true,
      oppositeCoord: horizontal ? to.y + to.h / 2 : to.x + to.w / 2,
    });
    attachments.get(to.id)![finalEndSide].push({
      edge,
      isStart: false,
      oppositeCoord: horizontal ? from.y + from.h / 2 : from.x + from.w / 2,
    });
  }

  // Calculate distinct port positions on each side
  interface PortInfo {
    x: number;
    y: number;
    side: Side;
  }
  const ports = new Map<string, { start: PortInfo; end: PortInfo }>();
  for (const [nodeId, sides] of attachments.entries()) {
    const node = boxById.get(nodeId)!;
    for (const side of ['left', 'right', 'top', 'bottom'] as Side[]) {
      const list = sides[side];
      if (!list.length) continue;
      list.sort((a, b) => a.oppositeCoord - b.oppositeCoord);

      const count = list.length;
      const isCross = side === 'left' || side === 'right';
      const totalSpan = isCross ? node.h : node.w;
      const startCoord = isCross ? node.y : node.x;

      for (let i = 0; i < count; i++) {
        const item = list[i]!;
        let offset: number;
        if (count === 1) {
          offset = totalSpan / 2;
        } else {
          const pad = 12;
          const usable = Math.max(0, totalSpan - pad * 2);
          offset = pad + (i / (count - 1)) * usable;
        }

        let pt: { x: number; y: number };
        switch (side) {
          case 'left':
            pt = { x: node.x, y: startCoord + offset };
            break;
          case 'right':
            pt = { x: node.x + node.w, y: startCoord + offset };
            break;
          case 'top':
            pt = { x: startCoord + offset, y: node.y };
            break;
          case 'bottom':
            pt = { x: startCoord + offset, y: node.y + node.h };
            break;
        }

        const info: PortInfo = { ...pt, side };
        if (!ports.has(item.edge.id)) {
          ports.set(item.edge.id, { start: info, end: info });
        }
        const p = ports.get(item.edge.id)!;
        if (item.isStart) p.start = info;
        else p.end = info;
      }
    }
  }

  const allObstacles: ObstacleBox[] = [...boxById.values()].map((b) => ({
    id: b.id,
    x: b.x - 7,
    y: b.y - 7,
    w: b.w + 14,
    h: b.h + 14,
  }));

  const allBoxes = [...boxById.values()];
  const minYAll = Math.min(...allBoxes.map((b) => b.y));
  const maxYAll = Math.max(...allBoxes.map((b) => b.y + b.h));
  const minXAll = Math.min(...allBoxes.map((b) => b.x));
  const maxXAll = Math.max(...allBoxes.map((b) => b.x + b.w));

  const getStub = (p: PortInfo, box: InternalBox): { x: number; y: number } => {
    const dist = 14;
    switch (p.side) {
      case 'right': return { x: box.x + box.w + dist, y: p.y };
      case 'left': return { x: box.x - dist, y: p.y };
      case 'bottom': return { x: p.x, y: box.y + box.h + dist };
      case 'top': return { x: p.x, y: box.y - dist };
    }
  };

  // Build grid tracks for A*
  const rawGridX = [minXAll - 32, maxXAll + 32];
  const rawGridY = [minYAll - 32, maxYAll + 32];

  for (const obs of allObstacles) {
    rawGridX.push(obs.x - 12, obs.x + obs.w + 12);
    rawGridY.push(obs.y - 12, obs.y + obs.h + 12);
  }
  for (const d of dummyNodes.values()) {
    rawGridX.push(d.x + 12);
    rawGridY.push(d.y + 12);
  }
  for (const [edgeId, p] of ports.entries()) {
    const fromNode = boxById.get(edgeInputs.find((e) => e.id === edgeId)?.from ?? '');
    const toNode = boxById.get(edgeInputs.find((e) => e.id === edgeId)?.to ?? '');
    rawGridX.push(p.start.x, p.end.x);
    rawGridY.push(p.start.y, p.end.y);
    if (fromNode) {
      const s = getStub(p.start, fromNode);
      rawGridX.push(s.x);
      rawGridY.push(s.y);
    }
    if (toNode) {
      const e = getStub(p.end, toNode);
      rawGridX.push(e.x);
      rawGridY.push(e.y);
    }
  }

  const cleanTracks = (arr: number[]): number[] => {
    const sorted = [...arr].sort((a, b) => a - b);
    const res: number[] = [];
    for (const val of sorted) {
      if (!res.length || Math.abs(val - res[res.length - 1]!) >= 2) {
        res.push(round(val));
      }
    }
    return res;
  };

  const gridX = cleanTracks(rawGridX);
  const gridY = cleanTracks(rawGridY);

  const layoutEdges: LayoutEdge[] = [];
  const placedLabels: Array<{ x: number; y: number; w: number; h: number }> = [];

  for (const edge of edgeInputs) {
    const from = boxById.get(edge.from);
    const to = boxById.get(edge.to);
    if (!from || !to) continue;

    const p = ports.get(edge.id) ?? {
      start: { x: from.x + from.w, y: from.y + from.h / 2, side: 'right' as Side },
      end: { x: to.x, y: to.y + to.h / 2, side: 'left' as Side },
    };

    let polyline: Array<{ x: number; y: number }>;

    if (from.id === to.id) {
      const side = p.start.side;
      const loopDist = 36;
      switch (side) {
        case 'right':
          polyline = [
            { x: from.x + from.w, y: p.start.y },
            { x: from.x + from.w + loopDist, y: p.start.y },
            { x: from.x + from.w + loopDist, y: p.end.y },
            { x: from.x + from.w, y: p.end.y },
          ];
          break;
        case 'left':
          polyline = [
            { x: from.x, y: p.start.y },
            { x: from.x - loopDist, y: p.start.y },
            { x: from.x - loopDist, y: p.end.y },
            { x: from.x, y: p.end.y },
          ];
          break;
        case 'bottom':
          polyline = [
            { x: p.start.x, y: from.y + from.h },
            { x: p.start.x, y: from.y + from.h + loopDist },
            { x: p.end.x, y: from.y + from.h + loopDist },
            { x: p.end.x, y: from.y + from.h },
          ];
          break;
        case 'top':
          polyline = [
            { x: p.start.x, y: from.y },
            { x: p.start.x, y: from.y - loopDist },
            { x: p.end.x, y: from.y - loopDist },
            { x: p.end.x, y: from.y },
          ];
          break;
      }
    } else {
      const startStub = getStub(p.start, from);
      const endStub = getStub(p.end, to);
      const obstacles = allObstacles.filter((o) => o.id !== from.id && o.id !== to.id);

      polyline = routeBetweenPoints(
        p.start,
        p.end,
        startStub,
        endStub,
        obstacles,
        gridX,
        gridY
      );

      // Verify no segment crosses any obstacle; if so, perimeter fallback
      let hasCrossing = false;
      for (let i = 0; i < polyline.length - 1; i++) {
        for (const obs of obstacles) {
          if (segmentHitsBox(polyline[i]!, polyline[i + 1]!, obs)) {
            hasCrossing = true;
            break;
          }
        }
        if (hasCrossing) break;
      }

      if (hasCrossing) {
        const corridorY = Math.min(from.y, to.y) < (minYAll + maxYAll) / 2 ? minYAll - 32 : maxYAll + 32;
        polyline = simplifyPolyline([
          p.start,
          startStub,
          { x: startStub.x, y: corridorY },
          { x: endStub.x, y: corridorY },
          endStub,
          p.end,
        ]);
      }
    }

    const pathString = polylineToSvgPath(polyline, 10);
    const { pos: labelPos, lines: labelLines } = placeEdgeLabel(
      polyline,
      edge.label,
      boxById,
      groups,
      placedLabels,
      theme
    );

    layoutEdges.push({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      kind: edge.kind,
      label: edge.label,
      labelLines,
      path: pathString,
      points: polyline,
      labelPos,
    });
  }

  return layoutEdges;
}

function simplifyPolyline(pts: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  if (pts.length <= 2) return pts;
  const res: Array<{ x: number; y: number }> = [pts[0]!];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = res[res.length - 1]!;
    const curr = pts[i]!;
    const next = pts[i + 1]!;
    const isCollinearX = Math.abs(prev.x - curr.x) < 1e-4 && Math.abs(curr.x - next.x) < 1e-4;
    const isCollinearY = Math.abs(prev.y - curr.y) < 1e-4 && Math.abs(curr.y - next.y) < 1e-4;
    if (isCollinearX || isCollinearY) continue;
    res.push(curr);
  }
  res.push(pts[pts.length - 1]!);
  return res;
}

function segmentIntersectsBox(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  box: { x: number; y: number; w: number; h: number }
): boolean {
  if (pointInBox(p1, box) || pointInBox(p2, box)) return true;
  const corners = [
    { x: box.x, y: box.y },
    { x: box.x + box.w, y: box.y },
    { x: box.x + box.w, y: box.y + box.h },
    { x: box.x, y: box.y + box.h },
  ];
  for (let i = 0; i < 4; i++) {
    if (segmentsIntersect(p1, p2, corners[i]!, corners[(i + 1) % 4]!)) return true;
  }
  return false;
}

function pointInBox(p: { x: number; y: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
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
  q2: { x: number; y: number }
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

function polylineToSvgPath(points: Array<{ x: number; y: number }>, radius = 10): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${round(points[0]!.x)} ${round(points[0]!.y)} L ${round(points[1]!.x)} ${round(points[1]!.y)}`;
  }
  let d = `M ${round(points[0]!.x)} ${round(points[0]!.y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const next = points[i + 1]!;
    const d1 = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const d2 = Math.hypot(next.x - curr.x, next.y - curr.y);
    const r = Math.min(radius, d1 / 2, d2 / 2);
    if (r < 1) {
      d += ` L ${round(curr.x)} ${round(curr.y)}`;
      continue;
    }
    const pStart = {
      x: curr.x - ((curr.x - prev.x) / d1) * r,
      y: curr.y - ((curr.y - prev.y) / d1) * r,
    };
    const pEnd = {
      x: curr.x + ((next.x - curr.x) / d2) * r,
      y: curr.y + ((next.y - curr.y) / d2) * r,
    };
    d += ` L ${round(pStart.x)} ${round(pStart.y)} Q ${round(curr.x)} ${round(curr.y)} ${round(pEnd.x)} ${round(pEnd.y)}`;
  }
  const last = points[points.length - 1]!;
  d += ` L ${round(last.x)} ${round(last.y)}`;
  return d;
}

function placeEdgeLabel(
  polyline: Array<{ x: number; y: number }>,
  rawLabel: string | undefined,
  boxById: Map<string, InternalBox>,
  groups: LayoutGroup[],
  placedLabels: Array<{ x: number; y: number; w: number; h: number }>,
  theme: Theme
): { pos: { x: number; y: number }; lines: string[] } {
  if (!rawLabel || polyline.length < 2) {
    return { pos: polyline[0] ?? { x: 0, y: 0 }, lines: [] };
  }

  const fontSize = 13;
  const lineHeight = 17;

  interface Segment {
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    len: number;
    horizontal: boolean;
  }
  const segments: Segment[] = [];
  for (let i = 0; i < polyline.length - 1; i++) {
    const p1 = polyline[i]!;
    const p2 = polyline[i + 1]!;
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (len >= 8) {
      segments.push({
        p1,
        p2,
        len,
        horizontal: Math.abs(p1.y - p2.y) < Math.abs(p2.x - p1.x),
      });
    }
  }
  segments.sort((a, b) => b.len - a.len);

  if (!segments.length) {
    return { pos: polyline[0] ?? { x: 0, y: 0 }, lines: [] };
  }

  const overlapsAnything = (box: { x: number; y: number; w: number; h: number }): boolean => {
    for (const node of boxById.values()) {
      if (
        box.x < node.x + node.w &&
        box.x + box.w > node.x &&
        box.y < node.y + node.h &&
        box.y + box.h > node.y
      ) {
        return true;
      }
    }
    for (const g of groups) {
      const header = { x: g.x, y: g.y, w: g.w, h: 44 };
      if (
        box.x < header.x + header.w &&
        box.x + box.w > header.x &&
        box.y < header.y + header.h &&
        box.y + box.h > header.y
      ) {
        return true;
      }
    }
    for (const pl of placedLabels) {
      if (
        box.x < pl.x + pl.w &&
        box.x + box.w > pl.x &&
        box.y < pl.y + pl.h &&
        box.y + box.h > pl.y
      ) {
        return true;
      }
    }
    return false;
  };

  const textVariants: string[] = [rawLabel];
  for (let l = rawLabel.length - 1; l >= 3; l -= 2) {
    textVariants.push(rawLabel.slice(0, l) + '…');
  }
  textVariants.push('…');

  for (const text of textVariants) {
    const lines = wrapText(text, 140, fontSize);
    const lw = Math.max(...lines.map((l) => measureText(l, fontSize)), 0) + 14;
    const lh = lines.length * lineHeight + 8;

    for (const seg of segments) {
      const tVals = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8];
      const perpOffsets = [0, -14, 14, -28, 28];

      for (const t of tVals) {
        const baseX = seg.p1.x + t * (seg.p2.x - seg.p1.x);
        const baseY = seg.p1.y + t * (seg.p2.y - seg.p1.y);

        for (const perp of perpOffsets) {
          const cx = seg.horizontal ? baseX : baseX + perp;
          const cy = seg.horizontal ? baseY + perp : baseY;
          const box = { x: cx - lw / 2, y: cy - lh / 2, w: lw, h: lh };

          if (!overlapsAnything(box)) {
            placedLabels.push(box);
            return { pos: { x: round(cx), y: round(cy) }, lines };
          }
        }
      }
    }
  }

  return { pos: polyline[0] ?? { x: 0, y: 0 }, lines: [] };
}

function layoutSequence(map: Extract<VibeMap, { type: 'sequence' }>, theme: Theme): SequenceLayout {
  const participants = map.participants;
  const fontSize = labelFontSize(theme);
  const lineHeight = labelLineHeight(theme);
  const dims = participants.map((p) => {
    const lines = wrapText(p.label, 160, fontSize);
    return {
      lines,
      w: Math.max(130, Math.ceil(Math.max(...lines.map((l) => measureText(l, fontSize))) + 42)),
      h: Math.max(48, lines.length * lineHeight + 22),
    };
  });

  const partOrder = new Map<string, number>(participants.map((p, idx) => [p.id, idx]));
  const pairGaps = Array.from({ length: Math.max(0, participants.length - 1) }, () => 60);

  // Compute required gaps between adjacent participants based on messages
  for (const step of map.steps) {
    const oFrom = partOrder.get(step.from);
    const oTo = partOrder.get(step.to);
    if (oFrom === undefined || oTo === undefined) continue;
    const minIdx = Math.min(oFrom, oTo);
    const maxIdx = Math.max(oFrom, oTo);
    if (minIdx === maxIdx) continue;

    const labelW = measureText(step.label, 13);
    const reqSpan = labelW + 24;

    if (maxIdx === minIdx + 1) {
      pairGaps[minIdx] = Math.max(pairGaps[minIdx]!, reqSpan);
    } else {
      let currentSpan = 0;
      for (let k = minIdx; k < maxIdx; k++) {
        currentSpan += (dims[k]!.w / 2) + pairGaps[k]! + (dims[k + 1]!.w / 2);
      }
      if (currentSpan < reqSpan) {
        const extraPerGap = (reqSpan - currentSpan) / (maxIdx - minIdx);
        for (let k = minIdx; k < maxIdx; k++) {
          pairGaps[k] = Math.ceil(pairGaps[k]! + extraPerGap);
        }
      }
    }
  }

  let curX = PAD;
  const y = 36;
  const pos = new Map<string, { x: number; y: number; w: number; h: number; lines: string[] }>();
  participants.forEach((p, i) => {
    const dim = dims[i]!;
    pos.set(p.id, { x: curX, y, w: dim.w, h: dim.h, lines: dim.lines });
    const gap = i < pairGaps.length ? pairGaps[i]! : 60;
    curX += dim.w + gap;
  });
  const totalWidth = curX - (pairGaps[pairGaps.length - 1] ?? 60);

  const stepBase = y + Math.max(0, ...dims.map((d) => d.h)) + 54;
  let currentStepY = stepBase;

  const steps = map.steps.map((step, index) => {
    const oFrom = partOrder.get(step.from);
    const oTo = partOrder.get(step.to);
    let spanWidth = 240;
    if (oFrom !== undefined && oTo !== undefined && oFrom !== oTo) {
      const pFrom = pos.get(step.from)!;
      const pTo = pos.get(step.to)!;
      const x1 = pFrom.x + pFrom.w / 2;
      const x2 = pTo.x + pTo.w / 2;
      spanWidth = Math.max(80, Math.abs(x2 - x1) - 24);
    }
    const wrapped = wrapText(step.label, spanWidth, 12);
    const labelHeight = Math.max(1, wrapped.length) * 16;
    const rowGap = Math.max(58, labelHeight + 24);
    const thisY = currentStepY;
    currentStepY += rowGap;

    return {
      index,
      from: step.from,
      to: step.to,
      y: thisY,
      label: step.label,
      kind: step.kind ?? 'call',
      reverse: (oFrom ?? 0) > (oTo ?? 0),
    };
  });

  const bottom = currentStepY + 24;
  const participantLayout = participants.map((p) => {
    const box = pos.get(p.id)!;
    return {
      id: p.id,
      label: p.label,
      x: round(box.x),
      y: round(box.y),
      w: round(box.w),
      h: round(box.h),
      lines: box.lines,
      lifelineBottom: round(bottom),
    };
  });

  const participantById = new Map(participantLayout.map((p) => [p.id, p]));
  const fragments = (map.fragments ?? []).map((fragment, index) => {
    const fromStep = Math.max(0, Math.min(fragment.from_step, steps.length - 1));
    const toStep = Math.max(fromStep, Math.min(fragment.to_step, steps.length - 1));
    const involved = new Set<string>();
    for (let i = fromStep; i <= toStep; i++) {
      const step = steps[i];
      if (step) {
        involved.add(step.from);
        involved.add(step.to);
      }
    }
    const ps = [...involved].map((id) => participantById.get(id)).filter((p): p is NonNullable<typeof p> => !!p);
    const minX = ps.length ? Math.min(...ps.map((p) => p.x)) - 22 : PAD;
    const maxX = ps.length ? Math.max(...ps.map((p) => p.x + p.w)) + 22 : totalWidth + PAD;
    const yStart = steps[fromStep]?.y ?? stepBase;
    const yEnd = steps[toStep]?.y ?? yStart;
    return {
      index,
      kind: fragment.kind,
      label: fragment.label ?? fragment.kind,
      x: round(minX),
      y: round(yStart - 34),
      w: round(maxX - minX),
      h: round(yEnd - yStart + 68),
    };
  });

  const width = Math.max(480, totalWidth + PAD * 2, ...fragments.map((f) => f.x + f.w + PAD));
  return {
    type: 'sequence',
    width: Math.ceil(width),
    height: Math.ceil(bottom + 40),
    participants: participantLayout,
    steps,
    fragments,
  };
}

export function layoutErdMap(map: ErdMap, theme: Theme): import('./types.js').ErdLayout {
  const fontSize = labelFontSize(theme);
  const dims = new Map<string, { w: number; h: number }>();
  for (const entity of map.entities) {
    const titleWidth = measureText(entity.label, fontSize) + 56;
    const fieldWidth = Math.max(
      0,
      ...entity.fields.map((f) => measureText(`${f.name}  ${f.type}`, 13) + 70)
    );
    const w = Math.max(210, Math.ceil(Math.max(titleWidth, fieldWidth)));
    const h = 44 + Math.max(1, entity.fields.length) * 22 + 12;
    dims.set(entity.id, { w, h });
  }

  const relations: EdgeInput[] = map.relations.map((relation, i) => ({
    id: relation.id ?? `${relation.from}>${relation.to}:relation#${i}`,
    from: relation.from,
    to: relation.to,
    kind: 'relation',
    label: relation.card ?? relation.label,
  }));

  // Connected components & degree sorting
  const entityDegrees = new Map<string, number>(map.entities.map((e) => [e.id, 0]));
  const adj = new Map<string, string[]>();
  for (const e of map.entities) adj.set(e.id, []);
  for (const rel of relations) {
    entityDegrees.set(rel.from, (entityDegrees.get(rel.from) ?? 0) + 1);
    entityDegrees.set(rel.to, (entityDegrees.get(rel.to) ?? 0) + 1);
    adj.get(rel.from)?.push(rel.to);
    adj.get(rel.to)?.push(rel.from);
  }

  const visited = new Set<string>();
  const components: string[][] = [];
  for (const entity of map.entities) {
    if (visited.has(entity.id)) continue;
    const comp: string[] = [];
    const queue = [entity.id];
    visited.add(entity.id);
    while (queue.length) {
      const u = queue.shift()!;
      comp.push(u);
      for (const v of adj.get(u) ?? []) {
        if (!visited.has(v)) {
          visited.add(v);
          queue.push(v);
        }
      }
    }
    comp.sort((a, b) => (entityDegrees.get(b) ?? 0) - (entityDegrees.get(a) ?? 0) || a.localeCompare(b));
    components.push(comp);
  }

  components.sort((a, b) => b.length - a.length || a[0]!.localeCompare(b[0]!));
  const orderedEntityIds = components.flat();

  // Grid arrangement
  const n = orderedEntityIds.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const rows = Math.ceil(n / cols);

  const colSep = Math.max(theme.nodeSep ?? 56, 60);
  const rowSep = Math.max(theme.rankSep ?? 120, 80);

  const colWidths = Array.from({ length: cols }, () => 0);
  const rowHeights = Array.from({ length: rows }, () => 0);

  orderedEntityIds.forEach((id, idx) => {
    const c = idx % cols;
    const r = Math.floor(idx / cols);
    const d = dims.get(id)!;
    colWidths[c] = Math.max(colWidths[c]!, d.w);
    rowHeights[r] = Math.max(rowHeights[r]!, d.h);
  });

  const colX = [PAD];
  for (let c = 0; c < cols - 1; c++) {
    colX.push(colX[c]! + colWidths[c]! + colSep);
  }
  const rowY = [PAD];
  for (let r = 0; r < rows - 1; r++) {
    rowY.push(rowY[r]! + rowHeights[r]! + rowSep);
  }

  const entityPositions = new Map<string, { x: number; y: number; w: number; h: number }>();
  orderedEntityIds.forEach((id, idx) => {
    const c = idx % cols;
    const r = Math.floor(idx / cols);
    const d = dims.get(id)!;
    entityPositions.set(id, { x: colX[c]!, y: rowY[r]!, w: d.w, h: d.h });
  });

  const entities = map.entities.map((entity) => {
    const pos = entityPositions.get(entity.id)!;
    return {
      id: entity.id,
      x: round(pos.x),
      y: round(pos.y),
      w: round(pos.w),
      h: round(pos.h),
      labelLines: [entity.label],
      kind: 'database',
      pinned: false,
      fields: entity.fields.map((f) => ({ name: f.name, type: f.type, key: f.key ?? '' })),
    };
  });

  const entityById = new Map(map.entities.map((e) => [e.id, e]));
  const layoutEntityById = new Map(entities.map((e) => [e.id, e]));
  const relationLayout: LayoutEdge[] = [];

  for (const relation of relations) {
    const fromEnt = entityById.get(relation.from);
    const toEnt = entityById.get(relation.to);
    const fromBox = layoutEntityById.get(relation.from);
    const toBox = layoutEntityById.get(relation.to);
    if (!fromEnt || !toEnt || !fromBox || !toBox) continue;

    let fromY = fromBox.y + 24;
    let toY = toBox.y + 24;

    const fkFieldIdx = fromEnt.fields.findIndex(
      (f) => f.ref?.startsWith(toEnt.id) || (f.key === 'fk' && f.name.toLowerCase().includes(toEnt.id.toLowerCase()))
    );
    if (fkFieldIdx >= 0) {
      fromY = fromBox.y + 44 + fkFieldIdx * 22;
    }

    const pkFieldIdx = toEnt.fields.findIndex((f) => f.key === 'pk');
    if (pkFieldIdx >= 0) {
      toY = toBox.y + 44 + pkFieldIdx * 22;
    }

    let pStart: Point;
    let pEnd: Point;

    if (toBox.x >= fromBox.x + fromBox.w) {
      pStart = { x: fromBox.x + fromBox.w, y: fromY };
      pEnd = { x: toBox.x, y: toY };
    } else if (fromBox.x >= toBox.x + toBox.w) {
      pStart = { x: fromBox.x, y: fromY };
      pEnd = { x: toBox.x + toBox.w, y: toY };
    } else if (toBox.y >= fromBox.y + fromBox.h) {
      pStart = { x: fromBox.x + fromBox.w / 2, y: fromBox.y + fromBox.h };
      pEnd = { x: toBox.x + toBox.w / 2, y: toBox.y };
    } else {
      pStart = { x: fromBox.x + fromBox.w / 2, y: fromBox.y };
      pEnd = { x: toBox.x + toBox.w / 2, y: toBox.y + toBox.h };
    }

    const midX = (pStart.x + pEnd.x) / 2;
    const pts: Point[] = [pStart, { x: midX, y: pStart.y }, { x: midX, y: pEnd.y }, pEnd];
    const path = polylineToSvgPath(pts, 10);

    relationLayout.push({
      id: relation.id,
      from: relation.from,
      to: relation.to,
      kind: relation.kind,
      label: relation.label,
      labelLines: relation.label ? [relation.label] : [],
      path,
      points: pts,
      labelPos: { x: midX, y: (pStart.y + pEnd.y) / 2 - 12 },
    });
  }

  const width = Math.max(460, ...entities.map((e) => e.x + e.w + 40));
  const height = Math.max(320, ...entities.map((e) => e.y + e.h + 40));
  return {
    type: 'erd',
    width: Math.ceil(width),
    height: Math.ceil(height),
    entities,
    relations: relationLayout,
  };
}

export function layoutMap(map: VibeMap, theme: Theme, options: LayoutOptions = {}): LayoutResult {
  switch (map.type) {
    case 'graph':
      return layoutGraph(map, theme, options);
    case 'sequence':
      return layoutSequence(map, theme);
    case 'erd':
      return layoutErdMap(map, theme);
    case 'mermaid':
      return { type: 'mermaid', width: 900, height: 420, source: map.source };
  }
}

export function layoutGraphMap(map: GraphMap, theme: Theme, options: LayoutOptions = {}): GraphLayout {
  return layoutGraph(map, theme, options);
}

export const layoutInternals = {
  rankNodes,
  orderLayers: orderLayersWithRefinement,
  measureNodeBox,
  NODE_MARGIN,
};

export type { EdgeInput, InternalBox as LayoutBoxInternal };
