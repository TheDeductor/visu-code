---
schema: 1
id: 20261104-1307-plan-login-rate-limiting
title: Plan login rate limiting
date: 2026-11-04T13:07:59+05:30
type: plan
phase: hardening
author: agent:claude-code
maps:
  - auth/login-flow
commit: b420df4
delta:
  added_nodes:
    - auth/login-flow#rate-limit
  modified_nodes:
    - auth/login-flow#auth-api
  removed_nodes: []
  added_edges: 1
  removed_edges: 0
---

## What changed

Plan login rate limiting

## Why

Repeated password attempts are currently unlimited, which is a brute-force risk.

## How it works

Marked a planned rate limiter between the login handler and the session store. No code yet; the node is intentionally planned and has no refs.

## Watch out

Wire it before production; decide between per-IP and per-account limits.
