# Agent integration

VibeMap is agent-agnostic. The CLI, MCP server, context digest and rules blocks
work with any tool that can run a command or read a file.

## Recommended loop

1. `vibemap context --area <path-or-feature> --budget 2000`
2. Read `.vibemap/AGENT_GUIDE.md` once per session.
3. Patch affected maps from the returned revision.
4. `vibemap check`.
5. `vibemap change add --title ... --why ... --maps ...`.
6. Hand off; a human seals the change with the commit.

Never invent refs. Planned nodes may omit them; built nodes may not.

## Managed rule blocks

`vibemap init --agents claude-code,codex,cursor,generic` writes a guarded
`<!-- vibemap:start --> … <!-- vibemap:end -->` block. The block is replaced on
re-init and the surrounding file is preserved. Supported targets:

| Agent | File |
| --- | --- |
| Claude Code | `CLAUDE.md` |
| Codex | `AGENTS.md` |
| Cursor | `.cursor/rules/vibemap.mdc` |
| Gemini | `GEMINI.md` |
| Windsurf | `.windsurf/rules/vibemap.md` |
| Generic | `AGENTS.md` |

## Claude Code hooks

`init --agents claude-code` writes `.claude/settings.json` entries equivalent to:

```json
{
  "hooks": {
    "PostToolUse": [
      { "matcher": "Edit|MultiEdit|Write", "hooks": [{ "type": "command", "command": "vibemap hook post-edit" }] }
    ],
    "Stop": [
      { "hooks": [{ "type": "command", "command": "vibemap hook stop" }] }
    ],
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "vibemap hook pre-commit" }] }
    ]
  }
}
```

- `post-edit` is handled by the thin CLI entrypoint without loading the scanner
  (about 120 ms on the development machine).
- `stop` exits `2` with a reminder while tracked files are unpatched.
- `pre-commit` exits `2` on validation errors.

If the binary is not globally linked, use the absolute path:
`node D:/visu-code/dist/cli.js hook post-edit`.

## MCP

Register the stdio server:

```json
{
  "mcpServers": {
    "vibemap": {
      "command": "node",
      "args": ["D:/visu-code/dist/cli.js", "--root", "D:/path/to/project", "mcp"]
    }
  }
}
```

Tools:

- `vibemap_context` — digest with revision and `next` hints.
- `vibemap_inspect` — layout/geometry diagnostics.
- `vibemap_check` — validation report.
- `vibemap_get_map` / `vibemap_list_maps`.
- `vibemap_patch` — dry-run or apply; accepts an `origin` of `agent`.
- `vibemap_suggest` — evidence gaps.
- `vibemap_change_add` — delta against the stored baseline.

Resources: `vibemap://maps/<id>` and `vibemap://notes/<path>` (read-only).

## Generic prompt

```text
You are working in a project with VibeMap visual memory in .vibemap/.
Read .vibemap/AGENT_GUIDE.md once. Before editing an area, run
`vibemap context --area <path>`. After editing, patch the affected map, run
`vibemap check`, and add a change entry. Use refs to real files/symbols.
```

## Boundaries

- Respect locks; propose changes instead of editing locked nodes.
- Do not edit `.vibemap/layouts/`, `locks.json`, `config.yaml` or `theme.yaml`.
- Keep secrets out of maps; scanners inventory names, not values.
- `check` warnings are acceptable only when consciously reviewed.
