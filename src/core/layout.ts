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
  VibeMap,
} from './types.js';
import {
  NODE_PADDING_X,
  NODE_PADDING_Y,
  labelFontSize,
  labelLineHeight,
  measureText,
  wrapText,
} from './theme.js';

interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  pinned: boolean;
  group?: string;
}

interface EdgeInput {
  id: string;
  from: string;
  to: string;
  kind: string;
  label?: string;
}

interface Positioned {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 30;
const NODE_MARGIN = 16;

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

function measureNodeBox(label: string, kind: string, theme: Theme, minW = theme.minNodeSize.w, minH = theme.minNodeSize.h): { w: number; h: number; lines: string[] } {
  const fontSize = labelFontSize(theme);
  const lineHeight = labelLineHeight(theme);
  const maxText = Math.max(80, theme.maxLabelWidth - NODE_PADDING_X * 2);
  const lines = wrapText(label, maxText, fontSize);
  const textWidth = Math.max(...lines.map((line) => measureText(line, fontSize)), 0);
  const w = Math.max(minW, Math.ceil(textWidth + NODE_PADDING_X * 2));
  const h = Math.max(minH, Math.ceil(lines.length * lineHeight + NODE_PADDING_Y * 2));
  return { w, h, lines };
}

/** Stable layered ranks: cycles are made acyclic by dropping DFS back edges. */
function rankNodes(ids: string[], edges: EdgeInput[]): Map<string, number> {
  const adj = new Map<string, string[]>();
  for (const id of ids) adj.set(id, []);
  for (const edge of edges) {
    if (edge.from === edge.to) continue;
    if (!adj.has(edge.from) || !adj.has(edge.to)) continue;
    adj.get(edge.from)!.push(edge.to);
  }
  for (const list of adj.values()) list.sort();
  const state = new Map<string, 0 | 1 | 2>();
  const back = new Set<string>();
  const visit = (u: string): void => {
    state.set(u, 1);
    for (const v of adj.get(u) ?? []) {
      const s = state.get(v) ?? 0;
      if (s === 1) back.add(`${u}\u0000${v}`);
      else if (s === 0) visit(v);
    }
    state.set(u, 2);
  };
  for (const id of [...ids].sort()) if ((state.get(id) ?? 0) === 0) visit(id);

  const indegree = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const u of ids) {
    for (const v of adj.get(u) ?? []) {
      if (back.has(`${u}\u0000${v}`)) continue;
      indegree.set(v, (indegree.get(v) ?? 0) + 1);
    }
  }
  const queue = ids.filter((id) => (indegree.get(id) ?? 0) === 0).sort();
  const ranks = new Map<string, number>(ids.map((id) => [id, 0]));
  const topo: string[] = [];
  while (queue.length) {
    const u = queue.shift()!;
    topo.push(u);
    for (const v of adj.get(u) ?? []) {
      if (back.has(`${u}\u0000${v}`)) continue;
      ranks.set(v, Math.max(ranks.get(v) ?? 0, (ranks.get(u) ?? 0) + 1));
      indegree.set(v, (indegree.get(v) ?? 1) - 1);
      if ((indegree.get(v) ?? 0) === 0) {
        queue.push(v);
        queue.sort();
      }
    }
  }
  // Defensive: if a strongly connected component was missed, keep nodes visible.
  for (const id of ids) if (!topo.includes(id)) ranks.set(id, ranks.get(id) ?? 0);
  return ranks;
}

function orderLayers(ids: string[], edges: EdgeInput[], ranks: Map<string, number>, previous: Map<string, { x: number; y: number }>, groups: Map<string, string>): string[][] {
  const maxRank = Math.max(0, ...ids.map((id) => ranks.get(id) ?? 0));
  const layers: string[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const id of [...ids].sort()) layers[ranks.get(id) ?? 0]!.push(id);
  const preds = new Map<string, string[]>();
  const succs = new Map<string, string[]>();
  for (const id of ids) {
    preds.set(id, []);
    succs.set(id, []);
  }
  for (const edge of edges) {
    if (edge.from === edge.to || !ranks.has(edge.from) || !ranks.has(edge.to)) continue;
    succs.get(edge.from)!.push(edge.to);
    preds.get(edge.to)!.push(edge.from);
  }
  const sortLayer = (layer: string[], neighbours: Map<string, string[]>, layerIndex: number): string[] => {
    const other = new Map<string, number>();
    // Build an index over the adjacent layer's current order.
    const adjacent = neighbours === preds ? layerIndex - 1 : layerIndex + 1;
    const target = layers[adjacent] ?? [];
    target.forEach((id, index) => other.set(id, index));
    const score = new Map<string, number>();
    layer.forEach((id, index) => {
      const ns = neighbours.get(id) ?? [];
      const values = ns.map((n) => other.get(n)).filter((v): v is number => v !== undefined);
      score.set(id, values.length ? values.reduce((a, b) => a + b, 0) / values.length : index);
    });
    return [...layer].sort((a, b) => {
      const sa = score.get(a) ?? 0;
      const sb = score.get(b) ?? 0;
      if (Math.abs(sa - sb) > 1e-9) return sa - sb;
      const ga = groups.get(a) ?? '';
      const gb = groups.get(b) ?? '';
      if (ga !== gb) return ga.localeCompare(gb);
      const pa = previous.get(a);
      const pb = previous.get(b);
      if (pa && pb) return pa.y - pb.y || a.localeCompare(b);
      return a.localeCompare(b);
    });
  };
  // Initial order by previous position (or id).
  for (const layer of layers) {
    layer.sort((a, b) => {
      const pa = previous.get(a);
      const pb = previous.get(b);
      if (pa && pb) return pa.y - pb.y || a.localeCompare(b);
      if (pa) return -1;
      if (pb) return 1;
      return a.localeCompare(b);
    });
  }
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 1; i < layers.length; i++) layers[i] = sortLayer(layers[i]!, preds, i);
    for (let i = layers.length - 2; i >= 0; i--) layers[i] = sortLayer(layers[i]!, succs, i);
  }
  return layers;
}

function layeredPositions(
  ids: string[],
  edges: EdgeInput[],
  dims: Map<string, { w: number; h: number }>,
  direction: Direction,
  gap: number,
  previous: Map<string, { x: number; y: number; w?: number; h?: number }>,
  groups: Map<string, string>,
): { positions: Map<string, Positioned>; width: number; height: number; layers: string[][] } {
  const ranks = rankNodes(ids, edges);
  const layers = orderLayers(ids, edges, ranks, previous, groups);
  const positions = new Map<string, Positioned>();
  const horizontal = direction === 'right' || direction === 'left';
  const layerExtents = layers.map((layer) => {
    if (horizontal) {
      const width = Math.max(0, ...layer.map((id) => dims.get(id)?.w ?? 0));
      const height = layer.reduce((sum, id) => sum + (dims.get(id)?.h ?? 0), 0) + gap * Math.max(0, layer.length - 1);
      return { width, height };
    }
    const width = layer.reduce((sum, id) => sum + (dims.get(id)?.w ?? 0), 0) + gap * Math.max(0, layer.length - 1);
    const height = Math.max(0, ...layer.map((id) => dims.get(id)?.h ?? 0));
    return { width, height };
  });
  let cursor = 0;
  if (horizontal) {
    const maxHeight = Math.max(0, ...layerExtents.map((e) => e.height));
    layers.forEach((layer, layerIndex) => {
      const extent = layerExtents[layerIndex]!;
      const x = cursor;
      let y = (maxHeight - extent.height) / 2;
      for (const id of layer) {
        const dim = dims.get(id)!;
        positions.set(id, { id, x: x + (extent.width - dim.w) / 2, y, w: dim.w, h: dim.h });
        y += dim.h + gap;
      }
      cursor += extent.width + gap;
    });
    const width = cursor - gap;
    for (const p of positions.values()) {
      if (direction === 'left') p.x = width - (p.x + p.w);
      p.x += PAD;
      p.y += PAD;
    }
    assertPositions(positions, ids, dims);
    return { positions, width: width + PAD * 2, height: maxHeight + PAD * 2, layers };
  }

  const maxWidth = Math.max(0, ...layerExtents.map((e) => e.width));
  layers.forEach((layer, layerIndex) => {
    const extent = layerExtents[layerIndex]!;
    const y = cursor;
    let x = (maxWidth - extent.width) / 2;
    for (const id of layer) {
      const dim = dims.get(id)!;
      positions.set(id, { id, x, y: y + (extent.height - dim.h) / 2, w: dim.w, h: dim.h });
      x += dim.w + gap;
    }
    cursor += extent.height + gap;
  });
  const height = cursor - gap;
  for (const p of positions.values()) {
    if (direction === 'up') p.y = height - (p.y + p.h);
    p.x += PAD;
    p.y += PAD;
  }
  assertPositions(positions, ids, dims);
  return { positions, width: maxWidth + PAD * 2, height: height + PAD * 2, layers };
}

function assertPositions(positions: Map<string, Positioned>, ids: string[], dims: Map<string, { w: number; h: number }>): void {
  for (const id of ids) {
    const pos = positions.get(id);
    const dim = dims.get(id);
    if (!pos || !dim) throw new Error(`Layout lost node "${id}"`);
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) throw new Error(`Non-finite layout position for "${id}"`);
  }
}

function overlaps(a: Box, b: Box, margin: number): { x: number; y: number } | null {
  const ax2 = a.x + a.w + margin;
  const ay2 = a.y + a.h + margin;
  const bx2 = b.x + b.w + margin;
  const by2 = b.y + b.h + margin;
  const overlapX = Math.min(ax2, bx2) - Math.max(a.x, b.x);
  const overlapY = Math.min(ay2, by2) - Math.max(a.y, b.y);
  if (overlapX <= margin || overlapY <= margin) return null;
  return { x: overlapX - margin, y: overlapY - margin };
}

/**
 * Collision resolution is a deterministic placement pass, not pairwise pushing.
 * Pairwise pushes oscillate when several automatic nodes surround one pinned node:
 * each push knocks a neighbour back into the pinned box. Instead we place pinned
 * nodes first, then keep every other node at its computed position if it is free,
 * or move it to the nearest free point on an expanding ring. A placed node never
 * moves again in this pass, so the result is stable.
 */
function resolveOverlaps(boxes: Box[], warnings: string[]): void {
  const pinned = boxes.filter((box) => box.pinned);
  for (let i = 0; i < pinned.length; i++) {
    for (let j = i + 1; j < pinned.length; j++) {
      if (overlaps(pinned[i]!, pinned[j]!, NODE_MARGIN)) {
        warnings.push(`W-PINNED-OVERLAP: pinned nodes "${pinned[i]!.id}" and "${pinned[j]!.id}" overlap.`);
      }
    }
  }
  const placed: Box[] = [...pinned];
  const free = (box: Box): boolean => placed.every((other) => !overlaps(box, other, NODE_MARGIN));
  const automatic = boxes.filter((box) => !box.pinned).sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  for (const box of automatic) {
    if (free(box)) {
      placed.push(box);
      continue;
    }
    const originX = box.x;
    const originY = box.y;
    let found = false;
    const angles = 24;
    for (let ring = 1; ring <= 100 && !found; ring++) {
      const radius = ring * 14;
      for (let step = 0; step < angles; step++) {
        const angle = (step / angles) * Math.PI * 2;
        const candidate = { ...box, x: originX + Math.cos(angle) * radius, y: originY + Math.sin(angle) * radius };
        if (!free(candidate)) continue;
        box.x = candidate.x;
        box.y = candidate.y;
        found = true;
        break;
      }
    }
    if (!found) {
      // Extremely dense maps: place below the current cluster rather than overlapping.
      box.y = Math.max(...placed.map((other) => other.y + other.h)) + NODE_MARGIN + 20;
    }
    placed.push(box);
  }
}

function groupBoxes(boxes: Box[], map: GraphMap): LayoutGroup[] {
  if (!map.groups?.length) return [];
  const out: LayoutGroup[] = [];
  for (const group of map.groups) {
    const members = boxes.filter((b) => b.group === group.id);
    if (!members.length) continue;
    const minX = Math.min(...members.map((b) => b.x));
    const minY = Math.min(...members.map((b) => b.y));
    const maxX = Math.max(...members.map((b) => b.x + b.w));
    const maxY = Math.max(...members.map((b) => b.y + b.h));
    out.push({
      id: group.id,
      label: group.label,
      x: minX - 26,
      y: minY - 48,
      w: maxX - minX + 52,
      h: maxY - minY + 70,
    });
  }
  return out;
}

function routeEdge(from: Box, to: Box, edge: EdgeInput, labelLines: string[]): LayoutEdge {
  const fc = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
  const tc = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
  let start: { x: number; y: number };
  let end: { x: number; y: number };
  let c1: { x: number; y: number };
  let c2: { x: number; y: number };

  if (from.id === to.id) {
    start = { x: from.x + from.w, y: from.y + 18 };
    end = { x: from.x + from.w, y: from.y + from.h - 18 };
    c1 = { x: from.x + from.w + 54, y: from.y - 12 };
    c2 = { x: from.x + from.w + 54, y: from.y + from.h + 12 };
  } else if (Math.abs(tc.x - fc.x) >= Math.abs(tc.y - fc.y)) {
    const forward = tc.x >= fc.x;
    start = { x: forward ? from.x + from.w : from.x, y: fc.y };
    end = { x: forward ? to.x : to.x + to.w, y: tc.y };
    const bend = Math.max(40, Math.min(160, Math.abs(end.x - start.x) * 0.5));
    c1 = { x: start.x + (forward ? bend : -bend), y: start.y };
    c2 = { x: end.x + (forward ? -bend : bend), y: end.y };
  } else {
    const downward = tc.y >= fc.y;
    start = { x: fc.x, y: downward ? from.y + from.h : from.y };
    end = { x: tc.x, y: downward ? to.y : to.y + to.h };
    const bend = Math.max(40, Math.min(140, Math.abs(end.y - start.y) * 0.5));
    c1 = { x: start.x, y: start.y + (downward ? bend : -bend) };
    c2 = { x: end.x, y: end.y + (downward ? -bend : bend) };
  }
  const path = `M ${round(start.x)} ${round(start.y)} C ${round(c1.x)} ${round(c1.y)}, ${round(c2.x)} ${round(c2.y)}, ${round(end.x)} ${round(end.y)}`;
  const t = 0.5;
  const labelPos = {
    x: bezier(start.x, c1.x, c2.x, end.x, t),
    y: bezier(start.y, c1.y, c2.y, end.y, t) - (labelLines.length > 1 ? 8 : 10),
  };
  return {
    id: edge.id,
    from: edge.from,
    to: edge.to,
    kind: edge.kind,
    label: edge.label,
    labelLines,
    path,
    points: [start, c1, c2, end],
    labelPos,
  };
}

function bezier(a: number, b: number, c: number, d: number, t: number): number {
  const mt = 1 - t;
  return mt * mt * mt * a + 3 * mt * mt * t * b + 3 * mt * t * t * c + t * t * t * d;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

export interface LayoutOptions {
  sidecar?: MapLayoutSidecar | null;
  previous?: LayoutResult | null;
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

function layoutGraph(map: GraphMap, theme: Theme, options: LayoutOptions): GraphLayout {
  const warnings: string[] = [];
  const prev = previousByName(options.previous);
  const sidecar = options.sidecar;
  const ids = map.nodes.map((n) => n.id);
  const dims = new Map<string, { w: number; h: number; lines: string[] }>();
  for (const node of map.nodes) {
    const side = sidecar?.nodes[node.id];
    if (side) {
      const fontSize = labelFontSize(theme);
      const lines = wrapText(node.label, Math.max(60, side.w - NODE_PADDING_X * 2), fontSize);
      dims.set(node.id, { w: side.w, h: side.h, lines });
    } else {
      const measured = measureNodeBox(node.label, node.kind, theme);
      dims.set(node.id, measured);
    }
  }
  const edgeInputs: EdgeInput[] = map.edges.map((edge, i) => ({
    id: edgeId(edge, i),
    from: edge.from,
    to: edge.to,
    kind: edge.kind,
    label: edge.label,
  }));
  const groupMap = new Map<string, string>();
  for (const node of map.nodes) if (node.group) groupMap.set(node.id, node.group);
  const positioned = layeredPositions(
    ids,
    edgeInputs,
    new Map([...dims.entries()].map(([id, d]) => [id, { w: d.w, h: d.h }])),
    map.direction ?? 'right',
    theme.gap,
    prev,
    groupMap,
  );
  const nodeById = new Map(map.nodes.map((n) => [n.id, n]));
  const boxes: Box[] = [];
  for (const node of map.nodes) {
    const pos = positioned.positions.get(node.id);
    if (!pos) continue;
    const side = sidecar?.nodes[node.id];
    const pinned = !!side;
    boxes.push({
      id: node.id,
      x: pinned ? side!.x : pos.x,
      y: pinned ? side!.y : pos.y,
      w: pinned ? side!.w : pos.w,
      h: pinned ? side!.h : pos.h,
      pinned,
      group: node.group,
    });
  }
  resolveOverlaps(boxes, warnings);
  const groups = groupBoxes(boxes, map);
  const boxById = new Map(boxes.map((b) => [b.id, b]));
  const edges: LayoutEdge[] = [];
  for (const edge of edgeInputs) {
    const from = boxById.get(edge.from);
    const to = boxById.get(edge.to);
    if (!from || !to) continue;
    const labelLines = wrapText(edge.label ?? '', 140, labelFontSize(theme));
    edges.push(routeEdge(from, to, edge, edge.label ? labelLines : []));
  }
  const nodeBoxes: LayoutBox[] = boxes.map((box) => {
    const node = nodeById.get(box.id)!;
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
  for (const node of map.nodes) {
    if (!boxById.has(node.id)) warnings.push(`Node "${node.id}" could not be positioned.`);
  }
  const width = Math.max(420, ...nodeBoxes.map((b) => b.x + b.w + 40), ...groups.map((g) => g.x + g.w + 40));
  const height = Math.max(300, ...nodeBoxes.map((b) => b.y + b.h + 40), ...groups.map((g) => g.y + g.h + 40));
  return {
    type: 'graph',
    width: Math.ceil(width),
    height: Math.ceil(height),
    nodes: nodeBoxes,
    edges,
    groups,
    direction: map.direction ?? 'right',
    warnings,
  };
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
  const gap = 46;
  const totalWidth = dims.reduce((sum, d) => sum + d.w, 0) + gap * Math.max(0, participants.length - 1);
  let x = PAD;
  const y = 36;
  const pos = new Map<string, { x: number; y: number; w: number; h: number; lines: string[] }>();
  participants.forEach((p, i) => {
    const dim = dims[i]!;
    pos.set(p.id, { x, y, w: dim.w, h: dim.h, lines: dim.lines });
    x += dim.w + gap;
  });
  const stepBase = y + Math.max(0, ...dims.map((d) => d.h)) + 54;
  const rowGap = 58;
  const steps = map.steps.map((step, index) => ({
    index,
    from: step.from,
    to: step.to,
    y: stepBase + index * rowGap,
    label: step.label,
    kind: step.kind ?? 'call',
    reverse: false,
  }));
  const bottom = stepBase + Math.max(1, map.steps.length) * rowGap + 24;
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
    return {
      index,
      kind: fragment.kind,
      label: fragment.label ?? fragment.kind,
      x: round(minX),
      y: round(stepBase + fromStep * rowGap - 34),
      w: round(maxX - minX),
      h: round((toStep - fromStep) * rowGap + 68),
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
      ...entity.fields.map((f) => measureText(`${f.name}  ${f.type}`, 13) + 70),
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
  const positioned = layeredPositions(
    map.entities.map((e) => e.id),
    relations,
    dims,
    map.direction ?? 'right',
    theme.gap,
    new Map(),
    new Map(),
  );
  const boxes: Box[] = map.entities.map((entity) => {
    const pos = positioned.positions.get(entity.id)!;
    return { id: entity.id, x: pos.x, y: pos.y, w: pos.w, h: pos.h, pinned: false };
  });
  const warnings: string[] = [];
  resolveOverlaps(boxes, warnings);
  const boxById = new Map(boxes.map((b) => [b.id, b]));
  const relationLayout: LayoutEdge[] = [];
  for (const relation of relations) {
    const from = boxById.get(relation.from);
    const to = boxById.get(relation.to);
    if (!from || !to) continue;
    const labelLines = relation.label ? wrapText(relation.label, 110, 13) : [];
    relationLayout.push(routeEdge(from, to, relation, labelLines));
  }
  const entities = map.entities.map((entity) => {
    const box = boxById.get(entity.id)!;
    return {
      id: entity.id,
      x: round(box.x),
      y: round(box.y),
      w: round(box.w),
      h: round(box.h),
      labelLines: [entity.label],
      kind: 'database',
      pinned: false,
      fields: entity.fields.map((f) => ({ name: f.name, type: f.type, key: f.key ?? '' })),
    };
  });
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

export function layoutGraphMap(map: GraphMap, theme: Theme, options: LayoutOptions = {}): GraphLayout {
  return layoutGraph(map, theme, options);
}

export const layoutInternals = {
  rankNodes,
  orderLayers,
  layeredPositions,
  resolveOverlaps,
  overlaps,
  routeEdge,
  measureNodeBox,
  groupBoxes,
  NODE_MARGIN,
};

export type { EdgeInput, Box as LayoutBoxInternal };
