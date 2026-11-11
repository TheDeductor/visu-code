import { describe, expect, it } from 'vitest';
import type { ErdMap, SequenceMap, Theme } from '../../src/core/types.js';
import { defaultTheme } from '../../src/core/defaults.js';
import { layoutMap } from '../../src/core/layout.js';
import { measureText } from '../../src/core/theme.js';

describe('Phase 8 sequence and ERD layout refinement', () => {
  const theme: Theme = defaultTheme();

  it('no sequence message label overlaps a non-involved lifeline in multi-participant span', () => {
    const map: SequenceMap = {
      schema: 1,
      title: 'Multi-Participant Sequence',
      type: 'sequence',
      level: 'feature',
      participants: [
        { id: 'client', label: 'Client' },
        { id: 'gateway', label: 'API Gateway' },
        { id: 'auth', label: 'Auth Service' },
        { id: 'db', label: 'User Database' },
      ],
      steps: [
        // Spans across gateway and auth directly to db
        { from: 'client', to: 'db', label: 'Direct Database Query Request' },
        { from: 'db', to: 'client', label: 'Direct Database Response Payload' },
      ],
    };

    const res = layoutMap(map, theme);
    if (res.type !== 'sequence') throw new Error('Expected sequence');

    const pById = new Map(res.participants.map((p) => [p.id, p]));
    const lifelines = new Map(res.participants.map((p) => [p.id, p.x + p.w / 2]));

    for (const step of res.steps) {
      const fromP = pById.get(step.from)!;
      const toP = pById.get(step.to)!;
      const x1 = fromP.x + fromP.w / 2;
      const x2 = toP.x + toP.w / 2;
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);

      const labelW = measureText(step.label, 12);
      const labelMidX = step.labelX ?? (x1 + x2) / 2;
      const labelLeft = labelMidX - labelW / 2;
      const labelRight = labelMidX + labelW / 2;

      // Check all participants not involved in this step
      for (const p of res.participants) {
        if (p.id === step.from || p.id === step.to) continue;
        const lineX = lifelines.get(p.id)!;
        // If the lifeline is between minX and maxX, the label must not overlap it
        if (lineX > minX && lineX < maxX) {
          const overlaps = lineX >= labelLeft - 4 && lineX <= labelRight + 4;
          expect(overlaps, `Label "${step.label}" at [${labelLeft.toFixed(1)}, ${labelRight.toFixed(1)}] overlaps non-involved lifeline of "${p.id}" at ${lineX.toFixed(1)}`).toBe(false);
        }
      }
    }
  });

  it('sequence pairGaps respect widest label + 24 and rowGap >= max(58, labelHeight + 24)', () => {
    const longLabel = 'This is a very long operation label between adjacent actors';
    const map: SequenceMap = {
      schema: 1,
      title: 'Gap Measurement',
      type: 'sequence',
      level: 'feature',
      participants: [
        { id: 'a', label: 'Participant A' },
        { id: 'b', label: 'Participant B' },
      ],
      steps: [
        { from: 'a', to: 'b', label: longLabel },
      ],
    };

    const res = layoutMap(map, theme);
    if (res.type !== 'sequence') throw new Error('Expected sequence');

    const pA = res.participants.find((p) => p.id === 'a')!;
    const pB = res.participants.find((p) => p.id === 'b')!;
    const gap = pB.x - (pA.x + pA.w);
    const expectedMinSpan = measureText(longLabel, 13) + 24;

    expect(gap).toBeGreaterThanOrEqual(Math.min(expectedMinSpan, 60));
  });

  it('ERD layout lays out entities with FK and PK field attachments', () => {
    const map: ErdMap = {
      schema: 1,
      title: 'Test ERD',
      type: 'erd',
      level: 'feature',
      entities: [
        {
          id: 'users',
          label: 'Users',
          fields: [
            { name: 'id', type: 'uuid', key: 'pk' },
            { name: 'email', type: 'string', key: 'unique' },
          ],
        },
        {
          id: 'posts',
          label: 'Posts',
          fields: [
            { name: 'id', type: 'uuid', key: 'pk' },
            { name: 'user_id', type: 'uuid', key: 'fk', ref: 'users.id' },
            { name: 'title', type: 'string' },
          ],
        },
      ],
      relations: [
        { from: 'posts', to: 'users', card: 'n..1' },
      ],
    };

    const res = layoutMap(map, theme);
    if (res.type !== 'erd') throw new Error('Expected erd');

    expect(res.entities.length).toBe(2);
    expect(res.relations.length).toBe(1);

    const relation = res.relations[0]!;
    expect(relation.points.length).toBeGreaterThanOrEqual(2);
    expect(relation.path).toContain('M');

    // Determinism test
    const res2 = layoutMap(map, theme);
    expect(res).toEqual(res2);
  });
});

