# VibeMap — Phase-Wise Implementation Plan

> Working name: **VibeMap**. Local implementation name is `vibemap`.
> Plan date: 2026-11-04
> Spec: provided VibeMap v1.0 draft (29 sections).
> This document is the delivery plan for the implementation in this repository.
> Live progress and unfinished work are tracked in [`REMAINING.md`](./REMAINING.md).

---

## 0. Decisions taken before coding

| Decision | Choice | Why |
|---|---|---|
| Package manager | **npm workspaces-style single package** (`src/core`, `src/server`, `src/cli`, `viewer/`) | `pnpm` is not installed in the target environment. A single package still keeps the same module boundaries and avoids cross-package build friction. Can be split into a workspace later without changing public behaviour. |
| Runtime | Node >= 20 (verified on Node 25) | Spec requirement. |
| Canvas | **In-house deterministic SVG canvas with a hand-drawn theme**, behind a `CanvasAdapter` boundary; Excalidraw export is supported | Excalidraw is pre-1.0, its API and scene-update/undo semantics are the biggest schedule and stability risk (spec §28). A controlled renderer lets us ship diff overlays, pins, live updates and accessible list view reliably. Excalidraw can be adopted behind the same adapter later. |
| Layout | **In-house deterministic layered layout** (rank + barycentre ordering + stable tie-breaks + AABB de-overlap), no ELK runtime dependency | ELK's EPL-2.0 and stability/interactive configuration need a dedicated spike. The layout interface is isolated in `core/layout.ts` so ELK can replace it. |
| Server | Node `http` + `ws` (no Fastify) | Fewer moving parts; complete control over the token/Host/Origin checks in §14.5. Fastify can replace the transport later. |
| Viewer | React 19 + Vite, no UI framework | Fast iteration, small bundle, full control of three-pane layout. |
| Schema | Zod + generated JSON Schema | Matches spec; strict unknown-key rejection. |
| YAML writes | `yaml` Document API, atomic temp+rename | Preserves comments/key order for patches and avoids half-written files. |
| Renderer scope | Graph, sequence, ERD and Mermaid source escape hatch | Mermaid is displayed as source first; a real Mermaid renderer is optional/lazy. |
| Name | npm package `vibemap` is **already taken** (v0.1.1). This repo stays `private: true`; the public name remains undecided | Spec requires a name check. Do not publish under a taken name. |

### Explicit non-goals for this build

- No cloud, accounts, multiplayer, telemetry or LLM calls.
- No VS Code extension.
- No PNG rendering without an optional headless browser.
- No 100 % language/framework scanner coverage.
- No mobile editing (read-only responsive fallback).

---

## 1. Delivery phases

### P0 — Plan, scaffolding, contracts (0.5 day)

- [ ] Write this plan and the remaining-work ledger.
- [ ] Scaffold TypeScript package, build (tsup/Vite), test runner (Vitest), lint-free `tsc`.
- [ ] Define core types and file ownership boundaries.
- [ ] Initialise git repository for dogfooding/history.
- **Exit:** `npm run typecheck` and empty test suite pass; repo structure is stable.

### P1 — Core format, validation, evidence, scanner (2–3 days)

- [ ] Zod schemas for map types (`graph`, `sequence`, `erd`, `mermaid`), config, theme, phases, layout sidecar, locks, change frontmatter.
- [ ] YAML IO: parse with line index, atomic write, CRLF normalisation, canonical revision hash.
- [ ] Validator catalogue: E001–E016, W101–W115 where meaningful.
- [ ] Managed/locked-node hashing (E009), forbidden fields (E013), hard caps (E015).
- [ ] Evidence resolver: `verified`, `declared`, `stale`, `planned`.
- [ ] Scanner v1: TypeScript/JavaScript (imports, exports, symbols, Express/Fastify/Hono/Next routes, Prisma/Drizzle env), Python (imports, defs/classes, FastAPI/Flask/Django routes), generic inventory, deps, secrets-safe file handling.
- [ ] `facts.json` cache + incremental scan.
- **Exit:** fixture maps validate with exact rule codes and line numbers; scanner fixture test passes.

### P2 — Ops engine, layout, diff, history, context (2–3 days)

- [ ] Atomic, validated, comment-preserving patch ops with cascade rules.
- [ ] Journal + baseline for change deltas; git history reader.
- [ ] Diff by stable node/edge IDs; rename detection heuristic.
- [ ] Deterministic graph/sequence/ERD layout with pins, stability and zero overlaps (non-pinned).
- [ ] Drift, coverage and suggestions.
- [ ] Context digest with budget/area filtering.
- **Exit:** property/fuzz tests: no overlaps, stable layout when adding a node, idempotent ops, comments preserved.

### P3 — CLI and agent integration (1.5–2 days)

- [ ] `init`, `view`, `check`, `scan`, `drift`, `suggest`, `context`, `schema`, `map new`, `patch`, `change`, `phase`, `lock/unlock`, `inspect`, `render`, `pr-summary`, `agents`, `hook`, `mcp`, `bootstrap`, `doctor`, `migrate`, `eject`.
- [ ] Rules-file generators + managed blocks for Claude Code, Cursor, Codex/AGENTS.md, Copilot, Gemini, Windsurf, Aider.
- [ ] Claude Code hook entry points (`post-edit`, `stop`) and git hook installation.
- [ ] Bootstrap prompt generation.
- [ ] MCP stdio server exposing context/get/patch/check/suggest/change/schema.
- **Exit:** end-to-end agent loop on a fixture repo with zero validation errors.

### P4 — Local server (1–1.5 days)

- [ ] HTTP server, token/Host/Origin security, path confinement, secure static serving.
- [ ] REST endpoints from spec §14.2 (core subset + export/code/prompt).
- [ ] WebSocket live events, reconnect semantics, subscribe.
- [ ] Atomic writes, `baseRev` conflict response and same-map rebase.
- [ ] Chokidar watcher with self-write suppression, last-good state and error broadcast.
- **Exit:** integration tests for auth, traversal, ops conflict, WS event and watcher update.

### P5 — Viewer (3–4 days)

- [ ] Three-pane shell, top bar, sidebar filters, inspector, problems/activity panel.
- [ ] Hand-drawn deterministic SVG canvas, pan/zoom/fit, minimap for large maps, tooltips.
- [ ] View/edit modes: drag/pin, add node, connect, label/description edit, annotations/stickies, lock/unlock, reset layout.
- [ ] Live update pulse/toast with viewport and selection preservation; error banner + last good version.
- [ ] Tabs: Maps, Changes, Timeline, Phases, Notes, Coverage.
- [ ] Diff overlay (added/removed/modified) and change traversal.
- [ ] Timeline scrubber, phase filter/thumbnails, walkthrough player, beginner mode + glossary.
- [ ] Accessibility: list view, keyboard nav, reduced motion, contrast, ARIA.
- [ ] Empty/loading/error states, first-run prompts, shortcuts, settings.
- **Exit:** `npm run build` produces a served viewer that completes F1–F6 flows.

### P6 — Exports, tests, docs, demo (2 days)

- [ ] SVG / Mermaid / Markdown / Excalidraw-compatible export; static export and PR summary.
- [ ] Unit, integration, layout fuzz, API contract, viewer build checks; optional Playwright smoke.
- [ ] README, quick start, format reference, agent setup, troubleshooting.
- [ ] Demo project (`demo/`) with maps, notes, changes, phases and a seeded git history.
- [ ] `REMAINING.md` reconciled against reality; screenshots captured.
- **Exit:** clean install → `npx vibemap init` → demo viewer works; all checks green.

### P7 — Hardening (cut if time runs out; tracked in REMAINING.md)

- [ ] Playwright E2E and screenshots on Windows.
- [ ] Performance pass against §25.
- [ ] PNG/headless render, Mermaid rendering, Excalidraw adapter.
- [ ] `migrate`, doctor depth, CI workflow, package publishing (blocked on name).
- [ ] Full accessibility audit, cross-platform matrix, security audit.

---

## 2. Architecture as built

```
D:\visu-code
├─ src/
│  ├─ core/          # pure-ish domain: types, schema, yaml, validate, evidence, layout,
│  │                 # ops, diff, scanner, drift, coverage, context, journal, changes, phases
│  ├─ server/        # http api, ws, watcher, security, history adapter
│  ├─ cli/           # command entry + output formatting
│  └─ agent-kit/     # rules files, managed blocks, hooks, bootstrap, MCP
├─ viewer/           # React + Vite; imports src/core directly; CanvasAdapter + SVG canvas
├─ test/             # vitest unit/integration/property tests
├─ fixtures/         # ts-web, python-api, monorepo, empty, hallucination
├─ demo/             # dogfooded demo project with .vibemap/
├─ docs/             # format, agents, architecture, troubleshooting
├─ scripts/          # demo seeding, screenshots
├─ dist/             # cli.js + web/ (built, gitignored)
├─ PLAN.md
└─ REMAINING.md
```

Data flow:

```
agent/human → CLI patch / viewer ops ──▶ ops engine
                                         ├─ validate (schema + semantic)
                                         ├─ atomic YAML write
                                         ├─ journal snapshot
                                         └─ WS event
fs watcher ──▶ parse → last-good cache → WS map.changed/error
viewer ──▶ layout(IR, sidecar, previous) → SVG scene → interactions
history ──▶ journal + git show → diff
scanner ──▶ facts.json → evidence / drift / coverage / suggest
```

---

## 3. Definition of done for this delivery

Functional:

1. `npm install && npm run build` succeeds on Windows.
2. `npx vibemap init`, `map new`, `patch`, `check`, `change add`, `view` work from the built CLI.
3. Viewer renders graph + sequence + ERD maps, supports pins, node add/connect/label edit, annotations, locks, live updates, diff, timeline, phases, notes and coverage.
4. Agent rules files and hook commands are generated; `vibemap context` returns a compact digest.
5. Validation catches the documented hallucination/drift cases on fixtures.

Quality:

- Unit/integration/property suite green (`npm test`).
- `tsc --noEmit` green.
- No known data-loss path: atomic writes, locks, baseRev conflicts.
- README + docs + `REMAINING.md` accurate.
- No secrets read, telemetry or network calls.

---

## 4. Sequencing and checkpoints

| Checkpoint | Deliverable | Verification |
|---|---|---|
| C0 | Plan + scaffold | `npm run typecheck` |
| C1 | Parser/validator/scanner | fixture tests |
| C2 | Ops/layout/diff | unit + fuzz tests |
| C3 | CLI + agents | `vibemap check` on fixture; context output |
| C4 | Server | API integration tests |
| C5 | Viewer | built app served; screenshots |
| C6 | Docs/demo/remaining | clean-run walkthrough |

Commits are made at each checkpoint so the dogfooded project has meaningful history.

---

## 5. Risks and mitigations specific to this build

| Risk | Mitigation |
|---|---|
| Scope is a multi-week product; token/time budget finite | Strict MVP cut: core loop + viewer + docs first, advanced exports/headless/E2E last. `REMAINING.md` is updated continuously, not at the end. |
| Excalidraw/ELK API risk | Isolated adapters + in-house deterministic renderer/layout; exports remain compatible. |
| YAML comment preservation is subtle | Apply patches through the YAML Document API; round-trip tests with comments. |
| Windows path/rename semantics | Normalise to `/` in data, test atomic rename, resolve real paths. |
| Viewer complexity | In-house SVG avoids canvas library churn; progressively enhance tabs. |
| Installer/agent formats drift | Table-driven generators; one managed-block implementation; `doctor` reports targets. |
| Running out of context | Write focused modules, keep docs current, commit frequently, final `REMAINING.md` before wrap-up. |

---

## 6. Immediate execution order for this session

1. Scaffold + contract types + build.
2. Core validation + fixtures + tests.
3. Ops + layout + tests.
4. CLI + agent kit + demo.
5. Server + API tests.
6. Viewer + screenshots.
7. Docs + REMAINING.md + final verification.

Status is updated in `REMAINING.md` as checkpoints land.
