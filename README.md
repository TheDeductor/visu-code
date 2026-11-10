# VibeMap

**Living visual project memory for AI-assisted codebases.**

VibeMap keeps architecture diagrams, flows and the reasoning behind them in a
local `.vibemap/` folder next to the code. Humans open a local read/write viewer;
any coding agent can read a compact context digest, patch maps, and record what
changed through the CLI or MCP. There is no cloud account and no hosted service.

> **Status: working MVP, not production software.** The core, validator, scanner,
> server, viewer, tests and agent tooling are implemented and exercised. Known
> gaps are listed in [REMAINING.md](REMAINING.md). Treat generated diagrams as
> evidence-backed but reviewable, not authoritative.

## Why

- Agents forget architecture between sessions; VibeMap is the durable brief.
- Reviewers can see what a change touched instead of reconstructing it from diff.
- Locks stop an agent silently rewriting a human-owned decision.
- Evidence refs are checked against real files and symbols; stale maps fail
  `vibemap check` instead of lying.
- Everything is YAML/Markdown in git, so it works with any agent, editor or CI.

## Requirements

- Node.js **20 or newer** (developed on Node 25).
- Windows, macOS or Linux.
- Git is optional but needed for timeline/diff/PR summaries.

## Build from this checkout

```powershell
npm install
npm run build
npm test
```

`npm run build` produces `dist/cli.js` and the viewer in `dist/web`.

Optionally make the command available globally:

```powershell
npm link
vibemap --version
```

## Quick start

### Try the bundled fixture

```powershell
node dist/cli.js --root fixtures/ts-web check
node dist/cli.js --root fixtures/ts-web context --area auth
node dist/cli.js --root fixtures/ts-web view
```

`view` prints a `127.0.0.1` URL with a one-session token and opens the browser.
Stop it with `Ctrl+C`. The fixture project is under `fixtures/ts-web` and shows a
graph map, note, phases, journal, git timeline and locked/rebase behavior.

### Add VibeMap to your project

```powershell
cd D:\path\to\your-project
node D:\visu-code\dist\cli.js --root . init --agents generic
node D:\visu-code\dist\cli.js --root . scan
node D:\visu-code\dist\cli.js --root . context --area src/auth
node D:\visu-code\dist\cli.js --root . view
```

`init` creates `.vibemap/`, managed rule blocks for the agents you choose,
`.vibemap/AGENT_GUIDE.md`, and a bootstrap prompt. It never overwrites your files
or commits anything.

### Agent integration

- **Rules:** `init --agents claude-code,codex,cursor,generic` writes guarded blocks
  into each agent's instruction file.
- **Claude Code hooks:** `init --agents claude-code` adds a fast post-edit hook and a
  stop gate. `hook post-edit` records touched files; `hook stop` exits `2` while
  drift remains.
- **MCP:** register a stdio server, then use the `vibemap_*` tools:

```json
{
  "mcpServers": {
    "vibemap": {
      "command": "node",
      "args": ["D:/visu-code/dist/cli.js", "--root", "D:/path/to/project", "mcp"]
    }
  }
}
```

- **Bootstrap:** `vibemap bootstrap prompt` prints a paste-ready brief for an
  agent that has never seen the project.

After changing code, an agent should run `vibemap context --area <path>`, patch
the affected map, run `vibemap check`, and finish with `vibemap change add`.

## Commands

| Command | Purpose |
| --- | --- |
| `init` | Create `.vibemap/`, agent rules, hooks, bootstrap prompt |
| `scan` | Inventory routes, models, env names, deps, symbols (never secret values) |
| `context` | Compact digest for an area or map |
| `view` | Local authenticated viewer |
| `check` | Validate maps, evidence, coverage, locks, drift |
| `drift` | Show code changed since maps were touched |
| `inspect` | Geometry/layout diagnostics for a map |
| `patch` | Apply validated ops (comment-preserving, atomic) |
| `lock` / `unlock` | Human ownership lock on a node |
| `change add/list/show/seal` | Change log tied to map deltas and commits |
| `phase` | Roadmap phases and git snapshots |
| `history` / `diff` | Map timeline and semantic diff |
| `render` | Export SVG, Mermaid, Markdown, Excalidraw, or a static HTML site |
| `pr-summary` | Reviewer summary of map changes since a base branch |
| `hook` | Agent hook entrypoints |
| `mcp` | MCP stdio server |
| `doctor`, `migrate`, `eject` | Diagnostics and lifecycle |

Global flags: `--root <dir>`, `--json`, `--yes`. Exit codes: `0` ok, `1` usage,
`2` validation/drift, `3` environment, `4` internal.

Run `vibemap <command> --help` for details.

## Inspect and edit in the viewer

- `V` view, `E` edit, `F` fit, `?` shortcuts, `/` search, `Cmd/Ctrl+K` search.
- Select a node for evidence, code refs, connections and change history.
- In edit mode: drag to pin, **Connect** two nodes, `+ Node`, sticky notes,
  annotations, comments, delete.
- Changes, Timeline, Phases, Notes and Coverage tabs are first-class.
- Locked nodes show a lock badge; the inspector locks/unlocks.
- Conflicts on disk show a banner; your unsaved node edit is retained.

## Files and formats

See [docs/FORMAT.md](docs/FORMAT.md). In short:

- `.vibemap/maps/**/*.vmap.yaml` — maps.
- `.vibemap/notes/*.md` — long-form decisions.
- `.vibemap/changes/*.md` — change log with `why`, `how`, `watch out`.
- `.vibemap/layouts/**/*.layout.json` — pinned positions, annotations, viewport.
- `.vibemap/locks.json`, `phases.yaml`, `config.yaml`, `theme.yaml`.
- `.vibemap/.cache/` — gitignored scanner cache, journal, pending hook files.

Hand edits to maps are allowed; run `vibemap check --fix` for safe repairs.

## Security model

See [docs/SECURITY.md](docs/SECURITY.md). Defaults: loopback only, random
per-session token, Host and Origin checks, path confinement outside `.vibemap`,
secret-like files inventoried without reading values.

## Architecture

- `src/core` — schemas, safe paths, YAML ops, validation, scanner, evidence,
  layout, history/diff, render, phases, notes, locks, lifecycle.
- `src/server` — native `http` + `ws`, auth checks, watcher, REST/API.
- `src/cli` — thin fast hook entrypoint plus Commander CLI.
- `src/agent-kit` — guide, rules, hooks, MCP.
- `viewer` — React + Vite, custom accessible SVG/rough.js canvas.
- `test` — 66 Vitest unit/integration/fuzz tests + Playwright smoke.

### Layout Engine

VibeMap includes a custom, zero-runtime-dependency compound layout engine in `src/core/layout.ts`:
- **Compound hierarchical ranking:** Bottom-up sizing collapses groups into super-nodes; inter-group edges become weighted super-edges. Ranks are ordered with 4+ sweeps of barycentric heuristics plus adjacent swap refinement.
- **Group isolation & zero-overlap:** Group boundaries are computed strictly from member extents plus `groupPad` before placement, ensuring non-overlapping containment by construction.
- **Long-edge dummy channels:** Edges spanning multiple ranks allocate dummy nodes during layer ordering, preventing edges from cutting through intermediate nodes.
- **Aspect-ratio folding:** Diagrams that exceed an aspect ratio of 2.2:1 with $\ge 3$ ranks wrap into balanced sub-rows, preserving compact $\le 2:1$ aspect ratios for standard pipelines.
- **Obstacle-aware orthogonal routing:** Edge paths use distributed ports ($\ge 14\text{ px}$ spacing) and an A* diagram track router to generate rounded-corner ($R=10$) orthogonal polylines that avoid node collisions.
- **Collision-free translucent labels:** Label placements are tested against nodes, headers, and neighboring labels with progressive fallback and truncation, styled with translucent backgrounds (`fill-opacity="0.88"`) to never obstruct canvas geometry.
- **ERD & Sequence layouts:** ERD graphs use degree-sorted grid clustering with specific field row PK/FK attachment; sequence diagrams dynamically space participants based on message label widths.
- **Diagnostics:** Full layout quality metrics (`layoutQuality()`) are accessible via `vibemap inspect <map>`.

Deliberate deviations from the original spec: a native deterministic SVG canvas
instead of Excalidraw/ELK (the Excalidraw exporter remains), native `http`/`ws`
instead of Fastify, and npm because pnpm was unavailable. See `PLAN.md`.

## Development

```powershell
npm run typecheck
npm test
npm run build
node scripts/final-ui.mjs   # needs a server on 4499
```

`npm test` runs the suite; `npm run check` runs typecheck + tests.

## Package name

The npm name `vibemap` is already taken, so this checkout stays private. Rename
`package.json` before publishing (for example `@your-scope/vibemap`).

## License

MIT (add a `LICENSE` file before publishing).
