import { describe, expect, it } from 'vitest';
import { defaultTheme } from '../../src/core/defaults.js';
import { ThemeSchema } from '../../src/core/schema.js';

describe('theme layout fields', () => {
  it('defaultTheme provides rankSep, nodeSep, groupPad, groupSep, nodeMargin', () => {
    const theme = defaultTheme();
    expect(theme.rankSep).toBe(120);
    expect(theme.nodeSep).toBe(56);
    expect(theme.groupPad).toEqual({ x: 36, top: 44, bottom: 28 });
    expect(theme.groupSep).toBe(40);
    expect(theme.nodeMargin).toBe(28);
    expect(theme.gap).toBe(56);
  });

  it('derives nodeSep and rankSep from gap when only gap is set', () => {
    const parsed = ThemeSchema.parse({
      schema: 1,
      gap: 50,
    });
    expect(parsed.nodeSep).toBe(50);
    expect(parsed.rankSep).toBe(100);
    expect(parsed.gap).toBe(50);
    expect(parsed.groupPad).toEqual({ x: 36, top: 44, bottom: 28 });
    expect(parsed.groupSep).toBe(40);
    expect(parsed.nodeMargin).toBe(28);
  });

  it('preserves explicitly configured nodeSep and rankSep', () => {
    const parsed = ThemeSchema.parse({
      schema: 1,
      nodeSep: 64,
      rankSep: 150,
      groupSep: 50,
      nodeMargin: 32,
      groupPad: { x: 40, top: 50, bottom: 30 },
    });
    expect(parsed.nodeSep).toBe(64);
    expect(parsed.rankSep).toBe(150);
    expect(parsed.groupSep).toBe(50);
    expect(parsed.nodeMargin).toBe(32);
    expect(parsed.groupPad).toEqual({ x: 40, top: 50, bottom: 30 });
    expect(parsed.gap).toBe(64);
  });
});
