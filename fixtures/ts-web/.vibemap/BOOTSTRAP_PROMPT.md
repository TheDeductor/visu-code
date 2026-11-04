# VibeMap bootstrap prompt

You are the coding agent for **ts-web**. Your job is to create a small, accurate, visual map of this existing project in `.vibemap/`.

Read `.vibemap/AGENT_GUIDE.md` first. It is the canonical rulebook. Then follow the steps below. Do not ask the user questions unless a fact is genuinely ambiguous; make the smallest defensible map and validate it.

## Ground truth from the scanner

- Source files indexed: **7**
- Entrypoints: `src/server.ts`
- Routes: **3**
- Data models: **3**
- Environment variables (names only): **1**
- Runtime dependencies: **2**

### Routes

- `POST /api/notes` — `src/server.ts:10`
- `POST /api/login` — `src/server.ts:8`
- `GET /api/notes` — `src/server.ts:9`

### Data models

- `Note` — `prisma/schema.prisma` (id, title, body, ownerId, owner, createdAt)
- `Session` — `prisma/schema.prisma` (id, userId, user, expiresAt)
- `User` — `prisma/schema.prisma` (id, email, password, createdAt, notes, sessions)

### Entrypoints

- `src/server.ts`

### Environment variables

- `NODE_ENV` (src/db.ts)

### Dependencies

- `@prisma/client@^5.20.0`
- `express@^4.19.2`

## What to create

1. **First**, create `00-overview` (level: overview):
   - The major runtime pieces (web app, API, worker, database, external services).
   - Group them into 2–5 boundaries (Frontend, Backend, Data, External).
   - Every real component node must have `refs` to an existing file. External services and actors use kind `external`/`actor` and need no refs.
   - Keep it to **15 nodes or fewer**.

2. **Then** create one feature map per top-level feature or flow under `maps/`:
   - Example: `auth/login-flow`, `billing/checkout`, `data/schema`.
   - Use the routes and models above as anchors. Do not invent a route that is not in this list.
   - Add edges with meaningful kinds (`calls`, `reads`, `writes`, `event`, …).
   - Add a `walkthrough` and `plain` text for any user-facing flow.

3. **Then** add notes for the two or three most important "why" explanations in `.vibemap/notes/`. Keep node descriptions under 200 characters.

4. **Validate** with `vibemap check`. Fix every error. Warnings about missing refs, duplicate labels and node count should be addressed or consciously justified.

5. **Record** the bootstrap as one change entry:
   ```bash
   vibemap change add --title "Bootstrap project maps" --why "The project had no visual map." --maps 00-overview,auth/login-flow --type docs
   ```
   (Replace the map list with the maps you actually created.)

## Hard rules

- Never write coordinates, sizes, colours, layout or evidence. The tool draws.
- Never edit `.vibemap/layouts/`, `config.yaml`, `theme.yaml` or `locks.json`.
- Use `vibemap patch` for changes; direct YAML editing is acceptable only for large initial maps.
- Every node must be traceable. If you cannot find code for it, do not add it.
- Do not add a technology just because it is common. Use only what the scanner and code show.
- Ids are kebab-case and stable. Labels are short.

## Useful commands

```bash
vibemap map new auth/login-flow --type graph --title "Login flow" --level feature
vibemap patch auth/login-flow --file ops.json
vibemap check
vibemap context --area auth
vibemap schema --format md
```

When finished, reply with: maps created, node/edge counts, `vibemap check` status, and any facts you could not verify.
