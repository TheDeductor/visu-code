import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { MapDiff, VibeMap } from './types.js';
import type { Project } from './project.js';
import { loadProject } from './project.js';
import { diffMaps, diffSummary } from './diff.js';
import { renderMermaid } from './render.js';
import { parseMapContent } from './maps.js';
import { validateProject, validateProjectAsync } from './validate.js';
import { mapIdFromFile, normalizeRelPath } from './paths.js';
import { repoPath } from './git.js';

function git(project: Project, args: string[]): string | null {
  try {
    return execFileSync('git', args, { cwd: project.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 });
  } catch {
    return null;
  }
}

function changedMapFiles(project: Project, base: string): string[] {
  const out = git(project, ['diff', '--name-only', '--relative', `${base}...HEAD`, '--', '.vibemap/maps']);
  if (!out) return [];
  return out
    .split('\n')
    .map((line) => normalizeRelPath(line.trim()))
    .filter((rel) => rel.endsWith('.vmap.yaml'));
}

function atBase(project: Project, base: string, rel: string): string | null {
  return git(project, ['show', `${base}:${repoPath(project.root, rel)}`]);
}

function atHead(project: Project, rel: string): string | null {
  const abs = path.join(project.root, rel);
  if (fs.existsSync(abs)) {
    try {
      return fs.readFileSync(abs, 'utf8');
    } catch {
      // fall through to git
    }
  }
  return git(project, ['show', `HEAD:${repoPath(project.root, rel)}`]);
}

function parse(content: string, rel: string): VibeMap | null {
  const result = parseMapContent(content, rel);
  return result.map ?? null;
}

export interface PrSummaryOptions {
  base?: string;
}

export async function prSummary(root: string, options: PrSummaryOptions = {}): Promise<string> {
  const project = loadProject(root);
  const base = options.base ?? 'main';
  if (!git(project, ['rev-parse', '--verify', base])) {
    return `## VibeMap\n\nBase branch \`${base}\` was not found. Pass \`--base <ref>\`.\n`;
  }
  const files = changedMapFiles(project, base);
  const lines: string[] = ['## VibeMap', ''];
  if (!files.length) {
    lines.push('No map changes in this pull request.', '');
    lines.push('> If code changed without map updates, run `vibemap drift` to find gaps.');
    return `${lines.join('\n')}\n`;
  }
  const check = await validateProjectAsync(project, { strict: false });
  lines.push(`**${files.length} map${files.length === 1 ? '' : 's'} changed.** Validation: ${check.errors.length} error(s), ${check.warnings.length} warning(s).`, '');
  lines.push('| Map | Change | Nodes | Edges |', '|---|---|---|---|');
  const details: string[] = [];
  for (const rel of files.slice(0, 12)) {
    const mapId = mapIdFromFile(rel);
    const baseContent = atBase(project, base, rel);
    const headContent = atHead(project, rel);
    const baseMap = baseContent ? parse(baseContent, rel) : null;
    const headMap = headContent ? parse(headContent, rel) : null;
    let diff: MapDiff | null = null;
    if (baseMap && headMap) diff = diffMaps(mapId, baseMap, headMap, base, 'working');
    const summary = baseMap && headMap ? diffSummary(diff!) : baseMap ? 'map deleted' : 'map added';
    const added = diff?.added.length ?? (headMap && headMap.type === 'graph' ? headMap.nodes.length : 0);
    const removed = diff?.removed.length ?? (baseMap && baseMap.type === 'graph' ? baseMap.nodes.length : 0);
    lines.push(`| \`${mapId}\` | ${summary} | +${added} / −${removed} | +${diff?.addedEdges.length ?? 0} / −${diff?.removedEdges.length ?? 0} |`);
    const before = baseMap ? renderMermaid(baseMap).trimEnd() : null;
    const after = headMap ? renderMermaid(headMap).trimEnd() : null;
    details.push(`<details><summary><code>${mapId}</code> — before / after</summary>\n`);
    if (before) details.push('**Before**\n\n```mermaid\n' + before + '\n```\n');
    if (after) details.push('**After**\n\n```mermaid\n' + after + '\n```\n');
    details.push('</details>\n');
  }
  lines.push('', ...details);
  if (check.errors.length) {
    lines.push('### Validation errors', '');
    for (const err of check.errors.slice(0, 20)) lines.push(`- **${err.code}** \`${err.file}${err.line ? `:${err.line}` : ''}\` — ${err.message}`);
  }
  if (check.warnings.length) {
    lines.push('', '<details><summary>Validation warnings</summary>', '');
    for (const warning of check.warnings.slice(0, 20)) lines.push(`- **${warning.code}** \`${warning.file}\` — ${warning.message}`);
    lines.push('', '</details>');
  }
  return `${lines.join('\n')}\n`;
}
