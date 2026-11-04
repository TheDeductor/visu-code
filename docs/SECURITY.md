# Security model

VibeMap is a local developer tool. It assumes one trusted user on one machine.

## Server

- Binds `127.0.0.1` by default; `--host 0.0.0.0` is opt-in.
- Generates a random per-process token. The viewer receives it in the injected
  bootstrap payload; API clients send `x-vibemap-token` or `Authorization: Bearer`.
- Checks the `Host` header against `127.0.0.1`/`localhost`/the configured host
  and port, blocking DNS-rebinding style access.
- Checks `Origin` on mutating requests when present.
- Serves only allowlisted static files and confines paths to the project root.
- Viewer API bodies are size-capped; JSON shape errors return `400`.

## Secrets

The scanner inventories secret-like files (`.env`, `*.pem`, `*.key`, credentials
files) by path and hash but **does not read their contents** into `.vibemap`.
`/api/code` refuses to return secret-file contents.

Do not paste secret values into node descriptions, notes or maps.

## Paths and writes

- Map IDs are validated and cannot escape `.vibemap`.
- Refs are project-relative; `..` and absolute refs are rejected where required.
- Writes are atomic (temp file + rename) and patched YAML preserves comments.
- Sidecar files are machine-owned and pruned when nodes disappear.

## Git history

The server reads commits with `git show`/`git log` and does not execute repository
hooks or arbitrary shell from project files. `check` never runs project code.

## Known limits

- A token in the URL (`?token=`) can leak through shell history or screen shares;
  it is single-session and process-local.
- Any process on the machine can read `.vibemap/`; locks are advisory.
- Static HTML export has no auth and embeds map content; host it deliberately.
- No multi-user accounts, TLS, CSRF double-submit, or remote hardening.
- MCP is trusted stdio; the client can call destructive ops.
- `init --hooks` installs a local pre-commit hook; review it before committing.

## Reporting

This is a pre-1.0 project; security findings are best handled as repository
issues with reproduction steps and the affected commit.
