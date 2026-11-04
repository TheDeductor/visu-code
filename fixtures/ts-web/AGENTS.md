<!-- vibemap:start -->
## VibeMap (visual project memory)

This project keeps diagrams and notes in `.vibemap/`. Read `.vibemap/AGENT_GUIDE.md` once per session.

- Before changing code in an area: run `vibemap context --area <path-or-feature>`.
- After changing code: update affected maps with `vibemap patch`, run `vibemap check`, then `vibemap change add`.
- Tracking mode: **every-change**. Granularity: **feature**.
- Never edit `.vibemap/layouts/`, `config.yaml`, `theme.yaml` or `locks.json`.
- Never change or delete a locked node. Propose the change to the user instead.
- Do not invent components: every real node points at code with `refs`.

Update maps after every meaningful change.
<!-- vibemap:end -->
