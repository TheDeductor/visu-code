import type {
  EvidenceMap,
  GraphLayout,
  LayoutBox,
  LayoutEdge,
  LayoutResult,
  MapLayoutSidecar,
  Theme,
  VibeMap,
} from './types.js';
import { fillForKind, labelFontSize, measureText, shapeForKind, wrapText } from './theme.js';
import { layoutMap } from './layout.js';
import { layoutEdgePath } from './geometry.js';

export type ExportFormat = 'svg' | 'png' | 'excalidraw' | 'mermaid' | 'md';

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fontFamily(theme: Theme): string {
  if (theme.font === 'code') return 'ui-monospace, SFMono-Regular, Consolas, monospace';
  if (theme.font === 'normal') return 'Inter, Segoe UI, system-ui, sans-serif';
  return "'Comic Sans MS', 'Segoe Print', 'Bradley Hand', cursive";
}

function svgTextLines(lines: string[], cx: number, cy: number, lineHeight: number, fill = '#1e1e1e', weight = 500): string {
  const start = cy - ((lines.length - 1) * lineHeight) / 2;
  return `<text x="${cx}" y="${start}" text-anchor="middle" dominant-baseline="middle" fill="${fill}" font-size="${lineHeight < 20 ? 13 : 16}" font-weight="${weight}">${lines
    .map((line, i) => `<tspan x="${cx}" dy="${i === 0 ? 0 : lineHeight}">${esc(line)}</tspan>`)
    .join('')}</text>`;
}

function svgHaloText(lines: string[], cx: number, cy: number, lineHeight: number, fill: string, halo: string, weight = 500): string {
  const start = cy - ((lines.length - 1) * lineHeight) / 2;
  return `<text x="${cx}" y="${start}" text-anchor="middle" dominant-baseline="middle" fill="${fill}" font-size="${lineHeight < 20 ? 13 : 16}" font-weight="${weight}" stroke="${halo}" stroke-width="4" paint-order="stroke" stroke-linejoin="round">${lines
    .map((line, i) => `<tspan x="${cx}" dy="${i === 0 ? 0 : lineHeight}">${esc(line)}</tspan>`)
    .join('')}</text>`;
}

function nodePath(shape: string, box: LayoutBox): string {
  const { x, y, w, h } = box;
  switch (shape) {
    case 'ellipse':
      return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}"`;
    case 'diamond':
      return `<path d="M ${x + w / 2} ${y} L ${x + w} ${y + h / 2} L ${x + w / 2} ${y + h} L ${x} ${y + h / 2} Z"`;
    case 'parallelogram':
      return `<path d="M ${x + 16} ${y} L ${x + w} ${y} L ${x + w - 16} ${y + h} L ${x} ${y + h} Z"`;
    case 'sticky':
      return `<path d="M ${x} ${y} L ${x + w - 14} ${y} L ${x + w} ${y + 14} L ${x + w} ${y + h} L ${x} ${y + h} Z"`;
    case 'rounded':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14"`;
    default:
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}"`;
  }
}

function edgeSvg(edge: LayoutEdge, theme: Theme): string {
  const mid = edge.labelPos;
  const label = edge.label && edge.labelLines.length
    ? `<g><title>${esc(edge.label)}</title>${svgHaloText(edge.labelLines, mid.x, mid.y, 17, '#495057', theme.colors.background)}</g>`
    : '';
  return `<g class="edge"><path d="${layoutEdgePath(edge, 10)}" fill="none" stroke="#495057" stroke-width="${theme.strokeWidth}" marker-end="url(#arrow)"/>${label}</g>`;
}

export function renderSvg(map: VibeMap, theme: Theme, layout: LayoutResult, evidence?: EvidenceMap, sidecar?: MapLayoutSidecar | null): string {
  const width = Math.max(400, layout.width);
  const height = Math.max(260, layout.height) + 52;
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(map.title)}">`);
  parts.push(`<defs><marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" fill="#495057"/></marker></defs>`);
  parts.push(`<rect width="100%" height="100%" fill="${theme.colors.background}"/>`);
  parts.push(`<text x="24" y="30" font-family="${fontFamily(theme)}" font-size="20" font-weight="700" fill="${theme.colors.ink}">${esc(map.title)}</text>`);
  if (map.summary) parts.push(`<text x="24" y="48" font-family="${fontFamily(theme)}" font-size="12" fill="#6c757d">${esc(map.summary)}</text>`);
  parts.push(`<g transform="translate(0,52)" font-family="${fontFamily(theme)}">`);

  if (layout.type === 'graph') {
    const graph = layout as GraphLayout;
    const groups = new Map(graph.groups.map((g) => [g.id, g]));
    for (const group of graph.groups) {
      parts.push(`<rect x="${group.x}" y="${group.y}" width="${group.w}" height="${group.h}" rx="18" fill="#f1f3f5" fill-opacity="0.55" stroke="#adb5bd" stroke-width="1.5" stroke-dasharray="6 5"/>`);
      parts.push(`<text x="${group.x + 16}" y="${group.y + 24}" font-size="14" font-weight="700" fill="#495057">${esc(group.label)}</text>`);
    }
    for (const edge of graph.edges) parts.push(edgeSvg(edge, theme));
    for (const node of graph.nodes) {
      const ev = evidence?.[node.id];
      const shape = shapeForKind(node.kind);
      const fill = fillForKind(node.kind, theme);
      const stroke = ev?.status === 'stale' ? '#e03131' : ev?.status === 'declared' ? '#868e96' : node.pinned ? '#1971c2' : '#343a40';
      const dashed = ev?.status === 'declared' || node.kind === 'external' || node.kind === 'note';
      const group = node.group ? groups.get(node.group) : undefined;
      void group;
      const attrs = `fill="${fill}" fill-opacity="${node.kind === 'actor' ? '1' : '0.92'}" stroke="${stroke}" stroke-width="${theme.strokeWidth + (node.pinned ? 1 : 0)}"${dashed ? ' stroke-dasharray="7 5"' : ''}`;
      const path = nodePath(shape, node);
      const strokeAttrs = path.startsWith('<rect') ? `${attrs}/>` : `${attrs}/>`;
      parts.push(`<g class="node">${path} ${strokeAttrs}${svgTextLines(node.labelLines, node.x + node.w / 2, node.y + node.h / 2, 20)}`);
      if (ev && ev.status !== 'verified' && ev.status !== 'planned') {
        const badge = ev.status === 'stale' ? '!' : '?';
        const color = ev.status === 'stale' ? '#e03131' : '#868e96';
        parts.push(`<circle cx="${node.x + node.w - 12}" cy="${node.y + 12}" r="10" fill="${color}"/><text x="${node.x + node.w - 12}" y="${node.y + 16}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">${badge}</text>`);
      }
      parts.push(`</g>`);
    }
  } else if (layout.type === 'sequence') {
    for (const p of layout.participants) {
      parts.push(`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="10" fill="${theme.colors.api}" stroke="#343a40" stroke-width="2"/>`);
      parts.push(svgTextLines(p.lines, p.x + p.w / 2, p.y + p.h / 2, 20));
      parts.push(`<line x1="${p.x + p.w / 2}" y1="${p.y + p.h}" x2="${p.x + p.w / 2}" y2="${p.lifelineBottom}" stroke="#adb5bd" stroke-width="1.5" stroke-dasharray="6 6"/>`);
    }
    for (const f of layout.fragments) {
      parts.push(`<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="#fff9db" fill-opacity="0.5" stroke="#f08c00" stroke-width="1.5" stroke-dasharray="5 4"/>`);
      parts.push(`<rect x="${f.x}" y="${f.y - 16}" width="${measureText(f.kind, 11) + 18}" height="20" fill="#f08c00"/><text x="${f.x + 9}" y="${f.y - 2}" font-size="11" font-weight="700" fill="#fff">${esc(f.kind)}</text>`);
    }
    const pById = new Map(layout.participants.map((p) => [p.id, p]));
    for (const step of layout.steps) {
      const from = pById.get(step.from);
      const to = pById.get(step.to);
      if (!from || !to) continue;
      const x1 = from.x + from.w / 2;
      const x2 = to.x + to.w / 2;
      parts.push(`<path d="M ${x1} ${step.y} L ${x2} ${step.y}" fill="none" stroke="#343a40" stroke-width="1.8" marker-end="url(#arrow)"/>`);
      parts.push(`<text x="${(x1 + x2) / 2}" y="${step.y - 10}" text-anchor="middle" font-size="12" fill="#343a40" stroke="${theme.colors.background}" stroke-width="4" paint-order="stroke" stroke-linejoin="round">${esc(step.label)}</text>`);
    }
  } else if (layout.type === 'erd') {
    for (const relation of layout.relations) parts.push(edgeSvg(relation, theme));
    for (const entity of layout.entities) {
      parts.push(`<rect x="${entity.x}" y="${entity.y}" width="${entity.w}" height="${entity.h}" rx="8" fill="#ffffff" stroke="#343a40" stroke-width="2"/>`);
      parts.push(`<rect x="${entity.x}" y="${entity.y}" width="${entity.w}" height="38" rx="8" fill="${theme.colors.database}" stroke="#343a40" stroke-width="2"/>`);
      parts.push(`<text x="${entity.x + entity.w / 2}" y="${entity.y + 24}" text-anchor="middle" font-size="15" font-weight="700" fill="#1e1e1e">${esc(entity.labelLines[0] ?? entity.id)}</text>`);
      entity.fields.forEach((field, i) => {
        const y = entity.y + 38 + 20 + i * 22;
        parts.push(`<text x="${entity.x + 14}" y="${y}" font-size="12" font-weight="600" fill="#1e1e1e">${field.key === 'pk' ? '🔑 ' : field.key === 'fk' ? '↗ ' : field.key === 'unique' ? '✦ ' : '  '}${esc(field.name)}</text>`);
        parts.push(`<text x="${entity.x + entity.w - 14}" y="${y}" text-anchor="end" font-size="12" fill="#6c757d">${esc(field.type)}</text>`);
      });
    }
  } else if (layout.type === 'mermaid') {
    parts.push(`<rect x="24" y="20" width="${width - 48}" height="${Math.min(600, height - 100)}" rx="8" fill="#ffffff" stroke="#ced4da"/>`);
    layout.source.split('\n').slice(0, 28).forEach((line, i) => {
      parts.push(`<text x="40" y="${48 + i * 20}" font-size="13" fill="#343a40" font-family="ui-monospace, Consolas, monospace">${esc(line)}</text>`);
    });
  }
  parts.push('</g></svg>');
  void sidecar;
  return parts.join('\n');
}

export function renderMermaid(map: VibeMap): string {
  if (map.type === 'mermaid') return map.source.endsWith('\n') ? map.source : `${map.source}\n`;
  if (map.type === 'sequence') {
    const lines = ['sequenceDiagram', `  title ${map.title}`];
    for (const p of map.participants) lines.push(`  participant ${sanitizeMermaidId(p.id)} as ${p.label}`);
    for (const step of map.steps) {
      const arrow = step.kind === 'return' ? '-->>' : '->>';
      lines.push(`  ${sanitizeMermaidId(step.from)}${arrow}${sanitizeMermaidId(step.to)}: ${step.label}`);
    }
    return `${lines.join('\n')}\n`;
  }
  if (map.type === 'erd') {
    const lines = ['erDiagram'];
    for (const entity of map.entities) {
      lines.push(`  ${sanitizeMermaidId(entity.id)} {`);
      for (const field of entity.fields) lines.push(`    ${field.type.replace(/\s+/g, '_')} ${field.name.replace(/[^A-Za-z0-9_]/g, '_')}`);
      lines.push('  }');
    }
    for (const relation of map.relations) {
      const card = relation.card === '1..n' ? '||--o{' : relation.card === 'n..1' ? '}o--||' : relation.card === 'n..n' ? '}o--o{' : '||--||';
      lines.push(`  ${sanitizeMermaidId(relation.from)} ${card} ${sanitizeMermaidId(relation.to)} : "${relation.label ?? 'relates'}"`);
    }
    return `${lines.join('\n')}\n`;
  }
  const direction = map.direction === 'down' ? 'TD' : map.direction === 'left' ? 'RL' : map.direction === 'up' ? 'BT' : 'LR';
  const lines = [`flowchart ${direction}`];
  const groups = map.groups ?? [];
  for (const group of groups) {
    lines.push(`  subgraph ${sanitizeMermaidId(group.id)}["${group.label}"]`);
    for (const node of map.nodes.filter((n) => n.group === group.id)) lines.push(`    ${mermaidNode(node)}`);
    lines.push('  end');
  }
  for (const node of map.nodes.filter((n) => !n.group)) lines.push(`  ${mermaidNode(node)}`);
  for (const edge of map.edges) {
    const label = edge.label ? `|${edge.label.replace(/\|/g, '/')}|` : '';
    lines.push(`  ${sanitizeMermaidId(edge.from)} -->${label} ${sanitizeMermaidId(edge.to)}`);
  }
  return `${lines.join('\n')}\n`;
}

function sanitizeMermaidId(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, '_');
}

function mermaidNode(node: import('./types.js').VibeNode): string {
  const label = node.label.replace(/"/g, '&quot;');
  const id = sanitizeMermaidId(node.id);
  switch (shapeForKind(node.kind)) {
    case 'ellipse':
      return node.kind === 'actor' ? `${id}(["${label}"])` : `${id}[("${label}")]`;
    case 'diamond':
      return `${id}{"${label}"}`;
    case 'sticky':
      return `${id}>"${label}"]`;
    default:
      return `${id}["${label}"]`;
  }
}

export function renderMarkdown(map: VibeMap, evidence?: EvidenceMap): string {
  const lines: string[] = [`# ${map.title}`, ''];
  if (map.summary) lines.push(map.summary, '');
  lines.push('```mermaid', renderMermaid(map).trimEnd(), '```', '');
  if (map.type === 'graph') {
    lines.push('## Components', '', '| Node | Kind | Status | Evidence | Code |', '|---|---|---|---|---|');
    for (const node of map.nodes) {
      const ev = evidence?.[node.id]?.status ?? '—';
      const ref = node.refs?.[0] ? `\`${node.refs[0].path}${node.refs[0].symbol ? `#${node.refs[0].symbol}` : ''}\`` : '—';
      lines.push(`| ${node.label} | ${node.kind} | ${node.status ?? 'built'} | ${ev} | ${ref} |`);
    }
    if (map.walkthrough?.length) {
      lines.push('', '## Walkthrough', '');
      map.walkthrough.forEach((step, i) => lines.push(`${i + 1}. ${step.text} _(${step.focus.join(', ')})_`));
    }
  }
  if (map.notes?.length) lines.push('', `Notes: ${map.notes.join(', ')}`);
  return `${lines.join('\n')}\n`;
}

export interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  strokeStyle: string;
  roughness: number;
  opacity: number;
  groupIds: string[];
  frameId: null;
  roundness: { type: number } | null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  boundElements: Array<{ id: string; type: string }> | null;
  updated: number;
  link: null;
  locked: boolean;
  customData?: Record<string, unknown>;
  [key: string]: unknown;
}

function seedFor(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 2_147_483_647;
}

export function renderExcalidraw(map: VibeMap, theme: Theme, layout: LayoutResult, mapId = 'map'): Record<string, unknown> {
  const elements: ExcalidrawElement[] = [];
  const now = 1_700_000_000_000;
  const base = (id: string, type: string, x: number, y: number, width: number, height: number): ExcalidrawElement => ({
    id,
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: '#343a40',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: theme.strokeWidth,
    strokeStyle: 'solid',
    roughness: theme.roughness,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: type === 'rectangle' ? { type: 3 } : null,
    seed: seedFor(id),
    version: 1,
    versionNonce: seedFor(`${id}-nonce`),
    isDeleted: false,
    boundElements: null,
    updated: now,
    link: null,
    locked: false,
  });
  if (layout.type === 'graph') {
    for (const group of layout.groups) {
      const el = base(`vm-${map.title}-g-${group.id}`, 'rectangle', group.x, group.y, group.w, group.h);
      el.backgroundColor = '#f1f3f5';
      el.strokeStyle = 'dashed';
      el.strokeWidth = 1.5;
      el.opacity = 30;
      el.customData = { vm: { kind: 'group', id: group.id } };
      elements.push(el);
      elements.push(textElement(`vm-${map.title}-gl-${group.id}`, group.label, group.x + 12, group.y + 8, 16, theme));
    }
    for (const edge of layout.edges) {
      const el = base(`vm-${map.title}-e-${edge.id}`, 'arrow', edge.points[0]!.x, edge.points[0]!.y, 0, 0);
      el.points = edge.points.map((p) => [p.x - edge.points[0]!.x, p.y - edge.points[0]!.y] as [number, number]);
      el.roundness = { type: 2 };
      el.customData = { vm: { kind: 'edge', id: edge.id, from: edge.from, to: edge.to } };
      el.boundElements = [];
      elements.push(el);
      if (edge.label && edge.labelLines.length) {
        elements.push(textElement(`vm-${map.title}-el-${edge.id}`, edge.label, edge.labelPos.x - 40, edge.labelPos.y - 10, 13, theme));
      }
    }
    for (const node of layout.nodes) {
      const shape = shapeForKind(node.kind);
      const type = shape === 'ellipse' ? 'ellipse' : shape === 'diamond' ? 'diamond' : 'rectangle';
      const id = `vm-${mapId}-n-${node.id}`;
      const el = base(id, type, node.x, node.y, node.w, node.h);
      el.backgroundColor = fillForKind(node.kind, theme);
      el.roundness = shape === 'rounded' ? { type: 3 } : null;
      el.customData = { vm: { kind: 'node', id: node.id } };
      if (node.kind === 'external') el.strokeStyle = 'dashed';
      elements.push(el);
      elements.push(textElement(`${id}-label`, node.labelLines.join('\n'), node.x + 12, node.y + node.h / 2 - (node.labelLines.length * 10), 15, theme, node.id));
    }
  } else {
    elements.push(textElement('vm-source', `Export of a ${map.type} map is not yet available in Excalidraw format. Use SVG or Mermaid.`, 40, 40, 16, theme));
  }
  return {
    type: 'excalidraw',
    version: 2,
    source: 'https://vibemap.local',
    elements,
    appState: { gridSize: null, viewBackgroundColor: theme.colors.background },
    files: {},
  };
}

function textElement(id: string, text: string, x: number, y: number, fontSize: number, theme: Theme, containerId?: string): ExcalidrawElement {
  const lines = text.split('\n');
  const el: ExcalidrawElement = {
    id,
    type: 'text',
    x,
    y,
    width: Math.max(...lines.map((l) => measureText(l, fontSize))),
    height: lines.length * fontSize * 1.25,
    angle: 0,
    strokeColor: theme.colors.ink,
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: seedFor(id),
    version: 1,
    versionNonce: seedFor(`${id}-nonce`),
    isDeleted: false,
    boundElements: null,
    updated: 1_700_000_000_000,
    link: null,
    locked: false,
    text,
    originalText: text,
    fontSize,
    fontFamily: theme.font === 'code' ? 3 : theme.font === 'normal' ? 2 : 1,
    textAlign: 'left',
    verticalAlign: 'top',
    containerId: containerId ?? null,
    lineHeight: 1.25,
  };
  return el;
}

export function layoutFor(map: VibeMap, theme: Theme, sidecar?: MapLayoutSidecar | null): LayoutResult {
  return layoutMap(map, theme, { sidecar });
}

export function renderFormat(map: VibeMap, theme: Theme, format: ExportFormat, evidence?: EvidenceMap, sidecar?: MapLayoutSidecar | null, mapId = 'map'): string {
  const layout = layoutFor(map, theme, sidecar);
  if (format === 'svg') return renderSvg(map, theme, layout, evidence, sidecar);
  if (format === 'mermaid') return renderMermaid(map);
  if (format === 'md') return renderMarkdown(map, evidence);
  if (format === 'excalidraw') return JSON.stringify(renderExcalidraw(map, theme, layout, mapId), null, 2);
  throw new Error('PNG export requires the optional Playwright dependency. Use --format svg for now.');
}
