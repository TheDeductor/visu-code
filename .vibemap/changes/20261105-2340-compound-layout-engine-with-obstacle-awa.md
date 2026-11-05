---
schema: 1
id: 20261105-2340-compound-layout-engine-with-obstacle-awa
title: Compound layout engine with obstacle-aware routing
date: 2026-11-05T23:40:12+05:30
type: feature
author: agent:antigravity
maps:
  - 00-overview
  - diagram-pipeline
commit: null
bases:
  00-overview: c25ae36ebd44e283e15098815a3f9d96e4960281
  diagram-pipeline: ed37b0cdbbd8b40e57061600b9fe144bdf13b218
delta:
  added_nodes: []
  modified_nodes: []
  removed_nodes: []
  added_edges: 0
  removed_edges: 0
---

## What changed

Compound layout engine with obstacle-aware routing

## Why

Eliminate node overlaps, group interleaving, and edge crossings without adding runtime dependencies

## How it works

Replaced single-layer layout with a two-level compound layout, super-graph ranking, bottom-up group bounding, long-edge dummy channels, port distribution, A* orthogonal routing, collision-free translucent labels, and 0.7 zoom floor in MapCanvas

## Watch out

No known limits for this change.
