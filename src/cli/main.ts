import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Command, CommanderError } from 'commander';
import type { AgentTarget, ChangeEntry, PatchOp, ServerInfo } from '../core/types.js';
import { VERSION } from '../core/version.js';
import {
  loadProject,
  listMapIds,
  readPhases,
  readLayout,
  readLocks,
  type Project,
} from '../core/project.js';
import { loadMap, loadAllMaps } from '../core/maps.js';
import { validateProject, formatReport } from '../core/validate.js';
import { scanProject, ensureFacts } from '../core/scanner.js';
import { computeDrift, driftSummary, readPending } from '../core/drift.js';
import { computeCoverage, computeSuggestions } from '../core/suggest.js';
import { buildContext, contextTokenEstimate } from '../core/context.js';
import { jsonSchemaBundle, schemaMarkdown } from '../core/schema-export.js';
import { createMap } from '../core/create-map.js';
import { applyOpsToContent, diffPreview, OpsError, RevisionConflictError } from '../core/ops.js';
import { applyOpsToFile, readMapContent, pruneSidecar } from '../core/writer.js';
import { OpsFileSchema } from '../core/schema.js';
import { addChangeEntry, listChanges, latestUnsealedChange, sealChange, getSection } from '../core/changes.js';
import { computeChangeDelta, commitBaselines } from '../core/change-delta.js';
import { addPhase, finishPhase, phaseProgress, startPhase } from '../core/phases.js';
import { lockNode, unlockNode, parseLockKey } from '../core/locks.js';
import { inspectMap, formatInspect } from '../core/inspect.js';
import { renderFormat, type ExportFormat } from '../core/render.js';
import { resolveEvidence } from '../core/evidence.js';
import { loadFacts } from '../core/scanner.js';
import { prSummary } from '../core/pr-summary.js';
import { initProject, initNextSteps, syncAgents, addAgent, detectAgents } from '../core/init.js';
import { bootstrapProject, bootstrapInstructions } from '../core/bootstrap.js';
import { doctorProject, formatDoctor, doctorExitCode, migrateProject } from '../core/doctor.js';
import { ejectProject, ejectSummary } from '../core/eject.js';
import { staticExport } from '../core/static-export.js';
import { startServer } from '../server/server.js';
import { runMcpServer } from '../agent-kit/mcp.js';
import { recordPendingEdit } from '../core/drift.js';
import { findProjectRoot, mapFileFromId } from '../core/paths.js';
import { readJsonFile, writeFileAtomic } from '../core/yaml.js';
import {
  CliError,
  EXIT_ENV,
  EXIT_OK,
  EXIT_STRICT_WARNINGS,
  EXIT_USAGE,
  EXIT_VALIDATION,
  err,
  handleCliError,
  openBrowser,
  out,
  plural,
  printJson,
  projectRoot,
  ui,
} from './io.js';

const program = new Command();
program
  .name('vibemap')
  .description('Living visual project memory for AI-assisted codebases. Local-first, agent-agnostic.')
  .version(VERSION, '-v, --version')
  .option('--root <dir>', 'project root (defaults to the nearest folder containing .vibemap/)')
  .exitOverride();

function project(): Project {
  const root = projectRoot(program.opts().root as string | undefined);
  return loadProject(root);
}

function rootOrCwd(): string {
  return path.resolve((program.opts().root as string | undefined) ?? process.cwd());
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function gitHead(root: string): string | null {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function nonLoopback(host: string): boolean {
  return host !== '127.0.0.1' && host !== 'localhost' && host !== '::1';
}

async function existingServer(projectItem: Project): Promise<ServerInfo | null> {
  const file = path.join(projectItem.vibemapDir, '.cache', 'server.json');
  const info = readJsonFile<ServerInfo>(file);
  if (!info || info.root !== projectItem.root) return null;
  try {
    const response = await fetch(`${info.url}/api/health`, {
      headers: { 'x-vibemap-token': info.token },
      signal: AbortSignal.timeout(900),
    });
    return response.ok ? info : null;
  } catch {
    return null;
  }
}

async function runView(): Promise<void> {
  const projectItem = project();
  const options = viewCommand.opts();
  const host = (options.host as string | undefined) ?? projectItem.config.viewer.host;
  const port = options.port ? Number(options.port) : projectItem.config.viewer.port;
  const open = options.open !== false;
  if (nonLoopback(host)) {
    err(ui.yellow(`⚠ Binding to ${host} exposes the viewer to your network. No authentication beyond the per-session token is provided.`));
  }
  const existing = await existingServer(projectItem);
  if (existing) {
    out(ui.green(`✓ VibeMap is already running at ${existing.url}`));
    if (open) openBrowser(existing.url);
    return;
  }
  const server = await startServer({ root: projectItem.root, host, port, quiet: false });
  out('');
  out(`${ui.bold('VibeMap')} ${ui.dim(`v${VERSION}`)} is running at ${ui.cyan(server.url)}`);
  out(ui.dim(`Project: ${projectItem.config.project.name}  ·  ${listMapIds(projectItem).length} maps  ·  Ctrl+C to stop`));
  const check = validateProject(projectItem, { strict: false });
  const badge = check.errors.length ? ui.red(`${check.errors.length} errors`) : ui.green('check ok');
  out(ui.dim(`Status: ${badge}${check.warnings.length ? ui.yellow(`, ${check.warnings.length} warnings`) : ''}`));
  out('');
  if (open) openBrowser(server.url);
  await new Promise<void>((resolve) => {
    const shutdown = (): void => {
      void server.close().then(() => resolve());
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
  process.exitCode = EXIT_OK;
}

program.action(async () => {
  await runView();
});

program
  .command('init')
  .description('Create .vibemap/, agent guides and rules-file integrations')
  .option('--agents <list>', 'comma-separated agent targets (claude-code,cursor,codex,copilot,gemini,windsurf,aider,generic)')
  .option('--mode <mode>', 'tracking mode: every-change | per-phase | manual | off')
  .option('--granularity <level>', 'overview | feature | detail')
  .option('--git-hooks', 'install pre-commit/post-commit hooks')
  .option('--no-hooks', 'do not install Claude Code hooks')
  .option('--skip-scan', 'skip the initial scanner run')
  .option('--yes', 'accept defaults (non-interactive)')
  .action(async (options) => {
    const root = rootOrCwd();
    const validAgents: AgentTarget[] = ['claude-code', 'cursor', 'codex', 'copilot', 'gemini', 'windsurf', 'aider', 'generic'];
    let agents: AgentTarget[] | undefined;
    if (options.agents) {
      agents = String(options.agents)
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean) as AgentTarget[];
      const bad = agents.filter((a) => !validAgents.includes(a));
      if (bad.length) throw new CliError(`Unknown agent target(s): ${bad.join(', ')}`, EXIT_USAGE, `Choose from ${validAgents.join(', ')}.`);
    }
    const result = await initProject(root, {
      agents,
      mode: options.mode as 'every-change' | 'per-phase' | 'manual' | 'off' | undefined,
      granularity: options.granularity as 'overview' | 'feature' | 'detail' | undefined,
      gitHooks: !!options.gitHooks,
      hooks: options.hooks !== false,
      yes: !!options.yes,
      scan: !options.skipScan,
    });
    out(initNextSteps(result));
  });

const viewCommand = program
  .command('view')
  .description('Start the local viewer and live server')
  .option('--port <port>', 'port (default 4317, auto-increments if busy)')
  .option('--host <host>', 'bind host (loopback by default)')
  .option('--no-open', 'do not open a browser')
  .action(async () => {
    await runView();
  });

program
  .command('check [maps...]')
  .description('Validate maps, notes, changes, phases, layouts and evidence')
  .option('--strict', 'treat warnings as failures (exit 4)')
  .option('--json', 'machine-readable report')
  .option('--fix', 'apply safe fixes (prune stale layout entries)')
  .action(async (maps: string[], options) => {
    const projectItem = project();
    if (options.fix) {
      let fixed = 0;
      for (const id of listMapIds(projectItem)) {
        try {
          const loaded = loadMap(projectItem, id);
          if (await pruneSidecar(projectItem, id, loaded.map)) fixed++;
        } catch {
          // Invalid maps cannot be fixed automatically.
        }
      }
      out(ui.dim(`Safe fixes: pruned layout entries for ${plural(fixed, 'map')}.`));
    }
    let report = validateProject(projectItem, { strict: !!options.strict });
    if (maps?.length) {
      const wanted = new Set(maps);
      report = {
        ...report,
        errors: report.errors.filter((e) => [...wanted].some((m) => e.file === `.vibemap/maps/${m}.vmap.yaml`)),
        warnings: report.warnings.filter((w) => [...wanted].some((m) => w.file === `.vibemap/maps/${m}.vmap.yaml`)),
      };
    }
    if (options.json) printJson(report);
    else {
      out(formatReport(report));
      out(ui.dim(`maps: ${report.stats.maps} · nodes: ${report.stats.nodes} · verified: ${report.stats.verified} · declared: ${report.stats.declared} · stale: ${report.stats.stale}${report.stats.coverage !== undefined ? ` · coverage: ${report.stats.coverage}%` : ''}`));
    }
    if (report.errors.length) process.exitCode = EXIT_VALIDATION;
    else if (options.strict && report.warnings.length) process.exitCode = EXIT_STRICT_WARNINGS;
    else process.exitCode = EXIT_OK;
  });

program
  .command('scan')
  .description('Rebuild .vibemap/.cache/facts.json (incremental by default)')
  .option('--full', 're-parse every file')
  .option('--json', 'machine-readable stats')
  .action((options) => {
    const projectItem = project();
    const result = scanProject(projectItem, { full: !!options.full });
    if (options.json) printJson(result.stats);
    else {
      out(ui.green(`✓ Scanned ${plural(result.stats.files, 'file')} in ${result.stats.durationMs} ms`));
      out(ui.dim(`parsed: ${result.stats.parsed} · cached: ${result.stats.reused} · routes: ${result.stats.routes} · models: ${result.stats.models}`));
    }
  });

program
  .command('drift')
  .description('Find maps whose referenced code changed, and unmapped changes')
  .option('--since <ref>', 'compare against a git ref')
  .option('--staged', 'only staged changes')
  .option('--json', 'machine-readable report')
  .action((options) => {
    const projectItem = project();
    const report = computeDrift(projectItem, { since: options.since, staged: !!options.staged });
    if (options.json) {
      printJson(report);
    } else {
      out(report.ok ? ui.green(`✓ ${driftSummary(report)}`) : ui.yellow(`⚠ ${driftSummary(report)}`));
      for (const item of report.direct) out(`  ${ui.bold(item.map)}: ${item.files.join(', ')}`);
      if (report.removedRefs.length) {
        out(ui.red('  Broken refs:'));
        for (const ref of report.removedRefs) out(`    ${ref.map}#${ref.node} → ${ref.path}`);
      }
      if (report.unmapped.length) {
        out(ui.dim('  Unmapped changed files:'));
        for (const file of report.unmapped.slice(0, 20)) out(`    ${file}`);
      }
    }
    if (!report.ok) process.exitCode = EXIT_VALIDATION;
  });

program
  .command('suggest')
  .description('Prioritised gaps to map (routes, models, env vars, unverified nodes)')
  .option('--limit <n>', 'maximum suggestions', '20')
  .option('--json', 'machine-readable list')
  .action((options) => {
    const projectItem = project();
    const suggestions = computeSuggestions(projectItem, Number(options.limit) || 20);
    if (options.json) printJson({ suggestions });
    else {
      if (!suggestions.length) out(ui.green('✓ No gaps found.'));
      for (const suggestion of suggestions) {
        out(`${ui.cyan(`[${suggestion.priority}]`)} ${ui.bold(suggestion.title)}${suggestion.file ? ui.dim(`  ${suggestion.file}${suggestion.line ? `:${suggestion.line}` : ''}`) : ''}`);
        out(ui.dim(`    ${suggestion.prompt}`));
      }
    }
  });

program
  .command('context')
  .description('Compact map digest for an agent (IDs, refs, edges, locks, drift)')
  .option('--area <path-or-feature>', 'focus on an area')
  .option('--map <id>', 'only one map')
  .option('--budget <tokens>', 'approximate token budget', '1500')
  .option('--json', 'include token estimate as JSON')
  .action((options) => {
    const projectItem = project();
    const text = buildContext(projectItem, {
      area: options.area,
      mapId: options.map,
      budget: Number(options.budget) || 1500,
    });
    if (options.json) printJson({ context: text, tokens: contextTokenEstimate(text) });
    else out(text);
  });

program
  .command('schema')
  .description('Print the file-format guide or JSON Schema')
  .option('--format <format>', 'md | json', 'md')
  .action((options) => {
    if (options.format === 'json') printJson(jsonSchemaBundle());
    else out(schemaMarkdown());
  });

const mapCommand = program.command('map').description('Map authoring helpers');
mapCommand
  .command('new <id>')
  .description('Create a valid map skeleton')
  .option('--type <type>', 'graph | sequence | erd | mermaid', 'graph')
  .option('--title <title>', 'map title')
  .option('--level <level>', 'overview | feature | detail')
  .option('--direction <dir>', 'right | down | left | up')
  .option('--force', 'overwrite an existing map (dangerous)')
  .action(async (id: string, options) => {
    const projectItem = project();
    const result = await createMap(projectItem, id, {
      type: options.type,
      title: options.title,
      level: options.level,
      direction: options.direction,
      force: !!options.force,
    });
    out(ui.green(`✓ Created ${result.file}`));
    out(ui.dim(`Next: vibemap patch ${id} --file ops.json  ·  vibemap check`));
  });

program
  .command('patch <map>')
  .description('Apply atomic patch ops from a JSON file or stdin')
  .option('--file <file>', 'ops JSON file ("-" for stdin)')
  .option('--dry-run', 'validate and print the diff without writing')
  .option('--base-rev <rev>', 'optimistic concurrency revision')
  .option('--json', 'machine-readable result')
  .action(async (mapId: string, options) => {
    const projectItem = project();
    let raw: string;
    if (options.file && options.file !== '-') {
      raw = fs.readFileSync(path.resolve(options.file), 'utf8');
    } else if (!process.stdin.isTTY) {
      raw = await readStdin();
    } else {
      throw new CliError('No ops provided.', EXIT_USAGE, 'Use --file ops.json or pipe JSON on stdin.');
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new CliError('Ops input is not valid JSON.', EXIT_USAGE);
    }
    const parsed = OpsFileSchema.safeParse(Array.isArray(json) ? { ops: json } : json);
    if (!parsed.success) {
      throw new CliError('Invalid ops.', EXIT_VALIDATION, parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
    }
    const ops = parsed.data.ops as PatchOp[];
    if (options.dryRun) {
      const current = readMapContent(projectItem, mapId);
      const before = loadMap(projectItem, mapId);
      const preview = applyOpsToContent(current.content, mapFileFromId(mapId), mapId, ops, {
        origin: 'agent',
        locks: readLocks(projectItem),
        enforceLocks: true,
        newNodeStatus: projectItem.config.editing.newNodeStatus,
      });
      const diff = diffPreview(before.map, preview.map);
      if (options.json) printJson({ dryRun: true, summary: preview.journalSummary, diff });
      else {
        out(ui.yellow('Dry run — no files written.'));
        out(preview.journalSummary);
        if (diff.length) out(diff.join('\n'));
      }
      return;
    }
    const result = await applyOpsToFile(projectItem, mapId, ops, {
      origin: 'agent',
      baseRev: options.baseRev,
      newNodeStatus: projectItem.config.editing.newNodeStatus,
    });
    if (options.json) {
      printJson({ map: mapId, rev: result.rev, summary: result.journalSummary, changedNodeIds: result.changedNodeIds });
    } else {
      out(ui.green(`✓ ${mapId}: ${result.journalSummary}`));
      out(ui.dim(`rev ${result.rev.slice(0, 10)}  ·  changed nodes: ${result.changedNodeIds.join(', ') || 'none'}`));
    }
  });

const changeCommand = program.command('change').description('Change log entries');
changeCommand
  .command('add')
  .description('Record a change entry with an auto-computed delta')
  .requiredOption('--title <title>', 'short title')
  .requiredOption('--why <why>', 'reason for the change')
  .requiredOption('--maps <ids>', 'comma-separated map ids')
  .option('--how <text>', 'how it works')
  .option('--watch-out <text>', 'limits / follow-ups')
  .option('--type <type>', 'feature | fix | refactor | plan | docs', 'feature')
  .option('--phase <id>', 'phase id')
  .option('--author <author>', 'author string (default human:<user>)')
  .option('--json', 'machine-readable result')
  .action(async (options) => {
    const projectItem = project();
    const maps = String(options.maps).split(',').map((m) => m.trim()).filter(Boolean);
    for (const id of maps) {
      if (!listMapIds(projectItem).includes(id)) throw new CliError(`Unknown map "${id}".`, EXIT_VALIDATION);
    }
    if (options.phase && !readPhases(projectItem).phases.some((p) => p.id === options.phase)) {
      throw new CliError(`Unknown phase "${options.phase}".`, EXIT_VALIDATION);
    }
    const delta = await computeChangeDelta(projectItem, maps);
    const entry = await addChangeEntry(projectItem, {
      title: options.title,
      why: options.why,
      maps,
      type: options.type,
      how: options.how,
      watchOut: options.watchOut,
      phase: options.phase,
      author: options.author,
      delta,
    });
    await commitBaselines(projectItem, maps);
    if (options.json) printJson({ entry, delta });
    else {
      out(ui.green(`✓ ${entry.id}`));
      out(ui.dim(`delta: +${delta.added_nodes.length} nodes · ~${delta.modified_nodes.length} · −${delta.removed_nodes.length} · +${delta.added_edges}/−${delta.removed_edges} edges`));
    }
  });

changeCommand
  .command('list')
  .description('List change entries (newest first)')
  .option('--json', 'machine-readable list')
  .action((options) => {
    const entries = listChanges(project());
    if (options.json) printJson({ changes: entries });
    else {
      if (!entries.length) out(ui.dim('No change entries yet.'));
      for (const change of entries) {
        const delta = change.delta;
        out(`${ui.bold(change.id)}  ${change.title} ${ui.dim(`(${change.type}${change.phase ? `, ${change.phase}` : ''}${change.commit ? `, ${change.commit}` : ''})`)}`);
        out(ui.dim(`  +${delta.added_nodes.length} ~${delta.modified_nodes.length} −${delta.removed_nodes.length} nodes · maps: ${change.maps.join(', ')}`));
      }
    }
  });

changeCommand
  .command('show <id>')
  .description('Show one change entry')
  .option('--json', 'machine-readable')
  .action((id: string, options) => {
    const change = listChanges(project()).find((c) => c.id === id);
    if (!change) throw new CliError(`Change "${id}" not found.`, EXIT_VALIDATION);
    if (options.json) printJson(change);
    else {
      out(`${ui.bold(change.title)}  ${ui.dim(change.id)}`);
      out(ui.dim(`${change.date} · ${change.type} · ${change.author} · maps: ${change.maps.join(', ')}${change.commit ? ` · commit ${change.commit}` : ''}`));
      out('');
      out(change.body);
      out('');
      out(ui.dim(`Why: ${getSection(change.body, 'Why')}`));
    }
  });

changeCommand
  .command('seal [id]')
  .description('Attach the current git commit SHA to a change entry')
  .option('--latest', 'seal the newest unsealed change (default)')
  .option('--json', 'machine-readable result')
  .action(async (id: string | undefined, options) => {
    const projectItem = project();
    const sha = gitHead(projectItem.root);
    if (!sha) throw new CliError('No git commit found.', EXIT_ENV, 'Change sealing needs a git repository with at least one commit.');
    const change = id ? listChanges(projectItem).find((c) => c.id === id) : latestUnsealedChange(projectItem);
    if (!change) {
      if (id) throw new CliError(`Change "${id}" not found.`, EXIT_VALIDATION);
      out(ui.dim('No unsealed change entry.'));
      return;
    }
    await sealChange(projectItem, change, sha);
    if (options.json) printJson({ id: change.id, commit: sha });
    else out(ui.green(`✓ Sealed ${change.id} with ${sha}`));
  });

const phaseCommand = program.command('phase').description('Roadmap phases');
phaseCommand
  .command('add <title>')
  .description('Add a planned phase')
  .option('--goal <goal>', 'phase goal')
  .action(async (title: string, options) => {
    const phase = await addPhase(project(), title, options.goal);
    out(ui.green(`✓ Phase ${phase.id} added: ${phase.title}`));
  });
phaseCommand
  .command('start <id>')
  .description('Mark a phase active')
  .action(async (id: string) => {
    const phase = await startPhase(project(), id);
    out(ui.green(`✓ Phase ${phase.id} is active`));
  });
phaseCommand
  .command('done <id>')
  .description('Finish a phase and record a snapshot (git SHA or journal id)')
  .action(async (id: string) => {
    const phase = await finishPhase(project(), id);
    out(ui.green(`✓ Phase ${phase.id} done${phase.snapshot ? ` at ${phase.snapshot}` : ''}`));
  });
phaseCommand
  .command('list')
  .description('List phases with progress')
  .option('--json', 'machine-readable')
  .action((options) => {
    const phases = phaseProgress(project());
    if (options.json) printJson({ phases });
    else {
      if (!phases.length) out(ui.dim('No phases yet.'));
      for (const phase of phases) {
        out(`${ui.bold(phase.id)}  ${phase.title}  ${ui.dim(`[${phase.status}]`)}${phase.snapshot ? ui.dim(` snapshot ${phase.snapshot}`) : ''}`);
        if (phase.goal) out(ui.dim(`  ${phase.goal}`));
        out(ui.dim(`  built ${phase.built}/${phase.total} · planned ${phase.planned}`));
      }
    }
  });

program
  .command('lock <target>')
  .description('Lock a node (map#node) against agent edits')
  .action((target: string) => {
    const projectItem = project();
    const parsed = parseLockKey(target);
    if (!parsed) throw new CliError('Use map#node.', EXIT_USAGE);
    const loaded = loadMap(projectItem, parsed.map);
    if (loaded.map.type !== 'graph') throw new CliError('Locks apply to graph nodes.', EXIT_VALIDATION);
    const node = loaded.map.nodes.find((n) => n.id === parsed.node);
    if (!node) throw new CliError(`Node "${parsed.node}" not found in ${parsed.map}.`, EXIT_VALIDATION);
    lockNode(projectItem, parsed.map, node);
    out(ui.green(`✓ Locked ${parsed.map}#${parsed.node}`));
  });

program
  .command('unlock <target>')
  .description('Remove a human lock (map#node)')
  .action((target: string) => {
    const projectItem = project();
    const parsed = parseLockKey(target);
    if (!parsed) throw new CliError('Use map#node.', EXIT_USAGE);
    unlockNode(projectItem, parsed.map, parsed.node);
    out(ui.green(`✓ Unlocked ${parsed.map}#${parsed.node}`));
  });

program
  .command('inspect <map>')
  .description('Text geometry report for an agent or human')
  .option('--json', 'include the full layout')
  .action((mapId: string, options) => {
    const report = inspectMap(project(), mapId);
    if (options.json) printJson(report);
    else out(formatInspect(report));
  });

program
  .command('render <map>')
  .description('Export a map to svg, mermaid, md or excalidraw')
  .option('--format <format>', 'svg | png | excalidraw | mermaid | md')
  .option('-o, --out <file>', 'output file (default stdout)')
  .action((mapId: string, options) => {
    const projectItem = project();
    const loaded = loadMap(projectItem, mapId);
    let format = options.format as ExportFormat | undefined;
    if (!format && options.out) {
      const ext = path.extname(options.out).slice(1).toLowerCase();
      if (['svg', 'png', 'mermaid', 'md', 'excalidraw'].includes(ext)) format = (ext === 'mmd' ? 'mermaid' : ext) as ExportFormat;
    }
    if (!format) format = 'svg';
    const sidecar = (() => {
      try {
        return readLayout(projectItem, mapId);
      } catch {
        return null;
      }
    })();
    const content = renderFormat(loaded.map, projectItem.theme, format, resolveEvidence(projectItem, loaded.map, loadFacts(projectItem)), sidecar, mapId);
    if (options.out) {
      fs.mkdirSync(path.dirname(path.resolve(options.out)), { recursive: true });
      fs.writeFileSync(path.resolve(options.out), content, 'utf8');
      out(ui.green(`✓ Wrote ${options.out}`));
    } else {
      process.stdout.write(content.endsWith('\n') ? content : `${content}\n`);
    }
  });

program
  .command('pr-summary')
  .description('Markdown before/after summary for a pull request')
  .option('--base <ref>', 'base branch/ref', 'main')
  .action((options) => {
    out(prSummary(project().root, { base: options.base }));
  });

program
  .command('export')
  .description('Export a self-contained read-only static site')
  .requiredOption('--static <dir>', 'output directory')
  .action((options) => {
    const projectItem = project();
    const result = staticExport(projectItem, options.static);
    out(ui.green(`✓ Static site written to ${result.outDir} (${plural(result.maps, 'map')})`));
    out(ui.dim(`Open ${path.join(result.outDir, 'index.html')}`));
  });

const agentsCommand = program.command('agents').description('Manage rules files for coding agents');
agentsCommand
  .command('list')
  .description('Show configured and detected agents')
  .option('--json', 'machine-readable')
  .action((options) => {
    const projectItem = project();
    const detected = detectAgents(projectItem.root);
    const payload = {
      configured: projectItem.config.agents,
      detected,
      guide: fs.existsSync(path.join(projectItem.vibemapDir, 'AGENT_GUIDE.md')),
    };
    if (options.json) printJson(payload);
    else {
      out(`Configured: ${payload.configured.join(', ') || '(none)'}`);
      out(`Detected:   ${detected.join(', ') || '(none)'}`);
      out(ui.dim(`Guide: ${payload.guide ? '.vibemap/AGENT_GUIDE.md' : 'missing'}`));
    }
  });
agentsCommand
  .command('add <agent>')
  .description('Write rules for another agent')
  .action(async (agent: AgentTarget) => {
    const valid: AgentTarget[] = ['claude-code', 'cursor', 'codex', 'copilot', 'gemini', 'windsurf', 'aider', 'generic'];
    if (!valid.includes(agent)) throw new CliError(`Unknown agent "${agent}".`, EXIT_USAGE);
    await addAgent(project().root, agent);
    out(ui.green(`✓ Agent ${agent} configured`));
  });
agentsCommand
  .command('sync')
  .description('Regenerate AGENT_GUIDE.md and all configured rules files')
  .action(async () => {
    const result = await syncAgents(project().root);
    out(ui.green(`✓ Synced ${result.guide}`));
    for (const file of result.files) out(ui.dim(`  ${file.file}: ${file.action}${file.note ? ` (${file.note})` : ''}`));
  });

program
  .command('bootstrap')
  .description('Generate a ready-to-paste prompt that makes an agent map an existing repo')
  .option('--out <file>', 'output path', '.vibemap/BOOTSTRAP_PROMPT.md')
  .option('--stdout', 'print the prompt instead of a summary')
  .action(async (options) => {
    const projectItem = project();
    const result = await bootstrapProject(projectItem, options.out);
    if (options.stdout) out(result.prompt);
    else {
      out(ui.green(`✓ Bootstrap prompt written to ${options.out}`));
      out(ui.dim(`${result.summary.files} files · ${result.summary.routes} routes · ${result.summary.models} models · ${result.summary.deps} deps`));
      out('');
      out(bootstrapInstructions(projectItem));
    }
  });

program
  .command('doctor')
  .description('Environment and configuration diagnostics')
  .option('--json', 'machine-readable results')
  .action((options) => {
    const checks = doctorProject(rootOrCwd());
    if (options.json) printJson({ checks });
    else out(formatDoctor(checks));
    const code = doctorExitCode(checks);
    if (code) process.exitCode = code;
  });

program
  .command('migrate')
  .description('Upgrade file schemas (currently schema 1)')
  .option('--dry-run', 'show what would change')
  .action((options) => {
    const result = migrateProject(project().root, !!options.dryRun);
    if (result.changed.length) {
      out(ui.green(`✓ ${options.dryRun ? 'Would migrate' : 'Migrated'} ${plural(result.changed.length, 'file')}`));
      for (const file of result.changed) out(ui.dim(`  ${file}`));
    } else out(ui.green('✓ Everything is at schema 1.'));
    if (result.skipped.length) out(ui.dim(`skipped ${result.skipped.length} file(s)`));
  });

program
  .command('eject')
  .description('Remove agent rules and hooks (leaves .vibemap/ data)')
  .option('--purge', 'also delete .vibemap/ (destructive)')
  .action((options) => {
    const projectItem = project();
    const result = ejectProject(projectItem.root, !!options.purge);
    out(ejectSummary(result, projectItem.root));
  });

program
  .command('mcp')
  .description('Run the MCP stdio server')
  .action(async () => {
    await runMcpServer(rootOrCwd());
  });

program
  .command('hook <event>')
  .description('Internal hook entry: post-edit | stop | pre-commit | post-commit')
  .action(async (event: string) => {
    const root = findProjectRoot(process.cwd()) ?? rootOrCwd();
    let payload: Record<string, unknown> = {};
    if (!process.stdin.isTTY) {
      const raw = await readStdin();
      if (raw.trim()) {
        try {
          payload = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          payload = {};
        }
      }
    }
    if (event === 'post-edit') {
      const toolInput = (payload.tool_input ?? {}) as Record<string, unknown>;
      const candidate =
        (toolInput.file_path as string | undefined) ??
        (toolInput.path as string | undefined) ??
        (payload.file_path as string | undefined);
      if (!candidate || !fs.existsSync(path.join(root, '.vibemap'))) return;
      const abs = path.resolve(candidate);
      const rel = path.relative(root, abs).replace(/\\/g, '/');
      if (rel.startsWith('..') || rel.startsWith('.vibemap/')) return;
      const projectItem = loadProject(root);
      recordPendingEdit(projectItem, [rel]);
      process.exitCode = EXIT_OK;
      return;
    }
    if (!fs.existsSync(path.join(root, '.vibemap'))) {
      if (event === 'stop') return;
      throw new CliError('No .vibemap/ found.', EXIT_ENV);
    }
    const projectItem = loadProject(root);
    if (event === 'stop') {
      if (payload.stop_hook_active === true) return;
      if (projectItem.config.tracking.mode === 'off') return;
      const pending = readPending(projectItem);
      const drift = computeDrift(projectItem, pending?.files.length ? { files: pending.files } : {});
      const report = validateProject(projectItem, { strict: false });
      const maps = listMapIds(projectItem);
      const reasons: string[] = [];
      if (report.errors.length) {
        reasons.push(...report.errors.slice(0, 3).map((e) => `${e.code} ${e.file}${e.line ? `:${e.line}` : ''} — ${e.message}`));
      }
      if (projectItem.config.tracking.mode === 'every-change' && maps.length) {
        if (drift.direct.length) reasons.push(...drift.direct.map((d) => `map "${d.map}" references changed files: ${d.files.slice(0, 4).join(', ')}`));
        if (drift.unmapped.length) reasons.push(`${plural(drift.unmapped.length, 'unmapped changed file')}: ${drift.unmapped.slice(0, 4).join(', ')}`);
        if (drift.removedRefs.length) reasons.push(`${plural(drift.removedRefs.length, 'broken ref')} — run vibemap check`);
      }
      if (reasons.length) {
        throw new CliError(
          `VibeMap is not up to date yet:\n  - ${reasons.join('\n  - ')}\n\nBefore finishing: run \`vibemap check\`, update the affected maps with \`vibemap patch\`, and add \`vibemap change add\`. Then stop again.`,
          2,
        );
      }
      return;
    }
    if (event === 'pre-commit') {
      const report = validateProject(projectItem, { strict: projectItem.config.validation.strict });
      if (report.errors.length) {
        err(formatReport(report));
        throw new CliError('VibeMap check failed. Fix the errors above, or commit with VIBEMAP_SKIP_HOOKS=1.', EXIT_VALIDATION);
      }
      const drift = computeDrift(projectItem);
      if (drift.direct.length || drift.removedRefs.length) err(ui.yellow(`⚠ VibeMap drift: ${driftSummary(drift)}`));
      return;
    }
    if (event === 'post-commit') {
      const sha = gitHead(projectItem.root);
      if (!sha) return;
      const change = latestUnsealedChange(projectItem);
      if (!change) return;
      await sealChange(projectItem, change, sha);
      return;
    }
    throw new CliError(`Unknown hook event "${event}".`, EXIT_USAGE);
  });

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === 'commander.helpDisplayed' || error.code === 'commander.version') {
        process.exitCode = EXIT_OK;
        return;
      }
      if (error.code === 'commander.missingMandatoryOptionValue' || error.code === 'commander.unknownCommand' || error.code === 'commander.unknownOption' || error.code === 'commander.missingArgument') {
        process.exitCode = EXIT_USAGE;
        return;
      }
      process.exitCode = EXIT_USAGE;
      return;
    }
    process.exitCode = handleCliError(error);
  }
}

void main();
