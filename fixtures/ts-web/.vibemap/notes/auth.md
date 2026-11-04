---
schema: 1
title: Authentication and sessions
maps: [auth/login-flow]
nodes: [auth/login-flow#auth-api, auth/login-flow#session-store]
---

# Why authentication looks like this

The login form posts credentials to **POST /api/login**. The handler in
`src/routes/auth.ts` looks the user up by email and compares the password. On
success it creates a row in the `Session` table and stores the session id in an
httpOnly cookie.

## Why a server session instead of a JWT?

This app needs to revoke sessions when a user signs out or when a password
changes. A row in the database makes that trivial; a self-contained token does
not. It also keeps the browser code simple: it never needs to read the token.

## What to watch

- Session expiry is enforced in `src/session.ts`; the cookie lifetime and the
  database expiry must stay in sync.
- The planned rate limiter ([[auth/login-flow#rate-limit]]) is not built yet.
- Passwords currently live in the `User` table; hashing happens in the auth
  handler before persistence.

See [[00-overview#database]] for how sessions fit into the overall data model.
