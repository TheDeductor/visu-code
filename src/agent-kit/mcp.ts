import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import type { PatchOp } from '../core/types.js';
import { loadProject } from '../core/project.js';
import { loadAllMaps } from '../core/maps.js';
import { buildContext } from '../core/context.js';
import { applyOpsToFile } from '../core/writer.js';
import { applyOpsToContent, OpsError } from '../core/ops.js';
import { validateProject } from '../core/validate.js';
import { computeSuggestions } from '../core/suggest.js';
import { computeChangeDelta, commitBaselines } from '../core/change-delta.js';
import { addChangeEntry } from '../core/changes.js';
import { inspectMap } from '../core/inspect.js';
import { schemaMarkdown, jsonSchemaBundle } from '../core/schema-export.js';
import { mapFileFromId } from '../core/paths.js';
import { OpsFileSchema } from '../core/schema.js';
import { readLayout } from '../core/project.js';
import { VERSION } from '../core/version.js';

const PROTOCOL_VERSION = '2024-11-05';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

function send(message: unknown): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function result(id: JsonRpcRequest['id'], value: unknown): void {
  send({ jsonrpc: '2.0', id, result: value });
}

function error(id: JsonRpcRequest['id'], code: number, message: string): void {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function textResult(text: string): unknown {
  return { content: [{ type: 'text', text }] };
}

const TOOLS = [
  {
    name: 'vibemap_context',
    description: 'Compact digest of the project maps, node refs, locks and pending drift. Use before editing an area.',
    inputSchema: {
      type: 'object',
      properties: {
        area: { type: 'string', description: 'Path or feature to focus on.' },
        map: { type: 'string', description: 'Only this map id.' },
        budget: { type: 'number', description: 'Approximate token budget (default 1500).' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'vibemap_get_map',
    description: 'Read the raw YAML for one map.',
    inputSchema: { type: 'object', properties: { map: { type: 'string' } }, required: ['map'], additionalProperties: false },
  },
  {
    name: 'vibemap_patch',
    description: 'Apply atomic patch operations to a map. Locks are enforced. Set dry_run to preview.',
    inputSchema: {
      type: 'object',
      properties: {
        map: { type: 'string' },
        ops: { type: 'array', items: { type: 'object' } },
        dry_run: { type: 'boolean' },
      },
      required: ['map', 'ops'],
      additionalProperties: false,
    },
  },
  {
    name: 'vibemap_check',
    description: 'Validate maps, notes, changes, phases and layout. Returns errors and warnings with codes and lines.',
    inputSchema: { type: 'object', properties: { strict: { type: 'boolean' } }, additionalProperties: false },
  },
  {
    name: 'vibemap_suggest',
    description: 'Prioritised gaps: unmapped routes/models/env vars, unverified nodes.',
    inputSchema: { type: 'object', properties: { limit: { type: 'number' } }, additionalProperties: false },
  },
  {
    name: 'vibemap_change_add',
    description: 'Record a change entry after updating maps. The delta is computed automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        why: { type: 'string' },
        maps: { type: 'array', items: { type: 'string' } },
        type: { type: 'string', enum: ['feature', 'fix', 'refactor', 'plan', 'docs'] },
        how: { type: 'string' },
        watch_out: { type: 'string' },
        phase: { type: 'string' },
      },
      required: ['title', 'why', 'maps'],
      additionalProperties: false,
    },
  },
  {
    name: 'vibemap_inspect',
    description: 'Text geometry report for a map: boxes, overlaps, crossings and label fit.',
    inputSchema: { type: 'object', properties: { map: { type: 'string' } }, required: ['map'], additionalProperties: false },
  },
  {
    name: 'vibemap_schema',
    description: 'Print the map file syntax guide or JSON Schema.',
    inputSchema: {
      type: 'object',
      properties: { format: { type: 'string', enum: ['md', 'json'] } },
      additionalProperties: false,
    },
  },
];

export async function runMcpServer(rootInput?: string): Promise<void> {
  const root = path.resolve(rootInput ?? process.cwd());
  const handle = async (request: JsonRpcRequest): Promise<void> => {
    const { id, method, params } = request;
    if (method === 'initialize') {
      const requested = typeof params?.protocolVersion === 'string' ? params.protocolVersion : PROTOCOL_VERSION;
      result(id, {
        protocolVersion: requested,
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: 'vibemap', version: VERSION },
      });
      return;
    }
    if (method === 'notifications/initialized' || method === 'notifications/cancelled') return;
    if (method === 'ping') {
      result(id, {});
      return;
    }
    if (method === 'tools/list') {
      result(id, { tools: TOOLS });
      return;
    }
    if (method === 'resources/list') {
      const project = loadProject(root);
      const { maps } = loadAllMaps(project);
      result(id, {
        resources: maps.map((m) => ({ uri: `vibemap://maps/${m.id}`, name: m.id, title: m.map.title, mimeType: 'text/yaml' })),
      });
      return;
    }
    if (method === 'resources/read') {
      const uri = typeof params?.uri === 'string' ? params.uri : '';
      const mapId = uri.replace(/^vibemap:\/\/maps\//, '');
      if (!mapId || mapId === uri) throw new Error('Resource must be vibemap://maps/<id>.');
      const project = loadProject(root);
      const content = fs.readFileSync(path.join(project.root, mapFileFromId(mapId)), 'utf8');
      result(id, { contents: [{ uri, mimeType: 'text/yaml', text: content }] });
      return;
    }
    if (method === 'tools/call') {
      const name = typeof params?.name === 'string' ? params.name : '';
      const args = (params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const project = loadProject(root);
        if (name === 'vibemap_context') {
          result(id, textResult(buildContext(project, {
            area: typeof args.area === 'string' ? args.area : undefined,
            mapId: typeof args.map === 'string' ? args.map : undefined,
            budget: typeof args.budget === 'number' ? args.budget : undefined,
          })));
          return;
        }
        if (name === 'vibemap_get_map') {
          if (typeof args.map !== 'string') throw new Error('map is required');
          const content = fs.readFileSync(path.join(project.root, mapFileFromId(args.map)), 'utf8');
          result(id, textResult(content));
          return;
        }
        if (name === 'vibemap_patch') {
          if (typeof args.map !== 'string' || !Array.isArray(args.ops)) throw new Error('map and ops are required');
          const parsed = OpsFileSchema.safeParse({ ops: args.ops });
          if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join('; '));
          const ops = parsed.data.ops as PatchOp[];
          if (args.dry_run === true) {
            const content = fs.readFileSync(path.join(project.root, mapFileFromId(args.map)), 'utf8');
            const preview = applyOpsToContent(content, mapFileFromId(args.map), args.map, ops, {
              origin: 'agent',
              locks: (await import('../core/project.js')).readLocks(project),
              enforceLocks: true,
            });
            result(id, textResult(`Dry run: ${preview.journalSummary}\nChanged nodes: ${preview.changedNodeIds.join(', ') || 'none'}\nChanged edges: ${preview.changedEdgeIds.join(', ') || 'none'}`));
            return;
          }
          const applied = await applyOpsToFile(project, args.map, ops, { origin: 'agent' });
          result(id, textResult(`Applied: ${applied.journalSummary}\nRev: ${applied.rev}\nChanged nodes: ${applied.changedNodeIds.join(', ') || 'none'}`));
          return;
        }
        if (name === 'vibemap_check') {
          const report = validateProject(project, { strict: args.strict === true });
          result(id, textResult(JSON.stringify(report, null, 2)));
          return;
        }
        if (name === 'vibemap_suggest') {
          const suggestions = computeSuggestions(project, typeof args.limit === 'number' ? args.limit : 20);
          result(id, textResult(JSON.stringify({ suggestions }, null, 2)));
          return;
        }
        if (name === 'vibemap_change_add') {
          const maps = Array.isArray(args.maps) ? args.maps.filter((m): m is string => typeof m === 'string') : [];
          if (!maps.length) throw new Error('maps[] is required');
          const computed = await computeChangeDelta(project, maps);
          const delta = computed.delta;
          const entry = await addChangeEntry(project, {
            title: String(args.title ?? ''),
            why: String(args.why ?? ''),
            maps,
            type: (args.type as 'feature' | 'fix' | 'refactor' | 'plan' | 'docs') ?? 'feature',
            how: typeof args.how === 'string' ? args.how : undefined,
            watchOut: typeof args.watch_out === 'string' ? args.watch_out : undefined,
            phase: typeof args.phase === 'string' ? args.phase : undefined,
            author: 'agent:mcp',
            delta,
            bases: computed.bases,
          });
          await commitBaselines(project, maps);
          result(id, textResult(JSON.stringify({ id: entry.id, file: entry.file, delta }, null, 2)));
          return;
        }
        if (name === 'vibemap_inspect') {
          if (typeof args.map !== 'string') throw new Error('map is required');
          const report = inspectMap(project, args.map);
          result(id, textResult(JSON.stringify({ ...report, layout: undefined }, null, 2)));
          return;
        }
        if (name === 'vibemap_schema') {
          result(id, textResult(args.format === 'json' ? JSON.stringify(jsonSchemaBundle(), null, 2) : schemaMarkdown()));
          return;
        }
        throw new Error(`Unknown tool "${name}"`);
      } catch (err) {
        const message = err instanceof OpsError ? `${err.message}\n${err.issues.join('\n')}` : (err as Error).message;
        result(id, { content: [{ type: 'text', text: `Error: ${message}` }], isError: true });
      }
      return;
    }
    error(id, -32601, `Method not found: ${method}`);
  };

  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity, terminal: false });
  const queue: Promise<void>[] = [];
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(trimmed) as JsonRpcRequest;
    } catch {
      error(null, -32700, 'Parse error');
      return;
    }
    queue.push(handle(request).catch((err) => error(request.id ?? null, -32603, (err as Error).message)));
  });
  await new Promise<void>((resolve) => {
    rl.on('close', () => resolve());
    process.on('SIGINT', () => resolve());
    process.on('SIGTERM', () => resolve());
  });
  await Promise.all(queue);
}
