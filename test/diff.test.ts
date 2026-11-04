import { describe, expect, it } from 'vitest';
import type { GraphMap, SequenceMap } from '../src/core/types.js';
import { diffMaps, diffSummary, diffHasChanges } from '../src/core/diff.js';

const base: GraphMap = {
  schema: 1,
  title: 'Flow',
  type: 'graph',
  level: 'feature',
  summary: 'flow',
  nodes: [
    { id: 'form', label: 'Login form', kind: 'ui', refs: [{ path: 'src/form.tsx' }] },
    { id: 'api', label: 'API', kind: 'api', refs: [{ path: 'src/api.ts' }] },
    { id: 'db', label: 'Database', kind: 'database', refs: [{ path: 'prisma/schema.prisma' }] },
  ],
  edges: [
    { from: 'form', to: 'api', kind: 'calls' },
    { from: 'api', to: 'db', kind: 'reads' },
  ],
};

describe('diff', () => {
  it('detects added, removed, modified nodes and edges', () => {
    const head: GraphMap = {
      ...base,
      nodes: [
        { ...base.nodes[0]!, label: 'Sign-in form' },
        { ...base.nodes[1]!, description: 'Authenticates the user.' },
        { id: 'cache', label: 'Session store', kind: 'cache', refs: [{ path: 'src/session.ts' }] },
      ],
      edges: [
        { from: 'form', to: 'api', kind: 'calls' },
        { from: 'api', to: 'cache', kind: 'writes' },
      ],
    };
    const diff = diffMaps('auth/login', base, head, 'base', 'head');
    expect(diff.added.map((node) => node.id)).toEqual(['cache']);
    expect(diff.removed.map((node) => node.id)).toEqual(['db']);
    expect(diff.modified.find((node) => node.id === 'form')?.fields).toContain('label');
    expect(diff.modified.find((node) => node.id === 'api')?.fields).toContain('description');
    expect(diff.addedEdges).toHaveLength(1);
    expect(diff.removedEdges).toHaveLength(1);
    expect(diffHasChanges(diff)).toBe(true);
    expect(diffSummary(diff)).toContain('+1 nodes');
  });

  it('returns no changes for identical maps', () => {
    const diff = diffMaps('x', base, structuredClone(base), 'a', 'a');
    expect(diffHasChanges(diff)).toBe(false);
    expect(diffSummary(diff)).toBe('no semantic changes');
  });

  it('suggests likely renames by refs or labels', () => {
    const head: GraphMap = {
      ...base,
      nodes: base.nodes.map((node) => (node.id === 'form' ? { ...node, id: 'signin-form', label: 'Sign-in form' } : node)),
      edges: base.edges.map((edge) => ({ ...edge, from: edge.from === 'form' ? 'signin-form' : edge.from })),
    };
    const diff = diffMaps('x', base, head, 'a', 'b');
    expect(diff.possibleRenames?.some((rename) => rename.from === 'form' && rename.to === 'signin-form')).toBe(true);
  });

  it('differs sequence maps as nodes and edges', () => {
    const sequence: SequenceMap = {
      schema: 1,
      title: 'Seq',
      type: 'sequence',
      level: 'feature',
      summary: 'seq',
      participants: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      steps: [{ from: 'a', to: 'b', label: 'call' }],
    };
    const head: SequenceMap = { ...sequence, steps: [...sequence.steps, { from: 'b', to: 'a', label: 'return', kind: 'return' }] };
    const diff = diffMaps('seq', sequence, head, 'a', 'b');
    expect(diff.addedEdges).toHaveLength(1);
  });
});
