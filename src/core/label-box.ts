import { measureText } from './theme.js';

export const EDGE_LABEL_FONT_SIZE = 13;
export const EDGE_LABEL_LINE_HEIGHT = 17;
export const EDGE_LABEL_HALO = 4;

export interface EdgeLabelInput {
  label?: string;
  labelLines?: string[];
  labelPos: { x: number; y: number };
}

export interface LabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function edgeLabelLines(edge: EdgeLabelInput): string[] {
  // The renderer only draws a label when labelLines has content. An empty
  // array means the layout declined to place it; do not invent a box from
  // edge.label in that case.
  if (Array.isArray(edge.labelLines)) return edge.labelLines;
  return edge.label ? [edge.label] : [];
}

/**
 * The rendered edge-label box: same text measurement, line height and
 * y-offset as the viewer, plus halo padding on every side.
 */
export function edgeLabelBox(edge: EdgeLabelInput, halo = EDGE_LABEL_HALO): LabelBox | null {
  const lines = edgeLabelLines(edge);
  if (!lines.length) return null;
  const w = Math.max(...lines.map((line) => measureText(line, EDGE_LABEL_FONT_SIZE)), 0) + halo * 2;
  const h = lines.length * EDGE_LABEL_LINE_HEIGHT + halo * 2;
  const textY = edge.labelPos.y - (lines.length - 1) * 8.5;
  return { x: edge.labelPos.x - w / 2, y: textY - h / 2, w, h };
}
