# Layout Engine Decision: Keep Legacy for v1

**Date:** 2024-11-10
**Status:** Decided — keep legacy, ELK stays opt-in behind interface

## Evidence (from `docs/layout-comparison.md`)

| Factor            | Legacy         | ELK compound      | ELK flat           |
|-------------------|----------------|--------------------|--------------------|
| Hard violations   | **0 all maps** | Crashes 5/8        | Group violations   |
| Edge crossings    | Sometimes > 0  | 0 when works       | 0                  |
| Speed             | 0.7–12 ms      | 30–325 ms (3–50×)  | Similar            |
| Pinned support    | Full           | Not implemented    | Not implemented    |
| Determinism       | Proven         | elkjs 0.12 crashes | Partial            |

## Decision

1. **`legacy` is the default engine** — `theme.layoutEngine` defaults to `'legacy'`.
2. **ELK stays behind the `LayoutEngine` interface** in `src/core/layout-elk.ts` for future work.
3. **No ELK compound for grouped maps** — elkjs 0.12 crashes on compound hierarchy (`Cannot read properties of undefined`).
4. **`elkjs` stays as a dependency** — opt-in via `theme.layoutEngine: elk` for experimentation.

## Rationale

- Legacy engine achieves 0 hard violations (overlaps, containment, crossings) on all fixture maps.
- ELK compound crashes on 5 of 8 grouped maps due to an elkjs 0.12 bug.
- Even when ELK works, it introduces label overlaps and containment violations.
- ELK is 3–50× slower, which matters for the sync `layoutMap()` API.
- Pinned node support only exists in legacy.

## Future

- If elkjs fixes compound layout crashes, revisit.
- ELK flat mode may be useful for very large ungrouped graphs.
- The `LayoutEngine` interface allows adding dagre or other engines without API changes.

