# 04: Implementation prompts (give to your coding model one at a time)

Rules for you, the operator:

- Give one prompt at a time. Do not continue until the gate passes and you have read the numbers it reports.
- Ask for the before/after metrics table every time. Without it you cannot tell a real improvement from a shuffled one.
- If a gate fails, the model must stop and report, not edit the test or loosen a threshold.
- Commit after each green prompt so you can roll back.

Standing rules to paste at the top of every prompt:

```
RULES
- Do not change map/sidecar file formats unless the prompt says so.
- Do not delete or weaken existing tests. Do not change thresholds to make tests pass.
- If a requirement cannot be met, stop and report which assertion fails and why.
- Keep the old engine working until the prompt says otherwise.
- End with: files changed, tests added, and the metrics table.
```

## Prompt 1: Measure (no behaviour change)
Add layout quality measurement. Do NOT change layout behaviour.

1. Create `src/core/layout-quality.ts` exporting `layoutQuality(layout: LayoutResult): LayoutQualityMetrics` with:
   `nodeOverlaps` (node-node, with `theme.nodeMargin` or 16 if unset), `groupOverlaps`, `groupContainmentViolations` (a node whose group is not G but whose box lies inside G's rect), `edgeNodeCrossings` (any edge segment, sampled along path/points, intersects a non-endpoint node rect inflated by 6px), `edgeCrossings` (edge-edge segment intersections excluding shared endpoints), `labelOverlaps` (edge label rect vs any node rect, other label rect, group header band), `maxNodeDegree`, `aspectRatio`, `bends`.
   For edges that only have a cubic Bezier path, sample 24 points along it.
2. Add `vibemap inspect <map> --json` output of these metrics (extend the existing inspect command).
3. Add `test/layout/baseline.test.ts` that runs every map in `.vibemap/maps` with the CURRENT engine and prints a table. It must not fail on the numbers; it only asserts the function runs and returns finite numbers. Save the table to `docs/layout-baseline.md`.
4. Add unit tests for `layoutQuality` with 6 hand-made layouts (overlapping nodes, overlapping groups, edge through node, crossing edges, overlapping labels, a clean layout with all zeros).

**GATE:** tests pass; `docs/layout-baseline.md` exists with one row per map (nodes, edges, and every metric). Report the table.

## Prompt 2: Validator rules for content
Add content-density validation rules. Layout is not needed for these.

Add to `src/core/validate.ts`, with unit tests (one positive and one negative fixture per rule):
- E017: node count above the hard cap for the map's level (overview 12, feature 16, detail 20). Make caps configurable under `limits` in `config.yaml` with those defaults.
- E018: `edges / nodes > 2.0`.
- W120: any node with degree > 5.
- W122: more than 60% of edges have a label.
- W123: more than 4 groups.
- W124: rank depth > 6 (use the existing `rankNodes`).
- W125: map type graph where >= 60% of nodes are kind process or file AND the longest path covers >= 70% of nodes; suggest `type: sequence`.
- W126: cross-group edges > 50% of edges.
Also lower the default `maxLabelChars` to 24 for node labels and edge labels (warning, not error).
Each message must include a one-line hint (see the hints in `docs/layout/03-agent-instructions.md`, section 2).

**GATE:** all new tests pass; running `vibemap check` on the current `.vibemap` prints which of the maps now violate which rules. Paste that output. Do NOT edit the existing maps yet.

## Prompt 3: Agent guide
Update `src/agent-kit/guide.ts` (generator of `AGENT_GUIDE.md`) and `src/agent-kit/rules.ts` (managed blocks).

1. Replace/add sections exactly as given in `docs/layout/03-agent-instructions.md` section 3 ("Choose the right map type first", "Size and density rules", "Structure rules", "Process", "Things you must never do"). Interpolate numbers from config limits instead of hard-coding them.
2. The managed block in every rules file must stay under 12 lines and include: read `AGENT_GUIDE.md`; steps over time -> sequence; overview <= 9 nodes, feature <= 10, <= 4 groups, edges <= 1.5 x nodes; treat W120-W127 as errors.
3. Snapshot tests for the generated guide and each managed block (agents: claude-code, cursor, codex, copilot, gemini, windsurf, aider).
4. Run `vibemap agents sync` on this repo.

**GATE:** snapshot tests pass; the generated guide contains the map-type table; managed blocks are within the length limit.
Then (separate commit): rebuild the `00-overview` and `agent-workflow` maps by hand following sections 4.1 and 4.2 of `docs/layout/03-agent-instructions.md`, run `vibemap check`, and report remaining warnings.

## Prompt 4: ELK spike behind an interface (compare, do not switch yet)
Create a `LayoutEngine` abstraction and an ELK implementation. Do NOT change the default engine.

Context: ELK is licensed EPL-2.0. Add `elkjs` as a dependency only inside the package that needs it, lazy-loaded; add its licence text to `THIRD_PARTY_NOTICES`. If the licence check in this repo (if any) blocks it, stop and report.

1. `src/core/layout-engine.ts`: interface `LayoutEngine { name: string; layout(map, theme, options): Promise<LayoutResult> }`.
2. Wrap the existing `layoutMap` as `LegacyEngine` (async wrapper).
3. `src/core/layout-elk.ts`: `ElkEngine` for graph maps only (others delegate to Legacy):
   - Groups become ELK child nodes containing their members; set `'elk.hierarchyHandling': 'INCLUDE_CHILDREN'`.
   - Options: algorithm layered; direction from `map.direction`; edgeRouting ORTHOGONAL; rankSep 100, nodeSep 48, edge-node 24, edge-edge 16; group padding top 44 left/right 32 bottom 28. VERIFY every option name against the ELK reference before using it; if a name does not exist, report it instead of guessing.
   - Measure node sizes with the existing `measureNodeBox`; pass edge labels as ELK labels with measured width/height.
   - Map ELK sections to `LayoutEdge.points` (full polyline) and `path` (polyline with rounded corners, radius 10). Map ELK label positions to `labelPos`.
   - Keep ids and the `LayoutResult` shape. Pinned nodes: not in this prompt.
4. A script `scripts/compare-layouts.ts` that runs every map in `.vibemap/maps` with both engines and with these ELK variants: nodePlacement BRANDES_KOEPF / LINEAR_SEGMENTS / NETWORK_SIMPLEX, and direction RIGHT vs DOWN. Output `docs/layout-comparison.md`: one row per (map, engine, variant) with `layoutQuality` metrics and layout time in ms.
5. Make the callers that need layout able to await (viewer, inspect, render, check). Do not remove the sync API; add async versions next to it.

**GATE:** scripts run; `docs/layout-comparison.md` exists.
**DECISION (do not make it yourself, report it):** for each map, which engine/variant has lower `edgeCrossings`, and are the hard metrics (`nodeOverlaps`, `groupOverlaps`, `groupContainmentViolations`, `edgeNodeCrossings`, `labelOverlaps`) zero? Give a one-paragraph recommendation.

## Prompt 5: Switch the default (only if the human approves after Prompt 4)
Based on `docs/layout-comparison.md` the approved default is: `<fill in: engine + variant>`.

1. Make that the default for graph maps via `theme.yaml` `layoutEngine: elk | legacy` (default elk). Keep legacy selectable.
2. Add W121 (crossings above `max(2, 0.25 * edges)`) and E-HARD-LAYOUT (any hard metric > 0) to `vibemap check`, running layout headless with the selected engine.
3. Add `test/layout/fixtures.test.ts`: for every map in `.vibemap/maps` and a seeded fuzz set of 100 graphs (3-20 nodes, 0-4 groups, edge ratio 1.0-1.6): assert all hard metrics are 0 and determinism (two runs equal). The fuzz set must respect the limits in section 1 of `docs/layout/03-agent-instructions.md`.
4. Playwright: open `00-overview` and `agent-workflow`; assert initial zoom >= 0.7 and no console errors.

**GATE:** all pass. Report the final before/after metrics table against `docs/layout-baseline.md`.

## Prompt 6: Viewer and export polish
Update `viewer/src/canvas/MapCanvas.tsx` and `src/core/render.ts`.

1. Draw edges from `LayoutEdge.points` as a polyline with rounded corners (radius 10); keep arrow markers.
2. Edge labels: draw a text halo (stroke `var(--canvas-bg)` width 4, `paint-order: stroke`) instead of an opaque rect. In the SVG export use `theme.colors.background` for the halo (it currently hard-codes white).
3. `fit()`: `zoom = clamp(fit, 0.7, 1.25)`. If clamped, centre on the root node (first node of rank 0) and show a small hint "Zoomed for readability. Press Fit all". Add a "Fit all" button that ignores the floor. Refit when layout width or height changes by more than 15%.
4. `renderExcalidraw`: export polylines as arrow elements with all points (not only `points[3]`); labels positioned from `labelPos`.
5. Make group box fill contrast with the dark theme (group fill alpha 0.12, dashed stroke 1.5) so groups are visible but do not hide edges. Group labels in the top-left header band.

**GATE:** Playwright screenshots for `00-overview` and `agent-workflow` saved to `docs/screens/`; zoom >= 0.7; SVG export of each map opens and contains no opaque white label boxes.
Report any visual issue you notice in the screenshots instead of fixing it silently.

## Prompt 7: Pinned nodes
Implement the pinned-node policy from `docs/layout/02-layout-strategy.md` section 4.

1. After the engine runs, override pinned nodes' x,y,w,h from the sidecar.
2. Re-route only edges incident to pinned nodes with a simple orthogonal router (L or Z), then check against inflated obstacles; if it fails fall back to a straight segment and add warning `W-PINNED-ROUTE`.
3. Recompute group boxes to contain pinned members; if two group boxes then overlap add `W-PINNED-GROUP` and do not move anything.
4. Remove the spiral search (`resolveOverlaps`) from the legacy path only if no test depends on it; otherwise leave it for Legacy and do not use it for ELK.
5. Tests: pinned node exact coordinates; pinned node moved outside its group enlarges the group; pinned collision produces the warning.

**GATE:** tests pass; hard metrics remain zero for maps with no pinned nodes.

## Prompt 8: ERD and sequence
1. Sequence layout: participant gap = `max(60, widest label of messages between adjacent participants + 24)`; messages that span several participants use the span's total width. Wrap long labels. Row gap = `max(58, wrapped label height + 24)`. Test: no label overlaps a lifeline of a non-involved participant.
2. ERD: run through `ElkEngine` first (directed relations, ports on field rows if ELK supports it; otherwise anchor to the nearest side). Compare with the existing grid via `compare-layouts` and keep the better one by `edgeCrossings`. Report the numbers.

**GATE:** tests pass; table of before/after for ERD and sequence maps.

## Prompt 9: Close the loop with real agent runs (manual by you)
(Not for the coding model. You run it.)
Run the five scenarios from `docs/layout/03-agent-instructions.md` section 6 with each agent you care about. Record in a table: scenario, agent, map type chosen, nodes, edges, check warnings, crossings, whether a human had to fix it. If under 80% pass untouched, tighten the guide wording or limits and rerun; do not change the engine.
