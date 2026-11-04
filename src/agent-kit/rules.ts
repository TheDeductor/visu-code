import fs from 'node:fs';
import path from 'node:path';
import type { AgentTarget, ProjectConfig } from '../core/types.js';
import { writeFileAtomicSync } from '../core/yaml.js';

export const MANAGED_START = '<!-- vibemap:start -->';
export const MANAGED_END = '<!-- vibemap:end -->';

export const AGENT_FILES: Record<Exclude<AgentTarget, 'generic'>, string> = {
  'claude-code': 'CLAUDE.md',
  cursor: '.cursor/rules/vibemap.mdc',
  codex: 'AGENTS.md',
  copilot: '.github/copilot-instructions.md',
  gemini: 'GEMINI.md',
  windsurf: '.windsurf/rules/vibemap.md',
  aider: 'CONVENTIONS.md',
};

export function modeText(mode: ProjectConfig['tracking']['mode']): string {
  switch (mode) {
    case 'every-change':
      return 'Update maps after every meaningful change.';
    case 'per-phase':
      return 'Only update maps when the user asks or when a phase is completed; then summarise the whole phase in one change entry.';
    case 'manual':
      return 'Do not touch maps unless the user asks.';
    case 'off':
      return 'Do not modify .vibemap/.';
  }
}

export function managedBlock(config: ProjectConfig): string {
  return `${MANAGED_START}
## VibeMap (visual project memory)

This project keeps diagrams and notes in \`.vibemap/\`. Read \`.vibemap/AGENT_GUIDE.md\` once per session.

- Before changing code in an area: run \`vibemap context --area <path-or-feature>\`.
- After changing code: update affected maps with \`vibemap patch\`, run \`vibemap check\`, then \`vibemap change add\`.
- Tracking mode: **${config.tracking.mode}**. Granularity: **${config.tracking.granularity}**.
- Never edit \`.vibemap/layouts/\`, \`config.yaml\`, \`theme.yaml\` or \`locks.json\`.
- Never change or delete a locked node. Propose the change to the user instead.
- Do not invent components: every real node points at code with \`refs\`.

${modeText(config.tracking.mode)}
${MANAGED_END}`;
}

export function cursorBlock(config: ProjectConfig): string {
  return `---
description: VibeMap visual project memory
alwaysApply: true
---

${managedBlock(config)}`;
}

export function upsertManagedBlock(content: string, block: string): string {
  const start = content.indexOf(MANAGED_START);
  const end = content.indexOf(MANAGED_END);
  if (start !== -1 && end !== -1 && end > start) {
    const after = end + MANAGED_END.length;
    return `${content.slice(0, start)}${block}${content.slice(after)}`.replace(/\n{3,}/g, '\n\n').replace(/\s*$/, '\n');
  }
  const trimmed = content.replace(/\s*$/, '');
  return `${trimmed ? `${trimmed}\n\n` : ''}${block}\n`;
}

export function stripManagedBlock(content: string): string {
  const start = content.indexOf(MANAGED_START);
  const end = content.indexOf(MANAGED_END);
  if (start === -1 || end === -1 || end < start) return content;
  const before = content.slice(0, start).replace(/\s*$/, '');
  const after = content.slice(end + MANAGED_END.length).replace(/^\s*/, '');
  return `${before}${before && after ? '\n\n' : ''}${after}`.replace(/\s*$/, '\n');
}

export interface AgentWriteResult {
  file: string;
  action: 'created' | 'updated' | 'unchanged' | 'skipped';
  note?: string;
}

function writeIfChanged(abs: string, content: string): AgentWriteResult['action'] {
  const existing = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n') : null;
  if (existing === content) return 'unchanged';
  writeFileAtomicSync(abs, content);
  return existing === null ? 'created' : 'updated';
}

export function writeAgentFiles(
  root: string,
  config: ProjectConfig,
  agents: AgentTarget[],
): AgentWriteResult[] {
  const results: AgentWriteResult[] = [];
  for (const agent of agents) {
    if (agent === 'generic') continue;
    const rel = AGENT_FILES[agent];
    if (!rel) continue;
    const abs = path.join(root, rel);
    const existing = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n') : '';
    let content: string;
    if (agent === 'cursor') {
      if (existing.includes(MANAGED_START)) content = upsertManagedBlock(existing, managedBlock(config));
      else content = existing ? upsertManagedBlock(existing, managedBlock(config)) : cursorBlock(config);
    } else {
      content = upsertManagedBlock(existing, managedBlock(config));
    }
    const action = writeIfChanged(abs, content);
    results.push({ file: rel, action });
  }
  return results;
}

export function removeAgentFiles(root: string, agents: AgentTarget[]): AgentWriteResult[] {
  const results: AgentWriteResult[] = [];
  for (const agent of agents) {
    if (agent === 'generic') continue;
    const rel = AGENT_FILES[agent];
    if (!rel) continue;
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) {
      results.push({ file: rel, action: 'skipped', note: 'not present' });
      continue;
    }
    const existing = fs.readFileSync(abs, 'utf8');
    if (!existing.includes(MANAGED_START)) {
      results.push({ file: rel, action: 'skipped', note: 'no managed block' });
      continue;
    }
    const stripped = stripManagedBlock(existing);
    const action = writeIfChanged(abs, stripped);
    results.push({ file: rel, action });
  }
  return results;
}

interface HookConfig {
  matcher?: string;
  hooks?: Array<{ type: string; command: string }>;
}

function hookCommand(event: string): string {
  return `npx --no-install vibemap hook ${event}`;
}

/** Merge VibeMap hooks into Claude Code settings without touching unrelated hooks. */
export function installClaudeHooks(root: string): AgentWriteResult {
  const rel = '.claude/settings.json';
  const abs = path.join(root, rel);
  let settings: Record<string, unknown> = {};
  if (fs.existsSync(abs)) {
    try {
      settings = JSON.parse(fs.readFileSync(abs, 'utf8')) as Record<string, unknown>;
    } catch {
      return { file: rel, action: 'skipped', note: 'existing settings.json is not valid JSON' };
    }
  }
  const hooks = (settings.hooks && typeof settings.hooks === 'object' ? settings.hooks : {}) as Record<string, HookConfig[]>;
  const ensure = (event: string, matcher: string | undefined): void => {
    const list = Array.isArray(hooks[event]) ? hooks[event] : [];
    const command = hookCommand(event === 'PostToolUse' ? 'post-edit' : 'stop');
    const already = list.some((item) => item.hooks?.some((h) => h.command?.includes(`vibemap hook ${event === 'PostToolUse' ? 'post-edit' : 'stop'}`)));
    if (!already) list.push({ ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command }] });
    hooks[event] = list;
  };
  ensure('PostToolUse', 'Edit|Write|MultiEdit');
  ensure('Stop', undefined);
  settings.hooks = hooks;
  const content = `${JSON.stringify(settings, null, 2)}\n`;
  return { file: rel, action: writeIfChanged(abs, content) };
}

export function removeClaudeHooks(root: string): AgentWriteResult {
  const rel = '.claude/settings.json';
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return { file: rel, action: 'skipped', note: 'not present' };
  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(fs.readFileSync(abs, 'utf8')) as Record<string, unknown>;
  } catch {
    return { file: rel, action: 'skipped', note: 'invalid JSON' };
  }
  const hooks = settings.hooks as Record<string, HookConfig[]> | undefined;
  if (!hooks) return { file: rel, action: 'skipped', note: 'no hooks' };
  for (const event of Object.keys(hooks)) {
    hooks[event] = (hooks[event] ?? []).filter(
      (item) => !item.hooks?.some((h) => h.command?.includes('vibemap hook ')),
    );
    if (!hooks[event]!.length) delete hooks[event];
  }
  if (!Object.keys(hooks).length) delete settings.hooks;
  return { file: rel, action: writeIfChanged(abs, `${JSON.stringify(settings, null, 2)}\n`) };
}

const GIT_HOOK_MARKER = '# vibemap-managed-hook';

export function installGitHooks(root: string): AgentWriteResult[] {
  const gitDir = path.join(root, '.git');
  if (!fs.existsSync(gitDir)) {
    return [{ file: '.git/hooks', action: 'skipped', note: 'not a git repository' }];
  }
  const hooksDir = path.join(gitDir, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  const results: AgentWriteResult[] = [];
  const hooks: Array<[string, string]> = [
    [
      'pre-commit',
      `#!/bin/sh
${GIT_HOOK_MARKER}
# Blocks commits that leave VibeMap invalid. Set VIBEMAP_SKIP_HOOKS=1 to bypass.
if [ "$VIBEMAP_SKIP_HOOKS" = "1" ]; then exit 0; fi
npx --no-install vibemap check || {
  echo ""
  echo "VibeMap check failed. Fix the errors above, or commit with VIBEMAP_SKIP_HOOKS=1."
  exit 1
}
`,
    ],
    [
      'post-commit',
      `#!/bin/sh
${GIT_HOOK_MARKER}
if [ "$VIBEMAP_SKIP_HOOKS" = "1" ]; then exit 0; fi
npx --no-install vibemap change seal --latest >/dev/null 2>&1 || true
`,
    ],
  ];
  for (const [name, content] of hooks) {
    const abs = path.join(hooksDir, name);
    if (fs.existsSync(abs)) {
      const existing = fs.readFileSync(abs, 'utf8');
      if (!existing.includes(GIT_HOOK_MARKER)) {
        results.push({ file: `.git/hooks/${name}`, action: 'skipped', note: 'existing hook not managed by VibeMap' });
        continue;
      }
    }
    const action = writeIfChanged(abs, content);
    try {
      fs.chmodSync(abs, 0o755);
    } catch {
      // Windows does not need execute bits.
    }
    results.push({ file: `.git/hooks/${name}`, action });
  }
  return results;
}

export function removeGitHooks(root: string): AgentWriteResult[] {
  const hooksDir = path.join(root, '.git', 'hooks');
  const results: AgentWriteResult[] = [];
  for (const name of ['pre-commit', 'post-commit']) {
    const abs = path.join(hooksDir, name);
    if (!fs.existsSync(abs)) continue;
    const content = fs.readFileSync(abs, 'utf8');
    if (!content.includes(GIT_HOOK_MARKER)) {
      results.push({ file: `.git/hooks/${name}`, action: 'skipped', note: 'not managed by VibeMap' });
      continue;
    }
    fs.rmSync(abs, { force: true });
    results.push({ file: `.git/hooks/${name}`, action: 'updated', note: 'removed' });
  }
  return results;
}
