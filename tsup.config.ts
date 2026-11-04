import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { cli: 'src/cli/cli.ts' },
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: false,
  splitting: true,
  sourcemap: true,
  dts: false,
  banner: { js: '#!/usr/bin/env node' },
  external: ['typescript'],
});
