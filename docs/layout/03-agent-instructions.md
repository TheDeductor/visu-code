# 03: Agent instructions, constraints and new validator rules

Why this file matters: the engine can only draw what the agent writes. Your own diagnosis says the agent violates the limits. So tighten the rules **and make violations fail `vibemap check`** so the agent has to fix them.

Numbers marked (heuristic) are my engineering proposals, not from a source. Tune them on your own maps.

## 1. New limits (replace the current ones in `config.yaml` defaults)

| Limit | Current | Proposed | Notes |
|---|---|---|---|
| Overview map soft / hard nodes | 15 / 30 | **9 / 12** (heuristic) | Overviews are for orientation |
| Feature map soft / hard nodes | 15 / 30 | **10 / 16** (heuristic) | Split beyond this |
| Detail map hard nodes | 30 | **20** (heuristic) | |
| Edges per node (ratio) | none | **≤ 1.5** warn, **≤ 2.0** error | Dense graphs cannot be drawn cleanly |
| Groups per map | none | **≤ 4** | |
| Max node degree | none | **≤ 5** warn | Hubs create tangles |
| Label length | 40 | **≤ 24** nodes, **≤ 24** edge labels | |
| Edge labels | any | label **≤ 60%** of edges | Unlabelled is cleaner |
| Layers (rank depth) | none | **≤ 6** | Longer = split or use sequence |

## 2. New validator rules (add to the existing catalogue)

| Code | Level | Rule | Hint text the agent sees |
|---|---|---|---|
| E017 | error | Map over per-level hard node cap | "Split into a feature map and link with `drill`." |
| E018 | error | Edge/node ratio > 2.0 | "Remove edges that do not change understanding, or split the map." |
| W120 | warn | Node degree > 5 | "Hub node. Group its targets and connect to the group once, or split." |
| W121 | warn | Layout crossings above threshold (needs layout) | "Too many crossings. Reduce edges, regroup nodes, or split the map." |
| W122 | warn | More than 60% of edges labelled | "Keep labels only where the relationship is not obvious." |
| W123 | warn | More than 4 groups | "Merge groups or split the map." |
| W124 | warn | Rank depth > 6 | "Long chain. Use a sequence map or split." |
| W125 | warn | Map looks like a process (≥ 60% nodes kind `process`/`file`, edges form one chain) but `type: graph` | "Use `type: sequence` or a `down` flow of ≤ 8 steps." |
| W126 | warn | Cross-group edges > 50% of all edges | "Groups do not match the real structure. Regroup." |
| W127 | warn | Edge connects to an ungrouped node that is far in rank from its neighbours (skip edge spans > 2 ranks) | "Long edge. Consider an intermediate node or remove it." |
| E-HARD-LAYOUT | error | Any hard quality metric non-zero after layout (node overlap, group overlap, foreign node in group, edge through node, label overlap) | "Layout engine bug or pinned conflict. Run `vibemap inspect`." |

Message format stays the same as before (code, file:line, message, hint, fix).

## 3. Replacement text for `AGENT_GUIDE.md` (the sections to add or replace)

```md
## Choose the right map type first
| You want to show | Use | Not |
|---|---|---|
| What the system is made of, at a glance | `graph`, level `overview`, ≤ 9 nodes | everything in one map |
| One feature's components | `graph`, level `feature`, ≤ 10 nodes | |
| A step-by-step flow over time (requests, an agent workflow, install steps) | `sequence` | a graph with groups |
| Database tables and relations | `erd` | a graph |
| Something none of the above can say | `mermaid` | |
If your description of the map contains "first… then… finally", it is a **sequence**.

## Size and density rules (hard)
- Overview ≤ 9 nodes. Feature ≤ 10. Never more than 4 groups.
- Edges ≤ 1.5 × nodes. If a node has more than 5 connections, it is a hub: put its targets in one group and draw ONE edge to the group, or split the map.
- Every edge must change the reader's understanding. Do not draw "obvious" edges (everything → logging, everything → config).
- Label at most 60% of edges. Labels ≤ 24 characters, verb phrases ("reads config", not "this reads the config file").
- Node labels ≤ 24 characters. Put detail in `description` (≤ 200 chars) or a note.

## Structure rules
- Left-to-right or top-to-bottom flow: sources/inputs first, outputs/stores last.
- Groups = real boundaries (process, layer, team). A node belongs to **one** group.
  Do not create a group for fewer than 2 nodes.
- Prefer layers: at most 3 to 4 stages in the main direction.
- Do not connect across more than 2 stages; add an intermediate node or drop the edge.
- Drill down, do not pile on: if a node deserves detail, give it a `drill` map.

## Process (always)
1. `vibemap context --area <x>`, then decide the map type from the table above.
2. Write the smallest map that answers one question. Name the question in `summary`.
3. `vibemap check`. Treat W120 to W127 as errors to fix, not noise.
4. `vibemap inspect <map>`: crossings should be ≤ 2 for overview, ≤ 4 for feature maps.
   If higher: remove edges, regroup, or split. Do not "fix" it by adding nodes.
5. Only then `vibemap change add`.

## Things you must never do
- Never add nodes to make a diagram look complete.
- Never add an edge from every node to a shared utility.
- Never exceed limits and rely on the layout engine to cope.
- Never place or size anything. Never edit `layouts/`.
```

## 4. Worked examples (what "good" looks like)

### 4.1 `00-overview` for VibeMap: 9 nodes, 3 groups, ~10 edges (instead of 14 nodes, 4 groups, 16 edges)
```yaml
schema: 1
title: VibeMap overview
type: graph
level: overview
direction: right
summary: Who writes maps, what processes them, and where they are shown.
groups:
  - { id: people, label: People and agents, kind: boundary }
  - { id: engine, label: VibeMap engine, kind: boundary }
  - { id: out, label: Where it shows, kind: boundary }
nodes:
  - { id: human, label: Developer, kind: actor, group: people }
  - { id: agent, label: AI agent, kind: actor, group: people }
  - { id: cli, label: CLI, kind: module, group: engine, refs: [{ path: src/cli/cli.ts }] }
  - { id: core, label: Core (validate, ops, layout), kind: module, group: engine, refs: [{ path: src/core }] }
  - { id: scanner, label: Scanner, kind: service, group: engine, refs: [{ path: src/core/scanner.ts }] }
  - { id: files, label: .vibemap files, kind: storage, refs: [{ path: .vibemap }] }
  - { id: server, label: Local server, kind: service, group: out, refs: [{ path: src/server }] }
  - { id: viewer, label: Viewer, kind: ui, group: out, refs: [{ path: viewer/src }] }
edges:
  - { from: human, to: viewer, label: views and edits, kind: flow }
  - { from: agent, to: cli, label: patch, check, kind: calls }
  - { from: human, to: cli, kind: calls }
  - { from: cli, to: core, kind: calls }
  - { from: core, to: scanner, kind: calls }
  - { from: core, to: files, label: reads/writes, kind: writes }
  - { from: server, to: files, label: watches, kind: reads }
  - { from: server, to: core, label: layout, kind: calls }
  - { from: viewer, to: server, label: REST + WebSocket, kind: calls }
```
Notes: 8 nodes, 9 edges (ratio 1.1), no hub above degree 4, flow left to right: people → engine → storage → server → viewer. Internals (drift, validator, ops, layout engine, theme, locks) live in feature maps, not here.

### 4.2 `agent-workflow` as a sequence (instead of a graph with 3 "layer" groups)
```yaml
schema: 1
title: Agent workflow
type: sequence
level: feature
summary: What an AI agent does for each change.
participants:
  - { id: agent, label: AI agent, kind: actor }
  - { id: guide, label: AGENT_GUIDE.md, kind: storage }
  - { id: cli, label: vibemap CLI, kind: module, refs: [{ path: src/cli/cli.ts }] }
  - { id: maps, label: Map files, kind: storage }
steps:
  - { from: agent, to: guide, label: read rules, kind: call }
  - { from: agent, to: cli, label: context --area, kind: call }
  - { from: cli, to: agent, label: compact digest, kind: return }
  - { from: agent, to: cli, label: patch ops, kind: call }
  - { from: cli, to: maps, label: atomic write, kind: call }
  - { from: agent, to: cli, label: check, kind: call }
  - { from: cli, to: agent, label: errors or ok, kind: return }
  - { from: agent, to: cli, label: change add, kind: call }
```
It reads top to bottom as time, has no layout problem by construction, and shows the order that the graph version could not.

### 4.3 Hub rewrite
Bad: `agent` has 5 outgoing edges to 5 command nodes.
Good: put the five commands in one group `commands`, draw one edge `agent → commands (group)` labelled "uses", and describe the commands inside the group. (If your schema does not allow edges to groups yet, add that; it is the single most effective declutter for hubs. Add as a separate small task.)

## 5. Per-agent notes (rules-file text stays short)
The managed block in `CLAUDE.md` / `AGENTS.md` / `.cursor/rules` should only contain: read `AGENT_GUIDE.md`, the map-type table headline ("steps over time → sequence"), the three hard limits (≤ 9/10 nodes, ≤ 4 groups, edges ≤ 1.5×nodes), and "treat W120 to W127 as errors". Everything else stays in `AGENT_GUIDE.md` so rules files stay small and consistent across agents.

## 6. After changing the guide
- Run `vibemap agents sync` to regenerate the managed blocks.
- Re-bootstrap your own 7 maps with the new guide and compare quality numbers (before/after table is the proof the guide works).
- Evals: take 5 fixed scenarios ("add an endpoint", "rename a module", "add a feature with 6 components", "document a request flow", "document a DB schema") and run each through your agents; record the share of maps that pass `check` with zero W120 to W127 without human help. Target ≥ 80%.
