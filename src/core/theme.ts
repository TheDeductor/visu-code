import type { NodeKind, Theme } from './types.js';

export const FONT_SIZE = 13;
export const LINE_HEIGHT = 18;
export const NODE_PADDING_X = 16;
export const NODE_PADDING_Y = 13;

export function measureText(text: string, fontSize = FONT_SIZE): number {
  // Average glyph width approximation; deliberately a little generous so labels never clip.
  return text.length * fontSize * 0.56;
}

export function wrapText(text: string, maxWidth: number, fontSize = FONT_SIZE): string[] {
  const clean = text.trim();
  if (!clean) return [''];
  const lines: string[] = [];
  for (const paragraph of clean.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (measureText(next, fontSize) <= maxWidth) {
        current = next;
        continue;
      }
      if (current) lines.push(current);
      if (measureText(word, fontSize) <= maxWidth) {
        current = word;
      } else {
        // Break very long words (paths, identifiers) at character boundaries.
        let chunk = '';
        for (const char of word) {
          if (measureText(chunk + char, fontSize) > maxWidth && chunk) {
            lines.push(chunk);
            chunk = char;
          } else {
            chunk += char;
          }
        }
        current = chunk;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [''];
}

export function labelFontSize(theme: Theme): number {
  return theme.font === 'code' ? 12 : FONT_SIZE;
}

export function labelLineHeight(theme: Theme): number {
  return theme.font === 'code' ? 17 : LINE_HEIGHT;
}

export type NodeShape = 'rounded' | 'rect' | 'ellipse' | 'diamond' | 'sticky' | 'parallelogram';

export function shapeForKind(kind: NodeKind | string): NodeShape {
  switch (kind) {
    case 'database':
    case 'cache':
    case 'storage':
    case 'actor':
      return 'ellipse';
    case 'decision':
      return 'diamond';
    case 'note':
      return 'sticky';
    case 'queue':
      return 'parallelogram';
    case 'ui':
    case 'page':
    case 'component':
    case 'function':
    case 'file':
    case 'process':
      return 'rounded';
    default:
      return 'rect';
  }
}

export function fillForKind(kind: NodeKind | string, theme: Theme): string {
  const c = theme.colors;
  switch (kind) {
    case 'ui':
    case 'page':
    case 'component':
      return c.ui;
    case 'api':
    case 'service':
    case 'module':
      return c.api;
    case 'database':
    case 'cache':
    case 'storage':
      return c.database;
    case 'external':
      return c.external;
    case 'queue':
      return c.queue;
    case 'actor':
      return c.actor;
    case 'decision':
      return c.decision;
    case 'note':
      return c.note;
    default:
      return c.neutral;
  }
}

export function kindLabel(kind: NodeKind | string): string {
  const names: Record<string, string> = {
    ui: 'Screen',
    page: 'Page',
    component: 'UI component',
    api: 'Server endpoint',
    service: 'Service',
    module: 'Module',
    function: 'Function',
    file: 'File',
    database: 'Stored data',
    queue: 'Queue',
    cache: 'Cache',
    storage: 'Storage',
    external: 'Outside system',
    actor: 'Person or system',
    decision: 'Decision',
    process: 'Process',
    config: 'Configuration',
    note: 'Note',
    custom: 'Custom',
  };
  return names[kind] ?? kind;
}

