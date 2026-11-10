import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgentTarget } from '../src/core/types.js';
import { defaultConfig } from '../src/core/defaults.js';
import { AGENT_FILES, MANAGED_END, MANAGED_START, managedBlock, writeAgentFiles } from '../src/agent-kit/rules.js';

const agents: Array<Exclude<AgentTarget, 'generic'>> = [
  'claude-code',
  'cursor',
  'codex',
  'copilot',
  'gemini',
  'windsurf',
  'aider',
];

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('managed rule blocks', () => {
  it.each(agents)('writes a managed block for %s', (agent) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibemap-agent-'));
    roots.push(root);
    const config = defaultConfig('demo');
    writeAgentFiles(root, config, [agent]);
    const content = fs.readFileSync(path.join(root, AGENT_FILES[agent]!), 'utf8');
    expect(content).toMatchSnapshot();
    const start = content.indexOf(MANAGED_START);
    const end = content.indexOf(MANAGED_END);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const block = content.slice(start, end + MANAGED_END.length);
    expect(block.split('\n').length).toBeLessThanOrEqual(12);
  });

  it('writes the generic target to AGENTS.md', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibemap-agent-'));
    roots.push(root);
    writeAgentFiles(root, defaultConfig('demo'), ['generic']);
    const content = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
    expect(content).toContain(MANAGED_START);
    expect(content).toContain('Read `.vibemap/AGENT_GUIDE.md` once per session.');
  });

  it('contains the required short rules', () => {
    const block = managedBlock(defaultConfig('demo'));
    expect(block).toContain('Read `.vibemap/AGENT_GUIDE.md` once per session.');
    expect(block).toContain('Steps over time → `sequence`');
    expect(block).toContain('overview ≤ 9 nodes, feature ≤ 10, ≤ 4 groups, edges ≤ 1.5×nodes');
    expect(block).toContain('Treat W120–W127 as errors');
    expect(block.split('\n').length).toBeLessThanOrEqual(12);
  });
});
