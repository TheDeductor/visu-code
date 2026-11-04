import type { Issue, MapSummary, VibeMap } from '@core/types';

export function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function relativeTime(iso: string | undefined): string {
  if (!iso) return '';
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return '';
  const diff = Date.now() - time;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadText(filename: string, text: string, type = 'text/plain'): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function mapFolder(id: string): string {
  const index = id.lastIndexOf('/');
  return index === -1 ? '' : id.slice(0, index);
}

export function mapLeaf(id: string): string {
  return id.slice(id.lastIndexOf('/') + 1);
}

export function mapIcon(map: Pick<MapSummary, 'type' | 'level'>): string {
  if (map.type === 'sequence') return '⇄';
  if (map.type === 'erd') return '▤';
  if (map.type === 'mermaid') return 'M';
  if (map.level === 'overview') return '◎';
  if (map.level === 'detail') return '◌';
  return '▢';
}

export function checkTone(errors: number, warnings: number): 'error' | 'warn' | 'ok' {
  if (errors) return 'error';
  if (warnings) return 'warn';
  return 'ok';
}

export function issueLocation(issue: Issue): string {
  return `${issue.file}${issue.line ? `:${issue.line}` : ''}`;
}

export function mapIdFromIssueFile(file: string): string | null {
  const match = file.match(/^\.vibemap\/maps\/(.+)\.vmap\.yaml$/);
  return match ? match[1]! : null;
}

export interface BodySection {
  heading: string;
  body: string;
}

export function parseBodySections(body: string): BodySection[] {
  const sections: BodySection[] = [];
  const lines = body.split('\n');
  let heading = '';
  let buffer: string[] = [];
  const push = (): void => {
    if (!heading && !buffer.join('').trim()) return;
    sections.push({ heading: heading || 'Summary', body: buffer.join('\n').trim() });
  };
  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      push();
      heading = match[1]!.trim();
      buffer = [];
    } else {
      buffer.push(line);
    }
  }
  push();
  return sections;
}

export function nodeLabel(map: VibeMap | undefined, id: string): string {
  if (!map) return id;
  if (map.type === 'graph') return map.nodes.find((n) => n.id === id)?.label ?? id;
  if (map.type === 'sequence') return map.participants.find((p) => p.id === id)?.label ?? id;
  if (map.type === 'erd') return map.entities.find((e) => e.id === id)?.label ?? id;
  return id;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function shortPath(path: string, max = 46): string {
  if (path.length <= max) return path;
  const parts = path.split('/');
  const file = parts.pop() ?? path;
  const first = parts[0] ?? '';
  return `${first}/…/${file}`.slice(0, max);
}

export function promptForFile(file: string): string {
  return `Map ${file}. Read it, decide which existing feature map it belongs to (create one if needed), add a node with refs path+symbol, and connect it to its callers/callees. Then run vibemap check.`;
}
