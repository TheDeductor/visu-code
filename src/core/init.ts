import fs from 'node:fs';
import path from 'node:path';
import type { AgentTarget, ProjectConfig } from './types.js';
import { MAPS_DIR, SCHEMA_VERSION } from './types.js';
import { DEFAULT_CONFIG_YAML, DEFAULT_THEME_YAML, defaultConfig } from './defaults.js';
import { loadConfig, loadProject, type Project } from './project.js';
import { scanProject } from './scanner.js';
import { ensureDir, stringifyYaml, writeFileAtomic } from './yaml.js';
import { agentGuide } from '../agent-kit/guide.js';
import { installClaudeHooks, installGitHooks, writeAgentFiles, type AgentWriteResult } from '../agent-kit/rules.js';

export interface InitOptions {
  agents?: AgentTarget[];
  mode?: ProjectConfig['tracking']['mode'];
  granularity?: ProjectConfig['tracking']['granularity'];
  gitHooks?: boolean;
  hooks?: boolean;
  yes?: boolean;
  scan?: boolean;
}

export interface InitResult {
  root: string;
  created: string[];
  updated: string[];
  skipped: string[];
  agents: AgentTarget[];
  scan?: { files: number; routes: number; models: number; durationMs: number };
}

export function detectAgents(root: string): AgentTarget[] {
  const found = new Set<AgentTarget>();
  const exists = (rel: string): boolean => fs.existsSync(path.join(root, rel));
  if (exists('CLAUDE.md') || exists('.claude')) found.add('claude-code');
  if (exists('.cursor')) found.add('cursor');
  if (exists('AGENTS.md')) found.add('codex');
  if (exists('.github/copilot-instructions.md')) found.add('copilot');
  if (exists('GEMINI.md')) found.add('gemini');
  if (exists('.windsurf')) found.add('windsurf');
  if (exists('.aider.conf.yml') || exists('CONVENTIONS.md')) found.add('aider');
  if (found.size === 0) found.add('codex');
  return [...found];
}

function projectName(root: string): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { name?: unknown };
    if (typeof pkg.name === 'string' && pkg.name.trim()) return pkg.name.replace(/^@[^/]+\//, '');
  } catch {
    // no valid package.json
  }
  return path.basename(root);
}

function writeIfMissing(file: string, content: string, created: string[], skipped: string[], rel: string): void {
  if (fs.existsSync(file)) {
    skipped.push(rel);
    return;
  }
  fs.writeFileSync(file, content, 'utf8');
  created.push(rel);
}

export async function initProject(rootInput: string, options: InitOptions = {}): Promise<InitResult> {
  const root = path.resolve(rootInput);
  const vibemapDir = path.join(root, MAPS_DIR);
  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  if (!fs.existsSync(vibemapDir)) {
    fs.mkdirSync(vibemapDir, { recursive: true });
    created.push('.vibemap/');
  }
  for (const dir of ['maps', 'layouts', 'notes', 'changes', 'boards', '.cache']) {
    const abs = path.join(vibemapDir, dir);
    if (!fs.existsSync(abs)) {
      ensureDir(abs);
      created.push(`.vibemap/${dir}/`);
    }
  }
  const detected = options.agents?.length ? options.agents : detectAgents(root);
  const configFile = path.join(vibemapDir, 'config.yaml');
  let config: ProjectConfig;
  if (fs.existsSync(configFile)) {
    config = loadConfig(root);
    const merged = new Set<AgentTarget>([...config.agents, ...detected]);
    let changed = false;
    if (merged.size !== config.agents.length) {
      config.agents = [...merged];
      changed = true;
    }
    if (options.mode && options.mode !== config.tracking.mode) {
      config.tracking.mode = options.mode;
      changed = true;
    }
    if (options.granularity && options.granularity !== config.tracking.granularity) {
      config.tracking.granularity = options.granularity;
      changed = true;
    }
    if (changed) {
      await writeFileAtomic(configFile, stringifyYaml(config));
      updated.push('.vibemap/config.yaml');
    } else {
      skipped.push('.vibemap/config.yaml');
    }
  } else {
    config = defaultConfig(projectName(root));
    config.agents = detected;
    if (options.mode) config.tracking.mode = options.mode;
    if (options.granularity) config.tracking.granularity = options.granularity;
    let template = DEFAULT_CONFIG_YAML.replace('{{name}}', projectName(root));
    template = template.replace('agents: []', `agents: [${detected.join(', ')}]`);
    template = template.replace('mode: every-change', `mode: ${config.tracking.mode}`);
    template = template.replace('granularity: feature', `granularity: ${config.tracking.granularity}`);
    fs.writeFileSync(configFile, template, 'utf8');
    created.push('.vibemap/config.yaml');
  }

  const themeFile = path.join(vibemapDir, 'theme.yaml');
  writeIfMissing(themeFile, DEFAULT_THEME_YAML, created, skipped, '.vibemap/theme.yaml');
  const phasesFile = path.join(vibemapDir, 'phases.yaml');
  writeIfMissing(phasesFile, `schema: ${SCHEMA_VERSION}\nphases: []\n`, created, skipped, '.vibemap/phases.yaml');
  const locksFile = path.join(vibemapDir, 'locks.json');
  writeIfMissing(locksFile, `{\n  "schema": ${SCHEMA_VERSION},\n  "locks": {}\n}\n`, created, skipped, '.vibemap/locks.json');
  const gitignoreFile = path.join(vibemapDir, '.gitignore');
  writeIfMissing(gitignoreFile, '.cache/\n', created, skipped, '.vibemap/.gitignore');

  const guideFile = path.join(vibemapDir, 'AGENT_GUIDE.md');
  const guide = agentGuide(config);
  const previousGuide = fs.existsSync(guideFile) ? fs.readFileSync(guideFile, 'utf8') : null;
  if (previousGuide !== guide) {
    await writeFileAtomic(guideFile, guide);
    (previousGuide === null ? created : updated).push('.vibemap/AGENT_GUIDE.md');
  } else {
    skipped.push('.vibemap/AGENT_GUIDE.md');
  }

  const agentResults: AgentWriteResult[] = writeAgentFiles(root, config, config.agents);
  for (const result of agentResults) {
    if (result.action === 'created') created.push(result.file);
    else if (result.action === 'updated') updated.push(result.file);
    else if (result.action === 'skipped') skipped.push(result.file);
  }
  if (config.agents.includes('claude-code') && options.hooks !== false) {
    const result = installClaudeHooks(root);
    if (result.action === 'created') created.push(result.file);
    else if (result.action === 'updated') updated.push(result.file);
    else if (result.action === 'skipped') skipped.push(result.file);
  }
  if (options.gitHooks) {
    for (const result of installGitHooks(root)) {
      const label = `${result.file}${result.note ? ` (${result.note})` : ''}`;
      if (result.action === 'created' || result.action === 'updated') updated.push(label);
      else skipped.push(label);
    }
  }

  let scan;
  if (options.scan !== false) {
    const project = loadProject(root);
    const result = scanProject(project, { full: true });
    scan = {
      files: result.stats.files,
      routes: result.stats.routes,
      models: result.stats.models,
      durationMs: result.stats.durationMs,
    };
  }
  return { root, created, updated, skipped, agents: config.agents, scan };
}

export async function syncAgents(root: string): Promise<{ guide: string; files: AgentWriteResult[] }> {
  const project = loadProject(root);
  const guideFile = path.join(project.vibemapDir, 'AGENT_GUIDE.md');
  await writeFileAtomic(guideFile, agentGuide(project.config));
  const files = writeAgentFiles(project.root, project.config, project.config.agents);
  if (project.config.agents.includes('claude-code')) files.push(installClaudeHooks(project.root));
  return { guide: '.vibemap/AGENT_GUIDE.md', files };
}

export async function addAgent(root: string, agent: AgentTarget): Promise<ProjectConfig> {
  const project = loadProject(root);
  if (!project.config.agents.includes(agent)) {
    project.config.agents.push(agent);
    await writeFileAtomic(project.configPath, stringifyYaml(project.config));
  }
  await syncAgents(root);
  return project.config;
}

export function initNextSteps(result: InitResult): string {
  const lines: string[] = [];
  lines.push(`VibeMap initialised in ${result.root}`);
  if (result.scan) {
    lines.push(`Scanned ${result.scan.files} files, ${result.scan.routes} routes, ${result.scan.models} models in ${result.scan.durationMs} ms.`);
  }
  if (result.created.length) lines.push(`Created: ${result.created.join(', ')}`);
  if (result.updated.length) lines.push(`Updated: ${result.updated.join(', ')}`);
  lines.push('');
  lines.push('Next:');
  lines.push('  1. Start the viewer:  vibemap view');
  lines.push('  2. Build maps:        vibemap bootstrap   (then paste the prompt into your agent)');
  return lines.join('\n');
}

export function projectFromRoot(root: string): Project {
  return loadProject(root);
}
