import fs from 'node:fs';
import path from 'node:path';
import { loadProject } from './project.js';
import { removeAgentFiles, removeClaudeHooks, removeGitHooks } from '../agent-kit/rules.js';

export interface EjectResult {
  removed: string[];
  skipped: string[];
  purged: boolean;
}

export function ejectProject(root: string, purge = false): EjectResult {
  const removed: string[] = [];
  const skipped: string[] = [];
  const project = loadProject(root);
  for (const result of removeAgentFiles(project.root, project.config.agents)) {
    if (result.action === 'skipped') skipped.push(`${result.file}${result.note ? ` (${result.note})` : ''}`);
    else removed.push(result.file);
  }
  if (project.config.agents.includes('claude-code')) {
    const result = removeClaudeHooks(project.root);
    if (result.action === 'skipped') skipped.push(`${result.file} (${result.note ?? 'unchanged'})`);
    else removed.push(result.file);
  }
  for (const result of removeGitHooks(project.root)) {
    if (result.action === 'skipped') skipped.push(`${result.file} (${result.note})`);
    else removed.push(result.file);
  }
  if (purge) {
    fs.rmSync(project.vibemapDir, { recursive: true, force: true });
    removed.push('.vibemap/');
  }
  return { removed, skipped, purged: purge };
}

export function ejectSummary(result: EjectResult, root: string): string {
  const lines = ['VibeMap integration removed.'];
  if (result.removed.length) lines.push(`Removed: ${result.removed.join(', ')}`);
  if (result.skipped.length) lines.push(`Left untouched: ${result.skipped.join(', ')}`);
  if (result.purged) lines.push('Project data (.vibemap/) was purged.');
  else lines.push(`Project data remains in ${path.join(root, '.vibemap')}. Remove it manually or use --purge.`);
  return lines.join('\n');
}
