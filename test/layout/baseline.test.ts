import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { VibeMap } from '../../src/core/types.js';
import { parseYamlText } from '../../src/core/yaml.js';
import { layoutMap } from '../../src/core/layout.js';
import { layoutQuality } from '../../src/core/layout-quality.js';
import { defaultTheme } from '../../src/core/defaults.js';

const theme = defaultTheme();

function collectMaps(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectMaps(abs));
    else if (entry.isFile() && entry.name.endsWith('.vmap.yaml')) out.push(abs);
  }
  return out.sort();
}

function mapFileFor(root: string): string[] {
  return collectMaps(path.join(root, '.vibemap', 'maps'));
}

describe('layout quality baseline', () => {
  const roots = [
    { name: 'repo', root: process.cwd() },
    { name: 'ts-web fixture', root: path.join(process.cwd(), 'fixtures', 'ts-web') },
  ];

  for (const { name, root } of roots) {
    it(`runs on every map in ${name} without throwing`, () => {
      const files = mapFileFor(root);
      expect(files.length, `no maps found under ${root}`).toBeGreaterThan(0);
      for (const file of files) {
        const rel = path.relative(root, file).split(path.sep).join('/');
        const map = parseYamlText(fs.readFileSync(file, 'utf8')).doc.toJS() as VibeMap;
        const layout = layoutMap(map, theme);
        const q = layoutQuality(layout, theme);
        for (const [key, value] of Object.entries(q)) {
          if (key === 'warnings') continue;
          expect(Number.isFinite(value as number), `${rel}: ${key} is not finite`).toBe(true);
          expect(value as number, `${rel}: ${key} is negative`).toBeGreaterThanOrEqual(0);
        }
        expect(q.maxNodeDegree, `${rel}: maxNodeDegree`).toBeGreaterThanOrEqual(0);
        expect(q.bends, `${rel}: bends`).toBeGreaterThanOrEqual(0);
      }
    });
  }
});
