import type { ProjectConfig, Theme } from './types.js';

export function defaultConfig(projectName = 'my-app'): ProjectConfig {
  return {
    schema: 1,
    project: { name: projectName },
    tracking: { mode: 'every-change', granularity: 'feature', changeLog: true },
    agents: [],
    paths: {
      include: ['**/*'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'build/**',
        'out/**',
        'coverage/**',
        '.git/**',
        '.vibemap/**',
        'vendor/**',
        '**/*.min.*',
        '**/*.map',
        '**/*.test.*',
        '**/*.spec.*',
        '**/__tests__/**',
        '**/__snapshots__/**',
        '**/migrations/**',
      ],
    },
    limits: { softMaxNodes: 15, hardMaxNodes: 30, maxLabelChars: 40, maxDescriptionChars: 200 },
    validation: { strict: false, requireRefs: true },
    editing: { autoLockHumanEdits: true, newNodeStatus: 'planned' },
    viewer: { port: 4317, host: '127.0.0.1', open: true, defaultTab: 'maps', beginnerMode: false },
    history: { source: 'git', journalMaxEntries: 500 },
    coverage: { target: 60 },
    glossary: {},
    privacy: { llm: 'none', telemetry: false },
  };
}

export function defaultTheme(): Theme {
  return {
    schema: 1,
    font: 'hand',
    roughness: 1,
    strokeWidth: 2,
    gap: 56,
    rankSep: 120,
    nodeSep: 56,
    groupPad: { x: 36, top: 44, bottom: 28 },
    groupSep: 40,
    nodeMargin: 28,
    minNodeSize: { w: 140, h: 56 },
    maxLabelWidth: 220,
    colors: {
      ui: '#a5d8ff',
      api: '#d0bfff',
      database: '#b2f2bb',
      external: '#ffd8a8',
      queue: '#ffec99',
      neutral: '#e9ecef',
      actor: '#ffffff',
      decision: '#ffec99',
      note: '#fff3bf',
      background: '#f8f9fa',
      ink: '#1e1e1e',
    },
  };
}

export const DEFAULT_CONFIG_YAML = `schema: 1
project:
  name: {{name}}
tracking:
  # every-change | per-phase | manual | off
  mode: every-change
  # overview | feature | detail
  granularity: feature
  changeLog: true
agents: []
paths:
  include:
    - "**/*"
  exclude:
    - "node_modules/**"
    - "dist/**"
    - "build/**"
    - "coverage/**"
    - ".git/**"
    - ".vibemap/**"
    - "**/*.test.*"
    - "**/*.spec.*"
limits:
  softMaxNodes: 15
  hardMaxNodes: 30
  maxLabelChars: 40
  maxDescriptionChars: 200
validation:
  strict: false
  requireRefs: true
editing:
  autoLockHumanEdits: true
  newNodeStatus: planned
viewer:
  port: 4317
  host: 127.0.0.1
  open: true
  defaultTab: maps
  beginnerMode: false
history:
  source: git
  journalMaxEntries: 500
coverage:
  target: 60
glossary:
  JWT: A signed token that proves who you are.
privacy:
  llm: none
  telemetry: false
`;

export const DEFAULT_THEME_YAML = `schema: 1
font: hand          # hand | normal | code
roughness: 1        # 0 architect, 1 artist, 2 cartoonist
strokeWidth: 2
rankSep: 120
nodeSep: 56
groupPad: { x: 36, top: 44, bottom: 28 }
groupSep: 40
nodeMargin: 28
minNodeSize: { w: 140, h: 56 }
maxLabelWidth: 220
colors:
  ui: "#a5d8ff"
  api: "#d0bfff"
  database: "#b2f2bb"
  external: "#ffd8a8"
  queue: "#ffec99"
  neutral: "#e9ecef"
  actor: "#ffffff"
  decision: "#ffec99"
  note: "#fff3bf"
  background: "#f8f9fa"
  ink: "#1e1e1e"
`;
