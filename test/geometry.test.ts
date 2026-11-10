import { describe, expect, it } from 'vitest';
import { layoutEdgePath, polylinePath } from '../src/core/geometry.js';

describe('polylinePath', () => {
  it('draws a straight line for two points', () => {
    expect(polylinePath([{ x: 0, y: 0 }, { x: 10, y: 20 }])).toBe('M 0 0 L 10 20');
  });

  it('rounds interior corners with a quadratic', () => {
    const path = polylinePath([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], 10);
    expect(path).toContain('M 0 0');
    expect(path).toContain('Q 100 0');
    expect(path).toContain('L 100 100');
    expect(path).not.toContain('C ');
  });

  it('keeps legacy cubic paths unchanged', () => {
    const path = 'M 0 0 C 10 0, 20 10, 30 10';
    expect(layoutEdgePath({ path, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 10 }, { x: 30, y: 10 }] })).toBe(path);
  });

  it('uses a polyline for non-cubic edges', () => {
    expect(layoutEdgePath({ path: 'M 0 0 L 10 0 L 10 10', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] })).toContain('Q 10 0');
  });
});
