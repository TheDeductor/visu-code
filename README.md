# VisuCode

**Living visual project memory for AI-assisted codebases.**

VisuCode keeps architecture diagrams, flows and the reasoning behind them in a
local `.vibemap/` folder next to the code. Humans open a local read/write viewer;
any coding agent can read a compact context digest, patch maps, and record what
changed through the CLI or MCP. There is no cloud account and no hosted service.

> **Status: working MVP, not production software.** The core, validator, scanner,
> server, viewer, tests and agent tooling are implemented and exercised. Treat
> generated diagrams as evidence-backed but reviewable, not authoritative.

## Why

- Agents forget architecture between sessions; VisuCode is the durable brief.
- Reviewers can see what a change touched instead of reconstructing it from diff.
- Locks stop an agent silently rewriting a human-owned decision.
- Evidence refs are checked against real files and symbols; stale maps fail
  `vibemap check` instead of lying.
- Everything is YAML/Markdown in git, so it works with any agent, editor or CI.

## Requirements

- Node.js **22 or newer**. This is enforced by `engines.node` in
  `package.json`; development happens on Node 25.
- Windows, macOS or Linux.
- Git is optional but needed for timeline/diff/PR summaries.

## Build from this checkout

```bash
npm install
npm run build
npm test
```

`npm run build` produces `dist/cli.js` and the viewer in `dist/web`.

## Install the command

The npm name `vibemap` is already taken and this package is `private: true`, so
it is not published. Install the binary from your checkout instead:

```bash
npm run build
npm link          # in this repository
vibemap --version
```

If you would rather not link it, call the build output directly:

```bash
node /path/to/visu-code/dist/cli.js --version
```

Every command below works either way; substitute
`node /path/to/visu-code/dist/cli.js` for `vibemap`.

## Quick start

### Try the bundled fixture

```bash
vibemap --root fixtures/ts-web check
vibemap --root fixtures/ts-web context --area auth
vibemap --root fixtures/ts-web view
```

`view` prints a `127.0.0.1` URL with a one-session token and opens the browser.
Stop it with `Ctrl+C`. The fixture project is under `fixtures/ts-web` and shows a
graph map, note, phases, journal, git timeline and locked/rebase behavior.

### Add VisuCode to your project

```bash
cd /path/to/your-project
vibemap init --agents generic
vibemap scan
vibemap context --area src/auth
vibemap bootstrap
vibemap view
```

`init` creates `.vibemap/`, the managed rule blocks for the agents you choose and
`.vibemap/AGENT_GUIDE.md`. It never overwrites your files or commits anything.

`bootstrap` then writes a ready-to-paste brief to `.vibemap/BOOTSTRAP_PROMPT.md`
that tells an agent how to map the existing codebase. Paste it into your agent,
or print it with `vibemap bootstrap --stdout`.

### Agent integration

- **Rules:** `init --agents claude-code,codex,cursor,generic` writes guarded blocks
  into each agent's instruction file. `vibemap agents sync` rewrites them later.
- **Claude Code hooks:** `init --agents claude-code` adds a fast post-edit hook and a
  stop gate. `hook post-edit` records touched files; `hook stop` exits `2` while
  drift remains.
- **MCP:** register a stdio server, then use the `vibemap_*` tools. With the
  `vibemap` binary on `PATH`:

```json
{
  "mcpServers": {
    "vibemap": {
      "command": "vibemap",
      "args": ["--root", "/absolute/path/to/project", "mcp"]
    }
  }
}
```

Without a global install, point it at the build output instead:

```json
{
  "mcpServers": {
    "vibemap": {
      "command": "node",
      "args": ["/absolute/path/to/visu-code/dist/cli.js", "--root", "/absolute/path/to/project", "mcp"]
    }
  }
}
```

- **Bootstrap:** `vibemap bootstrap` writes the prompt file;
  `vibemap bootstrap --stdout` prints it to the terminal.

After changing code, an agent should run `vibemap context --area <path>`, patch
the affected map, run `vibemap check`, and finish with `vibemap change add`.

## Commands

| Command | Purpose |
| --- | --- |
| `init` | Create `.vibemap/`, agent rules, hooks |
| `bootstrap` | Write a ready-to-paste mapping prompt for an agent |
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
| `agents` | Detect, add or resync agent rule blocks |
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

- `.vibemap/maps/**/*.vmap.yaml`: maps.
- `.vibemap/notes/*.md`: long-form decisions.
- `.vibemap/changes/*.md`: change log with `why`, `how`, `watch out`.
- `.vibemap/layouts/**/*.layout.json`: pinned positions, annotations, viewport.
- `.vibemap/locks.json`, `phases.yaml`, `config.yaml`, `theme.yaml`.
- `.vibemap/.cache/`: gitignored scanner cache, journal, pending hook files.

Everything except `.vibemap/.cache/` is meant to be committed. Hand edits to maps
are allowed; run `vibemap check --fix` for safe repairs.

## Security model

See [docs/SECURITY.md](docs/SECURITY.md). Defaults: loopback only, random
per-session token, Host and Origin checks, path confinement outside `.vibemap`,
secret-like files inventoried without reading values.

## Architecture

- `src/core`: schemas, safe paths, YAML ops, validation, scanner, evidence,
  layout, history/diff, render, phases, notes, locks, lifecycle.
- `src/server`: native `http` + `ws`, auth checks, watcher, REST/API.
- `src/cli`: thin fast hook entrypoint plus Commander CLI.
- `src/agent-kit`: guide, rules, hooks, MCP.
- `viewer`: React + Vite, custom accessible SVG canvas.
- `test`: 127 Vitest tests in 20 files, including one Playwright screenshot test
  that launches an installed Chrome.

### Layout engine

The default layout path is the custom engine in `src/core/layout.ts`. It needs no
external layout library at runtime:

- **Compound hierarchical ranking:** Bottom-up sizing collapses groups into super-nodes; inter-group edges become weighted super-edges. Ranks are ordered with 4+ sweeps of barycentric heuristics plus adjacent swap refinement.
- **Group isolation and zero overlap:** Group boundaries are computed from member extents plus `groupPad` before placement, so containment is non-overlapping by construction.
- **Long-edge dummy channels:** Edges spanning multiple ranks allocate dummy nodes during layer ordering, so edges do not cut through intermediate nodes.
- **Aspect-ratio folding:** Diagrams wider than 2.2:1 with three or more ranks wrap into balanced sub-rows to stay near 2:1.
- **Obstacle-aware orthogonal routing:** Edge paths use distributed ports (14 px or more apart) and an A* track router to produce rounded-corner orthogonal polylines that avoid nodes.
- **Collision-free labels:** Label placements are tested against nodes, headers and neighbouring labels, with progressive fallback and truncation.
- **ERD and sequence layouts:** ERD graphs use degree-sorted grid clustering with PK/FK field attachment; sequence diagrams space participants by message label width.
- **Diagnostics:** `layoutQuality()` metrics are available through `vibemap inspect <map>`.

An ELK-based engine (`src/core/layout-elk.ts`, `elkjs`) is kept as an opt-in
alternative and is imported lazily, so it is not part of the default bundle or
the default layout path.

Deliberate deviations from the original spec: a native deterministic SVG canvas
instead of Excalidraw/ELK for the default path (the Excalidraw exporter remains),
native `http`/`ws` instead of Fastify, and npm because pnpm was unavailable.

## Development

```bash
npm run typecheck
npm test
npm run build
npm run dev:web              # viewer against a running server
```

`npm run check` runs typecheck plus the test suite. `test/layout/screens.test.ts`
regenerates screenshots into the gitignored `docs/screens` folder and needs the
build plus a local Chrome install.

## License

MIT. See [LICENSE](LICENSE).
