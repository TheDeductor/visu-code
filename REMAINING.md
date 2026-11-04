# Remaining work

Updated 2026-11-05. This is the honest ledger for a **working MVP**, not a
shipped product. Core paths are implemented and tested; the gaps below are real.

## Verified working

- `init`, `scan`, `context`, `check`, `drift`, `inspect`, `patch`, `lock`,
  `change`, `phase`, `history`, `diff`, `render`, `pr-summary`, `doctor`,
  `migrate`, `eject`, `bootstrap`, `hook`, `mcp`, `view`.
- Validator rules E001–E016 and W101–W115, evidence statuses, coverage, locks,
  drift, hidden files, severity ordering, `--json`, `--fix` for safe repairs.
- Comment-preserving atomic YAML ops, cascades, idempotent structural writes,
  journal snapshots, rebase conflict flow, pin/annotation sidecars.
- Scanner for TypeScript AST, Python, Prisma, routes/models/env/deps/entrypoints,
  incremental cache, secret-file hash-only handling.
- Local server: token, Host/Origin, traversal protection, WS live updates,
  conflicts, layout, notes, changes, phases, search, code preview, exports.
- Viewer: overview/feature maps, graph/sequence/ERD/Mermaid views, search,
  diff ghosts, timeline, phases, notes, coverage, locks, add/connect/delete,
  drag-to-pin, sticky, annotations, comments, export menu, light/dark.
- **52 tests pass** (validator, ops atomicity/comments/locks, 30-seed layout fuzz,
  scanner/drift/history incl. nested repos, diff, server auth/traversal/WS/export).
- Diff now uses stored per-change baselines; verified HTTP export and SVG download.

## Release blockers

1. **npm name collision.** `vibemap` is taken on npm; `package.json` is private.
   Choose a scope and publish flow.
2. **Packaging.** No `LICENSE`, `CHANGELOG`, CI workflow, or install smoke test
   from a packed tarball. `files` ships all of `dist`, including sourcemaps.
3. **No cross-platform matrix.** Exercised on Windows only; path and hook quoting
   on macOS/Linux are untested.
4. **Schema migrations.** `migrate` is minimal; no fixtures for old schemas beyond
   the current version.
5. **Large maps.** Canvas renders every node/edge; no virtualization above ~200
   elements. Cap is 36 nodes per map, which masks this but overviews + groups
   still get busy.
6. **PNG export** is a clear-error stub. Implement server-side rasterization or
   client canvas export with `foreignObject` fallback.

## High priority

- **Viewport persistence.** Sidecar has `viewport`, but the viewer does not save
  it on pan/zoom; reopening a map refits.
- **Undo/redo.** Delete and drag have no undo. Journal exists but no UI path.
- **Connect/disconnect keyboard path.** Connect mode is pointer-only; edges can
  only be removed by selecting an edge label (thin target).
- **Mobile/narrow layout.** Read-only at <1100 px; inspector hide leaves no sheet
  to inspect a tapped node.
- **`check --fix` breadth.** Handles missing hints/ids only; no batch evidence
  repair or stale-lock cleanup.
- **Annotation tools.** Arrows are straight only; no freehand drawing, resize,
  rotate, or z-order.
- **Mermaid rendering.** Source is validated and shown, not laid out as native
  geometry; export round-trips only.
- **Timeline semantics.** Journal points interleave with git commits; sealed
  changes should filter/jump, and a “previous change” shortcut is missing.
- **Static export history.** Site snapshots exist per map, but change log and
  timeline are not linked from pages.
- **PR summary edge cases.** Rename detection and lock-aware notes are heuristic.

## Medium priority

- Sidebar search is wired, but filters (kind/status/phase) are not all exposed.
- First-run tour is stored in `localStorage` only; no “show again” in settings.
- No minimap; panning large maps loses orientation.
- Layout stability is good for appends but re-ranks on some edits; record a
  goldens suite for stability ratios and edge crossings.
- Inspector “Peek” has no syntax highlighting and no line-range controls.
- Phases list lack drag/reorder and start/done confirmation.
- Notes list lacks search, rename, delete and backlink graph.
- Exports lack a size/success toast; download failures are only console errors.
- Server has no rate limiting, gzip, or ETag caching.
- `doctor` reports but cannot auto-repair common cache/lock issues.

## Low priority / polish

- Viewer icons are text glyphs; replace with a consistent icon set.
- Some empty states and toasts are terse.
- Keyboard focus rings exist but modal focus trapping is incomplete.
- No i18n; all strings are English.
- Theme editor only sets mode/accent; no typography controls.
- Benchmark suite missing: startup, scan, check, layout, hook latency.
- Post-edit hook measured **~120 ms**, above the 100 ms target, because Node
  process startup dominates. A resident helper or compiled binary would fix it.
- `.commandcode/` is an empty editor artifact; intentionally ignored.

## Test gaps

- CLI end-to-end tests (currently manual; MCP/hooks were exercised by scripts).
- Browser tests for add-edge, new map, settings, narrow layout, keyboard nav,
  annotation drag and error recovery.
- Property tests for YAML round-trip and validator invariants.
- Concurrency test for two simultaneous writers beyond the single conflict path.
- Nested subdirectory tests exist for history; add drift/pr-summary coverage.
- Accessibility audit (axe) and screen-reader pass.
- Performance tests for scan cache hit rate and 36-node layouts.

## Operational notes

- The server must be stopped with `Ctrl+C` (or the job handle); a stale
  `.vibemap/.cache/server.json` is replaced on next start.
- Fixture demo was built interactively and contains journal noise from QA runs;
  commits `b420df4`/`81f838e` are the clean narrative points.
- Re-run `npm test`, `npm run typecheck` and `npm run build` after any change.
