import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  ChangeFrontmatterSchema,
  ConfigSchema,
  LayoutSidecarSchema,
  MapSchema,
  OpsFileSchema,
  PhasesSchema,
  ThemeSchema,
} from './schema.js';

export function jsonSchemaBundle(): Record<string, unknown> {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'VibeMap file formats',
    maps: zodToJsonSchema(MapSchema, { name: 'VibeMap', target: 'jsonSchema7' }),
    config: zodToJsonSchema(ConfigSchema, { name: 'VibeMapConfig', target: 'jsonSchema7' }),
    theme: zodToJsonSchema(ThemeSchema, { name: 'VibeMapTheme', target: 'jsonSchema7' }),
    phases: zodToJsonSchema(PhasesSchema, { name: 'VibeMapPhases', target: 'jsonSchema7' }),
    layout: zodToJsonSchema(LayoutSidecarSchema, { name: 'VibeMapLayout', target: 'jsonSchema7' }),
    change: zodToJsonSchema(ChangeFrontmatterSchema, { name: 'VibeMapChange', target: 'jsonSchema7' }),
    ops: zodToJsonSchema(OpsFileSchema, { name: 'VibeMapOps', target: 'jsonSchema7' }),
  };
}

export function schemaMarkdown(): string {
  return `# VibeMap file format — quick reference

All files are UTF-8, LF, and start with \`schema: 1\`. Unknown fields are errors.

## Graph map — \`maps/<id>.vmap.yaml\`

\`\`\`yaml
schema: 1
title: Login flow
type: graph                 # graph | sequence | erd | mermaid
level: feature              # overview | feature | detail
direction: right            # right | down | left | up
summary: How a user signs in with email and password.
phase: p2                   # optional, must exist in phases.yaml
tags: [auth]

groups:
  - id: frontend
    label: Frontend
    kind: boundary          # boundary | layer | team

nodes:
  - id: login-form
    label: Login form
    kind: ui                # see kind list below
    group: frontend
    status: built           # planned | built | deprecated
    description: Collects credentials and posts them to the API.   # <= 200 chars
    plain: The page where you type your email and password.
    refs:
      - path: src/components/LoginForm.tsx
        symbol: LoginForm   # optional but verified
        lines: [10, 80]     # optional

edges:
  - from: login-form
    to: auth-api
    label: email + password
    kind: calls

walkthrough:
  - focus: [login-form]
    text: The user types credentials here.

notes: [auth.md]
\`\`\`

### Node kinds

\`ui\`, \`page\`, \`component\`, \`api\`, \`service\`, \`module\`, \`function\`, \`file\`, \`database\`,
\`queue\`, \`cache\`, \`storage\`, \`external\`, \`actor\`, \`decision\`, \`process\`, \`config\`, \`note\`, \`custom\`.

### Edge kinds

\`calls\`, \`reads\`, \`writes\`, \`imports\`, \`data\`, \`event\`, \`depends\`, \`returns\`, \`flow\`, \`contains\`.

## Sequence map

\`\`\`yaml
schema: 1
title: Login sequence
type: sequence
participants:
  - { id: browser, label: Browser, kind: actor }
  - { id: api, label: API, kind: service, refs: [{ path: src/routes/auth.ts }] }
steps:
  - { from: browser, to: api, label: POST /login, kind: call }
  - { from: api, to: browser, label: Set-Cookie, kind: return }
fragments:
  - { kind: alt, label: wrong password, from_step: 2, to_step: 3 }   # 0-based, inclusive
\`\`\`

## ERD map

\`\`\`yaml
schema: 1
title: Data model
type: erd
entities:
  - id: user
    label: User
    refs: [{ path: prisma/schema.prisma, symbol: User }]
    fields:
      - { name: id, type: uuid, key: pk }
      - { name: email, type: string, key: unique }
relations:
  - { from: user, to: post, card: "1..n", label: writes }
\`\`\`

## Mermaid escape hatch

\`\`\`yaml
schema: 1
title: Release gantt
type: mermaid
source: |
  gantt
    dateFormat  YYYY-MM-DD
\`\`\`

Mermaid maps are syntax-checked lightly and rendered as source; they are not evidence-checked at node level.

## Layout sidecar — \`layouts/<id>.layout.json\`

Written by the viewer only. Human-owned.

\`\`\`json
{
  "schema": 1,
  "map": "auth/login-flow",
  "nodes": { "login-form": { "x": 120, "y": 40, "w": 200, "h": 70, "pinned": true } },
  "groups": { "frontend": { "collapsed": false } },
  "annotations": [],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
\`\`\`

## Notes — \`notes/<name>.md\`

\`\`\`md
---
schema: 1
title: Authentication
maps: [auth/login-flow]
nodes: [auth/login-flow#auth-api]
---
Long-form explanation. Link nodes with [[auth/login-flow#auth-api]].
\`\`\`

## Changes — \`changes/<YYYYMMDD-HHMM>-<slug>.md\`

\`\`\`md
---
schema: 1
id: 20261102-1530-add-login
title: Add email login
date: 2026-11-02T15:30:00+05:30
type: feature
author: agent:claude-code
maps: [auth/login-flow]
commit: null
delta:
  added_nodes: []
  modified_nodes: []
  removed_nodes: []
  added_edges: 0
  removed_edges: 0
---
## What changed
## Why
## How it works
## Watch out
\`\`\`

The \`delta\` is computed by \`vibemap change add\`; never write it by hand.

## Patch operations

\`\`\`json
{ "ops": [
  { "op": "add_node", "node": { "id": "session-store", "label": "Session store", "kind": "cache" } },
  { "op": "add_edge", "edge": { "from": "auth-api", "to": "session-store", "kind": "writes" } },
  { "op": "update_node", "id": "auth-api", "set": { "description": "…" } },
  { "op": "rename_node", "id": "login-form", "to": "signin-form" },
  { "op": "remove_edge", "id": "auth-api>users-db:reads#0" },
  { "op": "set_meta", "set": { "summary": "…" } }
] }
\`\`\`

Full JSON Schema: \`vibemap schema --format json\`.
`;
}
