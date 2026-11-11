# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-10

### Added

- **Layout Quality Gate**:
  - Deterministic layout measurement via `layoutQuality` metrics in `src/core/layout-quality.ts`.
  - Zero hard violations contract: node overlaps, group overlaps, group containment violations, edge-node crossings, and label overlaps must be 0 on valid maps.
  - Quality checks in `validateProjectAsync` with map content-hash caching in `.vibemap/.cache/layout-quality/`.
  - Layout quality rules: W121 (edge crossings threshold) and E-HARD-LAYOUT (hard violation error).
  - Pinned maps downgrade hard layout errors to `W-PINNED-ROUTE` and `W-PINNED-GROUP` warnings.

- **Content Density Validator Rules**:
  - `E017`: Per-level node caps (overview: 12, feature: 16, detail: 20).
  - `E018`: Maximum edge-to-node ratio (max 2.0).
  - `W120`: Maximum node degree limit (max 5).
  - `W122`: Maximum labelled edges ratio (max 60%).
  - `W123`: Group count limit (max 4).
  - `W124`: Maximum rank depth limit (max 6).
  - `W125`: Process-like long chain detection suggesting `type: sequence`.
  - `W126`: Cross-group edges threshold (> 50%).
  - `W127`: Rank-spanning edge warning (> 2 ranks).

- **Pinned Node Support**:
  - Exact coordinates from layout sidecar preserved.
  - Automatic group box expansion to encompass pinned members.
  - Collision detection emitting `W-PINNED-OVERLAP` and `W-PINNED-GROUP`.
  - Incident edge routing with obstacle avoidance and straight fallback producing `W-PINNED-ROUTE`.

- **Sequence & ERD Diagram Layout Refinements**:
  - Sequence diagram lifeline collision avoidance for multi-participant message spans.
  - Dynamic `pairGaps` based on widest label width + 24.
  - Row gap calculation respecting wrapped label height + 24.
  - `labelX` positioning across sequence layout, SVG exporter, and viewer canvas.
  - ERD grid layout with connected components and FK/PK field-level attachment routing.

- **Engine Architecture**:
  - `LayoutEngine` interface supporting `legacy` (default) and `elk` (opt-in).
  - Lazy-loaded ELK bundle without bloating the default viewer bundle.
  - Theme configuration schema with `layoutEngine: 'legacy' | 'elk'`.

- **CI & Tooling**:
  - Multi-OS (Ubuntu, macOS, Windows) and multi-Node (20, 22) CI workflow.
  - Robust hook detection falling back between global `vibemap`, local `.bin/vibemap`, and `npx`.

