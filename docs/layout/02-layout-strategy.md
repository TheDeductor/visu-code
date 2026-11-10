# 02: Layout and routing strategy

Goal: zero node overlap, zero group overlap, no edge passing through a foreign node, minimal crossings, readable labels, readable default zoom. Delivered by **measuring**, **constraining content**, and **swapping in a proven engine behind an interface**.

## 1. Architecture

```
VibeMap IR (graph)
   │
   ▼
 LayoutEngine interface  ── async layout(map, theme, options): Promise<LayoutResult>
   ├─ ElkEngine      (default after spike)    ← proven layered + compound + ports + orthogonal
   └─ LegacyEngine   (current layout.ts)      ← kept as fallback / comparison for one release
   │
   ▼
 post-pass (own code, small):
   - apply pinned (sidecar) coordinates
   - label placement & clearance check (if ELK labels are not enough)
   - layoutQuality() metrics
   │
   ▼
 LayoutResult  → renderSvg / renderExcalidraw / MapCanvas
```

Keep `LayoutResult` shape; change `LayoutEdge.points` to a full polyline (≥2 points). Update every consumer that assumes 4 points (`render.ts` `renderExcalidraw` reads `points[3]`; `MapCanvas` uses `edge.path`).

## 2. Why ELK, and the fallback

- Mermaid and D2 both ship ELK as the engine for harder diagrams; ELK offers layered layout with ports, orthogonal edge routing and options for compaction (file 01).
- Your existing engine reimplements those phases by hand and gets worse results on groups and routing.
- **Licence:** elkjs is EPL-2.0 (weak copyleft). Unmodified use as a dependency with its notice shipped is commonly acceptable, but confirm for your situation.
- **If ELK is unacceptable:** use `@dagrejs/dagre` (MIT) for ranking/ordering only. Costs: dagre has the most limited feature support in D2's comparison (no container sizing), so you must keep your own group box computation, port allocation and routing. Expect roughly your current quality plus fewer ordering bugs, not a step change. Libavoid is not a licence escape (MPL/LGPL).

## 3. ELK configuration to start from

Option names below are from memory of ELK's reference. **Verify each against the ELK options reference before relying on it.**

```
'elk.algorithm': 'layered'
'elk.direction': 'RIGHT' | 'DOWN'               // from map.direction
'elk.hierarchyHandling': 'INCLUDE_CHILDREN'     // lay out groups and cross-group edges together
'elk.edgeRouting': 'ORTHOGONAL'
'elk.layered.spacing.nodeNodeBetweenLayers': 100   // rankSep
'elk.spacing.nodeNode': 48                          // nodeSep
'elk.spacing.edgeNode': 24
'elk.spacing.edgeEdge': 16
'elk.padding': '[top=44,left=32,bottom=28,right=32]'   // group padding (set per group node)
'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP'
'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF'  // or NETWORK_SIMPLEX / LINEAR_SEGMENTS; compare in the spike
'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES'   // keeps agent-written order stable
'elk.portConstraints': 'FIXED_SIDE'             // only if you create ports
```
Edge labels: pass labels to ELK as edge labels **with measured width/height** so ELK reserves space (verify the label placement options); do not place labels afterwards on top of routes.

Groups map to ELK child nodes that contain their members. Edges between nodes in different groups are allowed with `INCLUDE_CHILDREN`.

Async: `elk.layout()` returns a Promise. Run it in the viewer inside a Web Worker (elkjs ships a worker entry) or lazy-load the bundle. In Node, await it.

### Compare in the spike (try each, keep the one with fewest crossings on your 7 maps)
- `nodePlacement.strategy` ∈ {BRANDES_KOEPF, LINEAR_SEGMENTS, NETWORK_SIMPLEX}
- `edgeRouting` ∈ {ORTHOGONAL, POLYLINE, SPLINES}
- `direction` RIGHT vs DOWN for overview maps

## 4. Pinned nodes (human-moved)
Hard part with any engine. Policy for v1:
1. Run the engine normally.
2. Override pinned nodes' coordinates from the sidecar.
3. Re-route only edges incident to pinned nodes with a simple orthogonal router (L or Z shape), then run the obstacle check; on failure fall back to a straight line and add warning `W-PINNED-ROUTE`.
4. Recompute group boxes to contain pinned members; if two group boxes then overlap, warn `W-PINNED-GROUP` and tell the user to "Reset layout".
Do not move pinned nodes. Do not spiral.

## 5. Quality gate: `layoutQuality(layout)` and `vibemap check`

```ts
interface LayoutQualityMetrics {
  nodeOverlaps: number;            // node-node, with margin
  groupOverlaps: number;           // group-group
  groupContainmentViolations: number;  // foreign node inside a group box
  edgeNodeCrossings: number;       // edge segment crosses a non-endpoint node (inflate 6px)
  edgeCrossings: number;           // edge-edge crossings
  labelOverlaps: number;           // label vs node/label/group header
  maxNodeDegree: number;
  aspectRatio: number;             // width/height
  bends: number;                   // total polyline bends
}
```
Hard (must be 0): `nodeOverlaps`, `groupOverlaps`, `groupContainmentViolations`, `edgeNodeCrossings`, `labelOverlaps`.
Soft thresholds (my heuristics, tune on your maps): `edgeCrossings ≤ max(2, 0.25 × edges)`, `aspectRatio ≤ 2.5`, `maxNodeDegree ≤ 5`.

`vibemap check` runs layout (headless, using the ElkEngine in Node) and turns violations into issues the agent can act on (see file 03: W120 to W127). `vibemap inspect <map> --json` prints the metrics. This closes the feedback loop: **the agent finds out the map is tangled and has to simplify it**, instead of the human discovering it in the viewer.

## 6. Labels
- Edge labels are optional clutter. Rule in file 03: label an edge only when the verb is not obvious from the node names; max 24 chars.
- Render a label with a text halo (stroke in the canvas background colour) rather than an opaque pill; use `var(--canvas-bg)` in both viewer and SVG export (the export currently hard-codes white).
- If a label cannot be placed without overlap, truncate with an ellipsis and keep the full text in `<title>`.

## 7. Viewer fit
- Initial zoom = clamp(fit, 0.7, 1.25). When clamped, centre on the root node and show "Fit all".
- Refit automatically if layout size changes by more than 15%.
- Because content limits (file 03) keep most maps small, most maps should fit at 90% to 100%; if many don't, the limits are too loose.

## 8. Other diagram types
- **Sequence:** deterministic custom layout is right (no graph layout needed). Gap = max(60, widest label between adjacent participants + 24). Wrap long labels.
- **ERD:** ELK layered also works for ERD when relations are directed and ports bind to field rows; if results are poor use a grid by degree. Start with ELK, compare.
- **Process-like content** (a linear workflow such as "agent-workflow") should be a **sequence** or a vertical flow with ≤ 8 steps, not a graph with groups. See file 03.

## 9. Order of work
1. Metrics + baseline. 2. Content limits + guide. 3. ELK spike with numbers. 4. Switch default if better. 5. Viewer label/zoom fixes. 6. Pinned policy. 7. ERD/sequence. Prompts for each are in file 04.
