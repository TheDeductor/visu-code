# Map and file format

All files are UTF-8, LF, schema version `1`, and reject unknown keys. Map IDs are
lowercase path segments without `.vmap.yaml` (for example `auth/login-flow`).

## Map frontmatter

Every map has:

```yaml
schema: 1
title: Login flow
level: feature        # overview | feature | detail
type: graph           # graph | sequence | erd | mermaid
summary: One sentence ending in a period.
direction: right      # right | left | up | down (graph only)
```

Optional: `phase`, `tags`, `notes`, `walkthrough`, `groups`, `participants`,
`steps`, `fragments`, `entities`, `relations`, `source`.

`level` drives caps: overview 25 nodes / 3 edges per node, feature 30/5, detail
36/8. Above 36 nodes is a validator error.

## Graph nodes

```yaml
nodes:
  - id: auth-api
    label: POST /api/login
    kind: api
    group: backend
    status: built
    description: Checks credentials and sets a session cookie.
    plain: The server checks your details and remembers you.
    refs:
      - path: src/routes/auth.ts
        symbol: loginHandler
        lines: [12, 28]
    tags: [auth]
    phase: auth-mvp
    drill: auth/login-flow
```

- Node kinds: `service`, `api`, `database`, `cache`, `queue`, `external`, `ui`,
  `data`, `module`, `config`, `process`, `actor`, `note`.
- Statuses: `built`, `partial`, `planned`, `deprecated`. Only `built`/`partial`
  require refs; `actor` and `external` may omit them.
- `id` matches `^[a-z][a-z0-9-]*$` and is unique per map; reserved ids are blocked.
- `refs[].path` is project-relative, no `..`, and must exist. A symbol must exist
  in the scanned TS/Python facts for that path.
- `lines` are optional and must be a `[start, end]` pair.

Edges:

```yaml
edges:
  - from: login-form
    to: auth-api
    label: email + password
    kind: calls
```

Kinds: `calls`, `reads`, `writes`, `imports`, `data`, `event`, `depends`,
`returns`, `flow`, `contains`.

Groups are visual boundaries:

```yaml
groups:
  - id: backend
    label: Server
    kind: boundary     # boundary | subsystem | trust
```

## Sequence and ERD

Sequence maps use `participants` (`id`, `label`, `kind`), `steps` (`from`, `to`,
`label`, `kind`: `call`/`return`/`async`/`note`) and optional `fragments`
(`kind`: `alt`/`opt`/`loop`/`par`, `from_step`, `to_step`).

ERD maps use `entities` with `fields` (`name`, `type`, `key`: `pk`/`fk`/
`unique`/`bool`, `nullable`, `default`) and `relations` (`from`, `to`, one of
`card`: `1-1`/`1..n`/`n..1`/`n..n`, optional `label`).

Mermaid maps store `source` and require the first token to be a supported
Mermaid diagram type.

## Walkthrough

```yaml
walkthrough:
  - focus: [login-form, auth-api]
    text: The person submits credentials.
```

## Notes

```markdown
---
schema: 1
title: Why sessions
maps: [auth/login-flow]
nodes: [auth/login-flow#auth-api]
---

Markdown body. Use [[auth/login-flow#node-id]] to link nodes.
```

## Change entries

`changes/YYYYMMDD-HHmm-slug.md`:

```markdown
---
schema: 1
id: 20261104-1307-plan-login-rate-limiting
title: Plan login rate limiting
date: 2026-11-04T13:07:59+05:30
type: plan             # feature | fix | refactor | plan | docs
phase: hardening
author: agent:claude-code
maps: [auth/login-flow]
bases:
  auth/login-flow: 9bafd2e8a2d6a3ff70ad713e5e5dc6fbfd540702
commit: b420df4
delta:
  added_nodes: [auth/login-flow#rate-limit]
  modified_nodes: [auth/login-flow#auth-api]
  removed_nodes: []
  added_edges: 1
  removed_edges: 0
---

## What changed
...
## Why
...
## How it works
...
## Watch out
...
```

`bases` is the revision the delta was computed against and powers “View diff”.

## Layout sidecar

`.vibemap/layouts/<map>.layout.json` is machine-owned:

```json
{
  "schema": 1,
  "map": "auth/login-flow",
  "nodes": { "auth-api": { "x": 100, "y": 40, "w": 180, "h": 60, "pinned": true } },
  "annotations": [{ "id": "s1", "type": "sticky", "x": 20, "y": 30, "text": "Keep" }],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

Annotation types: `sticky`, `rect`, `ellipse`, `arrow` (with `x2`/`y2`), `text`
and `freehand` (with `points`).

## Phases

```yaml
schema: 1
phases:
  - id: auth-mvp
    title: Auth MVP
    goal: Users can sign in.
    status: done
    started: 2026-11-04
    finished: 2026-11-04
    snapshot: b420df4
```

## Locks

`locks.json` maps `<map>#<node>` to the sha1 at lock time. Human edits through
the viewer auto-lock; agents get `E009` if their base hash differs.
