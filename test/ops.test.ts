import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { Project } from '../src/core/project.js';
import { loadProject, readLocks } from '../src/core/project.js';
import { loadMap } from '../src/core/maps.js';
import { applyOpsToFile, pruneSidecar, readMapContent } from '../src/core/writer.js';
import { RevisionConflictError } from '../src/core/ops.js';
import { listJournal } from '../src/core/journal.js';
import { computeChangeDelta, commitBaselines, setBaseline } from '../src/core/change-delta.js';
import { addChangeEntry } from '../src/core/changes.js';
import { createMap } from '../src/core/create-map.js';
import { makeLoginMap, makeProject, readMapYaml } from './helpers.js';

let root = '';
let project: Project;
let cleanup: () => void;

beforeEach(async () => {
  const made = await makeProject();
  root = made.root;
  project = made.project;
  cleanup = made.cleanup;
  await makeLoginMap(project);
  project = loadProject(root);
});

afterEach(() => cleanup?.());

describe('ops engine', () => {
  it('preserves comments and block style when patching', async () => {
    const file = path.join(root, '.vibemap', 'maps', 'auth', 'login-flow.vmap.yaml');
    const original = fs.readFileSync(file, 'utf8');
    const commented = original.replace('schema: 1', 'schema: 1\n# human comment: keep this');
    fs.writeFileSync(file, commented);
    await applyOpsToFile(
      project,
      'auth/login-flow',
      [
        { op: 'update_node', id: 'auth-api', set: { description: 'Updated description.' } },
        { op: 'add_edge', edge: { from: 'users-db', to: 'auth-api', label: 'returns user', kind: 'returns' } },
      ],
      { origin: 'agent' },
    );
    const next = fs.readFileSync(file, 'utf8');
    expect(next).toContain('# human comment: keep this');
    expect(next).toContain('  - id: auth-api');
    expect(next).not.toMatch(/nodes: \[\{/);
    expect(next).toContain('label: returns user');
  });

  it('is atomic when one op is invalid', async () => {
    const before = readMapContent(project, 'auth/login-flow').content;
    await expect(
      applyOpsToFile(
        project,
        'auth/login-flow',
        [
          { op: 'update_node', id: 'auth-api', set: { description: 'should not persist' } },
          { op: 'add_edge', edge: { from: 'auth-api', to: 'ghost', kind: 'calls' } },
        ],
        { origin: 'agent' },
      ),
    ).rejects.toThrow();
    expect(readMapContent(project, 'auth/login-flow').content).toBe(before);
  });

  it('renames nodes and cascades through edges and walkthrough', async () => {
    await applyOpsToFile(project, 'auth/login-flow', [{ op: 'rename_node', id: 'auth-api', to: 'auth-endpoint' }], { origin: 'agent' });
    const loaded = loadMap(project, 'auth/login-flow');
    expect(loaded.map.type).toBe('graph');
    if (loaded.map.type !== 'graph') return;
    expect(loaded.map.nodes.some((node) => node.id === 'auth-endpoint')).toBe(true);
    expect(loaded.map.nodes.some((node) => node.id === 'auth-api')).toBe(false);
    expect(loaded.map.edges.every((edge) => edge.from !== 'auth-api' && edge.to !== 'auth-api')).toBe(true);
    expect(loaded.map.walkthrough?.every((step) => !step.focus.includes('auth-api'))).toBe(true);
  });

  it('removes a node, its edges and its walkthrough focus', async () => {
    await applyOpsToFile(project, 'auth/login-flow', [{ op: 'remove_node', id: 'login-form' }], { origin: 'agent' });
    const loaded = loadMap(project, 'auth/login-flow');
    if (loaded.map.type !== 'graph') throw new Error('expected graph');
    expect(loaded.map.nodes.some((node) => node.id === 'login-form')).toBe(false);
    expect(loaded.map.edges.some((edge) => edge.from === 'login-form' || edge.to === 'login-form')).toBe(false);
    expect(loaded.map.walkthrough?.every((step) => !step.focus.includes('login-form'))).toBe(true);
  });

  it('auto-locks only the node edited by a human', async () => {
    await applyOpsToFile(
      project,
      'auth/login-flow',
      [
        { op: 'update_node', id: 'auth-api', set: { label: 'POST /login' } },
        { op: 'add_edge', edge: { from: 'login-form', to: 'users-db', kind: 'depends' } },
      ],
      { origin: 'human' },
    );
    const locks = readLocks(loadProject(root));
    expect(Object.keys(locks.locks)).toEqual(['auth/login-flow#auth-api']);
  });

  it('rejects an agent edit of a locked node', async () => {
    await applyOpsToFile(project, 'auth/login-flow', [{ op: 'update_node', id: 'auth-api', set: { label: 'POST /login' } }], { origin: 'human' });
    await expect(
      applyOpsToFile(project, 'auth/login-flow', [{ op: 'update_node', id: 'auth-api', set: { label: 'Agent overwrite' } }], { origin: 'agent' }),
    ).rejects.toMatchObject({ code: 'E009' });
  });

  it('records a journal snapshot for every accepted write', async () => {
    const result = await applyOpsToFile(project, 'auth/login-flow', [{ op: 'update_node', id: 'auth-api', set: { description: 'journal test' } }], {
      origin: 'agent',
    });
    const journal = await listJournal(loadProject(root), 'auth/login-flow', 5);
    expect(journal[0]?.rev).toBe(result.rev);
    expect(journal[0]?.content).toContain('journal test');
  });

  it('rejects a stale base revision', async () => {
    const current = readMapContent(project, 'auth/login-flow');
    await applyOpsToFile(project, 'auth/login-flow', [{ op: 'update_node', id: 'auth-api', set: { description: 'first' } }], { origin: 'agent' });
    await expect(
      applyOpsToFile(project, 'auth/login-flow', [{ op: 'update_node', id: 'auth-api', set: { description: 'second' } }], {
        origin: 'agent',
        baseRev: current.rev,
      }),
    ).rejects.toBeInstanceOf(RevisionConflictError);
  });

  it('handles sequence and ERD ops', async () => {
    await createMap(project, 'flows/sequence', { type: 'sequence', title: 'Sequence' });
    await applyOpsToFile(project, 'flows/sequence', [{ op: 'set_meta', set: { summary: 'flow' } }], { origin: 'agent' });
    // Directly replace with participants so add_step can be used.
    fs.writeFileSync(
      path.join(root, '.vibemap', 'maps', 'flows', 'sequence.vmap.yaml'),
      `schema: 1\ntitle: Sequence\ntype: sequence\nlevel: feature\nsummary: flow\nparticipants:\n  - id: browser\n    label: Browser\n  - id: api\n    label: API\nsteps: []\n`,
    );
    await applyOpsToFile(project, 'flows/sequence', [{ op: 'add_step', step: { from: 'browser', to: 'api', label: 'POST /login', kind: 'call' } }], {
      origin: 'agent',
    });
    const sequence = loadMap(project, 'flows/sequence');
    expect(sequence.map.type).toBe('sequence');
    if (sequence.map.type === 'sequence') expect(sequence.map.steps).toHaveLength(1);

    await createMap(project, 'data/schema', { type: 'erd', title: 'Schema' });
    await applyOpsToFile(
      project,
      'data/schema',
      [
        { op: 'add_entity', entity: { id: 'user', label: 'User', refs: [{ path: 'prisma/schema.prisma' }] } },
        { op: 'add_field', entity: 'user', field: { name: 'id', type: 'string', key: 'pk' } },
        { op: 'add_entity', entity: { id: 'note', label: 'Note' } },
        { op: 'add_relation', relation: { from: 'user', to: 'note', card: '1..n', label: 'writes' } },
      ],
      { origin: 'agent' },
    );
    const erd = loadMap(project, 'data/schema');
    expect(erd.map.type).toBe('erd');
    if (erd.map.type === 'erd') {
      expect(erd.map.entities.find((entity) => entity.id === 'user')?.fields).toHaveLength(1);
      expect(erd.map.relations).toHaveLength(1);
    }
  });

  it('computes change deltas from the map baseline and only writes a change entry', async () => {
    const baseline = loadMap(project, 'auth/login-flow');
    await setBaseline(project, 'auth/login-flow', baseline.rev, baseline.map.type);
    await applyOpsToFile(
      project,
      'auth/login-flow',
      [
        { op: 'add_node', node: { id: 'session-store', label: 'Session store', kind: 'cache', status: 'planned' } },
        { op: 'add_edge', edge: { from: 'auth-api', to: 'session-store', kind: 'writes' } },
      ],
      { origin: 'agent' },
    );
    const computed = await computeChangeDelta(project, ['auth/login-flow']);
    const delta = computed.delta;
    expect(computed.bases['auth/login-flow']).toBeTruthy();
    expect(delta.added_nodes).toContain('auth/login-flow#session-store');
    expect(delta.added_edges).toBe(1);
    const entry = await addChangeEntry(project, {
      title: 'Add session store',
      why: 'Sessions need a home.',
      maps: ['auth/login-flow'],
      type: 'feature',
      delta,
      bases: computed.bases,
    });
    expect(entry.file).toContain('.vibemap/changes/');
    await commitBaselines(project, ['auth/login-flow']);
    const secondDelta = (await computeChangeDelta(project, ['auth/login-flow'])).delta;
    expect(secondDelta.added_nodes).toEqual([]);
  });

  it('prunes stale sidecar entries without touching annotations', async () => {
    const layoutFile = path.join(root, '.vibemap', 'layouts', 'auth', 'login-flow.layout.json');
    fs.mkdirSync(path.dirname(layoutFile), { recursive: true });
    fs.writeFileSync(
      layoutFile,
      JSON.stringify({
        schema: 1,
        map: 'auth/login-flow',
        nodes: { ghost: { x: 1, y: 2, w: 100, h: 50, pinned: true }, 'auth-api': { x: 10, y: 20, w: 100, h: 50, pinned: true } },
        annotations: [{ id: 's1', type: 'sticky', x: 1, y: 1, text: 'keep me' }],
        viewport: { x: 0, y: 0, zoom: 1 },
      }),
    );
    const loaded = loadMap(project, 'auth/login-flow');
    const changed = await pruneSidecar(project, 'auth/login-flow', loaded.map);
    expect(changed).toBe(true);
    const layout = JSON.parse(fs.readFileSync(layoutFile, 'utf8'));
    expect(layout.nodes.ghost).toBeUndefined();
    expect(layout.nodes['auth-api']).toBeTruthy();
    expect(layout.annotations).toHaveLength(1);
  });

  it('keeps YAML human comments around groups', async () => {
    const before = readMapYaml(project, 'auth/login-flow');
    expect(before).toContain('groups:');
    expect(before).not.toContain('#');
  });
});
