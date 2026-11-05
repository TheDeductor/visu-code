---
schema: 1
id: 20261105-2158-add-7-visual-documentation-maps
title: Add 7 visual documentation maps
date: 2026-11-05T21:58:26+05:30
type: docs
author: human:LOQ
maps:
  - 00-overview
  - init-flow
  - agent-workflow
  - diagram-pipeline
  - drift-detection
  - frontend-ui
  - user-journey
commit: null
bases:
  00-overview: 87d656cdb21f74c71c28f1f866180384519b6017
  init-flow: 01136e4a49bd06a8d4abcc9d906429b61d213953
  agent-workflow: 81a33355a9e4e1383dbc0d5267664b17f8a1a9d7
  diagram-pipeline: b330809532abca713a058278718d4c3a1a131555
  drift-detection: 294274422416e77653f6b04059f7c7a749cefd19
  frontend-ui: 7479f6c8c0c57379161bd2a0c24d71bfac38302c
  user-journey: 323a3128280d7f96bd5f4c4635bb13948175ae5e
delta:
  added_nodes:
    - 00-overview#user
    - 00-overview#ai-agent
    - 00-overview#cli-entry
    - 00-overview#cli-main
    - 00-overview#scanner
    - 00-overview#layout-engine
    - 00-overview#validator
    - 00-overview#drift-svc
    - 00-overview#ops-engine
    - 00-overview#http-server
    - 00-overview#react-app
    - 00-overview#map-canvas
    - 00-overview#vmap-files
    - 00-overview#config-files
    - init-flow#user
    - init-flow#cli
    - init-flow#init-fn
    - init-flow#guide
    - init-flow#rules
    - init-flow#scanner
    - init-flow#bootstrap
    - init-flow#disk
    - agent-workflow#agent
    - agent-workflow#agent-guide
    - agent-workflow#context-cmd
    - agent-workflow#facts-cache
    - agent-workflow#map-new
    - agent-workflow#patch-cmd
    - agent-workflow#vmap-yaml
    - agent-workflow#check-cmd
    - agent-workflow#change-cmd
    - agent-workflow#locks
    - diagram-pipeline#vmap-src
    - diagram-pipeline#layout-sidecar
    - diagram-pipeline#yaml-parse
    - diagram-pipeline#schema-validate
    - diagram-pipeline#evidence
    - diagram-pipeline#layout-graph
    - diagram-pipeline#layout-seq
    - diagram-pipeline#layout-erd
    - diagram-pipeline#map-canvas-render
    - diagram-pipeline#svg-export
    - diagram-pipeline#excalidraw-export
    - drift-detection#git-diff
    - drift-detection#pending-json
    - drift-detection#post-edit-hook
    - drift-detection#compute-drift
    - drift-detection#node-refs
    - drift-detection#drift-report
    - drift-detection#viewer-badge
    - drift-detection#agent-updates
    - drift-detection#validate-after
    - drift-detection#chokidar
    - frontend-ui#app-state
    - frontend-ui#top-bar
    - frontend-ui#sidebar-cmp
    - frontend-ui#canvas-cmp
    - frontend-ui#inspector-cmp
    - frontend-ui#problems-panel
    - frontend-ui#changes-panel
    - frontend-ui#api-client
    - frontend-ui#add-node-modal
    - frontend-ui#search-modal
    - user-journey#install
    - user-journey#init
    - user-journey#bootstrap-step
    - user-journey#agent-creates
    - user-journey#view-step
    - user-journey#browse-maps
    - user-journey#edit-maps
    - user-journey#check-step
    - user-journey#drift-check
    - user-journey#change-record
  modified_nodes: []
  removed_nodes: []
  added_edges: 95
  removed_edges: 0
---

## What changed

Add 7 visual documentation maps

## Why

Beginner-friendly visual tour of the entire VibeMap codebase.

## How it works

Describe the change in plain language here.

## Watch out

No known limits for this change.
