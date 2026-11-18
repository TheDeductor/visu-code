# VisuCode Frontend: Full Analysis

> Scope: the **viewer** frontend at `viewer/` (React 19 + Vite + Astryx). Written by
> reading every file in `viewer/src` and by running the real app locally
> (`node dist/cli.js --root . view`) against this repository's own `.vibemap/`,
> which has 11 maps. Nothing in the source was modified; this document is the only
> added file.

---

## 1. What the frontend is

The frontend is **not a marketing site or a multi-page app**. It is a single local
tool window ("Living visual project memory") served by the VisuCode Node server on
`127.0.0.1:4317`. One React tree renders everything:

- an app shell (top bar + map tree + canvas + inspector),
- six top-level **sections** (tabs),
- ten **modals**,
- three **full-screen states** (no token, loading, fatal error).

| Fact | Value |
| --- | --- |
| Entry HTML | `viewer/index.html` |
| Bootstrap | `viewer/src/main.tsx` (mounts `<Root />` into `#root`) |
| Root component | `Root` → `App` (`viewer/src/App.tsx`, 1429 lines) |
| Framework | React 19.2, TypeScript, Vite 8 |
| Component library | `@astryxdesign/core` 0.7.13 + `@astryxdesign/theme-neutral` |
| Styling | One global stylesheet, `viewer/src/styles.css` (2624 lines) + Stylex peer of Astryx |
| Canvas | Hand-written SVG, shapes drawn with `roughjs` (hand-drawn look) |
| Layout engine | `src/core/layout.ts` (shared with the CLI/server, run in the browser) |
| Data access | `viewer/src/api.ts`: REST `/api/*` + WebSocket `/ws` |
| Router | **None.** Tabs are component state; only the selected map is reflected in the URL |
| Total viewer source | 7,446 lines across 13 files |

Directory shape:

```
viewer/
  index.html            title, viewport, color-scheme, inline SVG favicon
  vite.config.ts        root=viewer, outDir=../dist/web, aliases @core/@viewer,
                        dev server :4318 proxying /api and /ws -> 127.0.0.1:4317
  src/
    main.tsx            Root: theme mode state + Astryx <Theme> provider
    App.tsx             shell, all state, data loading, shortcuts, live events
    api.ts              typed REST client + token handling + WS reconnect
    theme.ts            Astryx theme definition (light/dark token pairs)
    util.ts             formatting/label/path helpers
    styles.css          global design system + every layout/section rule
    canvas/MapCanvas.tsx  SVG renderer, pan/zoom/drag, graph/sequence/ERD
    components/
      TopBar.tsx        brand, section tabs, actions
      Sidebar.tsx       map tree grouped by folder
      Inspector.tsx     map or node detail panel
      Panels.tsx        8 section/bottom panels
      Modals.tsx        10 dialogs
      ui.tsx            shared primitives (Modal, Badge, Spinner, EmptyState, Toast, ProgressBar)
```

---

## 2. Boot, auth and full-screen states

1. `index.html` loads `/src/main.tsx`; `styles.css` imports Astryx reset, `astryx.css`
   and the neutral theme CSS first, so the design system is layered under
   VisuCode's own custom properties.
2. `api.ts` reads the session token from, in order: `window.__VIBEMAP__` (server
   injects this object into `index.html`), `?token=` query param, then
   `localStorage['vibemap-token']`. Every request sends `x-vibemap-token`.
   The WebSocket connects to `ws(s)://<host>/ws?token=…`.
3. `main.tsx` owns theme mode (`light` default, `dark`, persisted to
   `localStorage['vibemap:theme-mode']`), writes `data-theme` on `<html>`, and
   listens for the custom `vibemap:theme-change` event so the Settings modal can
   change the theme.
4. `App` then renders one of four screens before the shell:

| State | Trigger | UI |
| --- | --- | --- |
| Setup | no token | Centered card, "VM" logo, explanation, token paste form ("Server token (from .vibemap/.cache/server.json)"), Connect button |
| Loading | first `Promise.all([api.project(), api.maps()])` | Logo + `Spinner` "Opening your project…" |
| Fatal | 401 or first load failure | "Could not open the project" card with error message and Retry (reload) |
| App shell | success | Top bar + body + inspector + modals |

Initial map resolution order: `?map=` param → `#hash` → `localStorage['vibemap:lastMap']`
→ `00-overview` → first map. Opening a map later rewrites `?map=` with
`history.replaceState`, so maps are shareable/bookmarkable but **sections are not**.

---

## 3. Pages and "routes"

There is no router, so "pages" are: **1 shell + 6 sections + 10 modal routes + 3 boot states**.

### 3.1 Sections (`ViewerTab` in `src/core/types.ts`)

| Section | Component | What it shows | Data loaded when active |
| --- | --- | --- | --- |
| **Maps** | `MapCanvas` + `Inspector` (+ optional bottom panel) | The SVG diagram, banners, edit toolbar, walkthrough | `api.map(id)` and `api.history(id)` on map change |
| **Changes** | `ChangesPanel` | Master/detail change log (list + What/Why/How body) | `api.changes()` |
| **Timeline** | `TimelinePanel` | Time travel: range slider, tick rail, commit/journal list | `api.history(selectedMap, 80)` |
| **Phases** | `PhasesPanel` | Roadmap cards with built/planned progress, start/finish/snapshot | `api.phases()` |
| **Notes** | `NotesPanel` | Notes list + markdown reader/editor | `api.notes()` then `api.note(path)` |
| **Coverage** | `CoveragePanel` | Coverage ring, per-directory bars, gaps, unverified nodes, unmapped files | `api.coverage()` + `api.suggest(20)` |

Switching happens via `G`-chords (`g m/c/t/p/n/v`), the top-bar tab list, or the
tour. Entering Edit mode forces the Maps tab.
The configured default tab comes from `.vibemap/config.yaml` → `viewer.defaultTab`
(default `maps`), and `viewer.beginnerMode` seeds the Beginner switch.

### 3.2 Overlays inside the Maps section (in-canvas "routes")

| Overlay | Appears when | Content |
| --- | --- | --- |
| Conflict banner | map changed on disk while editing | "Apply update" + dismiss |
| Error banner | map YAML invalid | error line + "View problem" |
| History banner | viewing a past revision | summary + timestamp, Compare with now, Back to now |
| Diff banner | diff mode active | base label → now, `[` `]` hint, Exit diff |
| Phase filter banner | `Show only this phase` used | filter name + Clear |
| Bottom panel | Problems or Activity toggled | 220 px split panel with its own tabs |
| Walkthrough | map has `walkthrough` steps | step counter, text, prev/play/next/close |
| Zoom hint | auto-fit had to clamp to 70 % | "Zoomed to fit readability: Fit all" |
| Connect hint | Connect mode on | one-line instruction |
| Diff legend | diff mode | added / removed / modified swatches |

### 3.3 Modals

| Modal | File | Width | Fields / actions |
| --- | --- | --- | --- |
| `NewMapModal` | Modals.tsx | 480 | id (validated kebab/`/`), title, type (graph/sequence/erd/mermaid), level (overview/feature/detail) |
| `AddNodeModal` | Modals.tsx | 480 | label, kind (19 kinds), status (planned/built/deprecated), description; optional connect-from context |
| `EdgeModal` | Modals.tsx | 480 | edge kind (10 kinds), label |
| `StickyModal` | Modals.tsx | 480 | sticky text (stored in the human-owned layout sidecar) |
| `SettingsModal` | Modals.tsx | 480 | tracking mode + granularity, agent chips, **interface theme (light/dark)**, theme font/roughness/gap, privacy + server info |
| `ShortcutsModal` | Modals.tsx | 480 | 2-column table of 10 shortcuts |
| `TourModal` | Modals.tsx | 480 | 5-step first-run tour (shown once, `vibemap:tour-done`) |
| `PromptModal` | Modals.tsx | 720 | read-only `<pre>` of a generated agent prompt + Copy |
| `SearchModal` | Modals.tsx | 640 | `CommandPalette` over `/api/search` (maps, nodes, changes, notes) |
| Delete confirm | `AlertDialog` in App |: | destructive "Delete node?" with journal note |

`Modal` (in `ui.tsx`) wraps Astryx `Dialog` + `DialogHeader` and adds a
`.modal-body` / `.modal-foot` (right-aligned buttons on a `--panel-2` footer strip).

---

## 4. Layout and navigation structure

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ TopBar  58px: [☰][VM logo][project / map · N nodes] [6 tabs] [actions…]      │
├──────────────┬──────────────────────────────────────────────┬────────────────┤
│ Sidebar      │ Workspace                                    │ Inspector      │
│ 232px        │                                              │ 330px          │
│              │  banners (stacked)                           │                │
│ Filter maps… │  ┌────────────────────────────────────────┐  │ GRAPH          │
│ + New map    │  │ MapCanvas (SVG pan/zoom, grid, nodes,  │  │ Title          │
│ «  collapse  │  │ edges, groups, stickies, ghost diff)   │  │ summary        │
│              │  │  edit toolbar (bottom-left)            │  │ 4 stat cards   │
│ MAPS         │  │  zoom tools (bottom-right)             │  │ Evidence       │
│  ◎ 00-over…  │  │  walkthrough (bottom-center)           │  │ Nodes list     │
│  ▢ diagram…  │  │  tooltip / hints (top)                 │  │ Details        │
│ NETFLIX      │  └────────────────────────────────────────┘  │ Code refs      │
│  ▢ backend…  │  bottom panel (220px) when Problems/Activity │ Connections    │
│              │                                              │ History        │
│ Coverage 31% │                                              │ Actions        │
│ [progress]   │                                              │                │
│ bootstrap •  │                                              │                │
│ version      │                                              │                │
└──────────────┴──────────────────────────────────────────────┴────────────────┘
```

- Shell: `.app` is `display:flex; flex-direction:column; height:100vh; overflow:hidden`.
- Body: `.app-body` is a CSS grid: `232px minmax(0,1fr) 330px`.
  - `.no-inspector` → `232px 1fr` (any non-Maps section, or inspector collapsed).
  - `.sidebar-collapsed` → `1fr 330px` and the sidebar is `display:none`.
  - Both → single `1fr` column.
- Collapsing is stateful per session only (`sidebarCollapsed`,
  `inspectorCollapsed`), and each collapse leaves a floating pill button
  (`.floating-panel-toggle.left/right`) that re-expands it.
- Inspector exists only on the Maps section with a map loaded; other sections use
  the full width (`.panel-page`, padded `24px 28px 60px`, content capped at 1180 px).
- Navigation is **two-level**: sections in the top bar, maps in the left tree
  (grouped by folder with uppercase folder labels; root group renders as "maps").
- The inspector is the third navigation surface: node list (keyboard alternative
  to the canvas), connections list (jump to neighbour), history rows.

Sidebar map rows use glyph icons instead of an icon font:
`◎` overview, `▢` feature, `◌` detail, `⇄` sequence, `▤` ERD, `M` mermaid.
Each row shows node count, a type prefix for non-graph maps, error/warning count
badges, a blue drift dot, and a red stale dot for an invalid file.

---

## 5. Complete component inventory

### 5.1 Shell & entry

| Component | File | Lines | Responsibility |
| --- | --- | --- | --- |
| `Root` | `main.tsx` | 43 | Theme mode, Astryx `Theme` provider, theme-change event |
| `App` | `App.tsx` | 1429 | All application state, data fetching, WS handlers, shortcuts, modals, layout |

`App` holds ~34 `useState` values (selection, tab, mode, beginner, live status,
modal union, per-section data, walkthrough, historical, diff, pending
diff/detail/node, delete confirmation) plus refs for stale-closure-free access
(`detailRef`, `sidecarRef`, `selectedMapRef`, `modeRef`, `tabRef`, `gKey`).

### 5.2 Layout components

| Component | Props (summary) | Emits |
| --- | --- | --- |
| `TopBar` | project, detail, summary, check, tab, mode, beginner, live, problemsOpen, collapsed flags | onTab, onMode, onBeginner, onProblems, onSearch, onSettings, onHelp, onExport, onRefresh, toggles |
| `Sidebar` | maps, selectedId, filter, coverage, version | onSelect, onFilter, onNewMap, onBootstrap, onCollapse |
| `Inspector` | detail, selectedNodeId, mode, beginner, changes | onSelectNode, onUpdateNode, onDeleteNode, onLock, onStartWalkthrough, onOpenNotes, onToast, onCollapse |

`TopBar` action cluster, left → right: search `⌕`, validation pill (Popover with
"View in panel"), live dot (`live-live` green / `live-connecting` pulsing amber /
`live-offline` red), Beginner `Switch`, View/Edit `SegmentedControl`, Export menu
(hover/focus-revealed: SVG, Mermaid, Markdown, Excalidraw), refresh `↻`, help `?`,
settings `⚙`, inspector toggle.

`Inspector` has three rendering modes:

1. **Map summary** (nothing selected): `GRAPH`/`SEQUENCE`/`ERD` eyebrow, title,
   summary, four stat cards (nodes / edges / errors / locked), collapsible
   Evidence (verified/declared/stale/planned counts), optional
   "▶ Start walkthrough (n steps)", collapsible Nodes list, participants or
   entities list for sequence/ERD, Details (level, phase, file, rev) and
   "Open related notes".
2. **Node, view mode**: badges (evidence status, 🔒 locked, group, `#tags`),
   description (or plain-language in Beginner mode), collapsible Code refs with
   copy-path + **Peek** (inline code preview via `/api/code`), Connections
   (incoming `←` / outgoing `→` with edge-kind badges), History (matching change
   entries), Drill-down id, actions **Ask agent about this** / **Lock–Unlock**.
3. **Node, edit mode**: label, kind select, status select, description textarea
   (200 char cap), plain-language textarea, comma tags, editable ref rows
   (`path` + `symbol`, add/remove), then Save / Reset / Delete and the hint
   "Saving a human edit auto-locks this node".

### 5.3 Canvas

| Component | Purpose |
| --- | --- |
| `MapCanvas` | Container, viewport state, pan/zoom/wheel, drag pinning, selection, tooltip, zoom toolbar, hints, diff legend |
| `NodeText` | Label lines + optional plain-language sub-label inside a node |
| `EdgeView` | Orthogonal edge path + arrow marker, dimmed when focus filter is on |
| `EdgeLabelView` | Edge label with a canvas-coloured stroke halo so it survives crossings |
| `SequenceScene` | Participants, dashed lifelines, `alt/loop/opt` fragments, arrows, self-messages |
| `ErdScene` | Entity boxes with coloured header, PK 🔑 / FK ↗ / unique ✦ field rows, typed columns, relations |
| `roughPaths` | Memoised `roughjs` path generation (LRU-ish cache capped at 600 entries) |

Canvas behaviour:

- **Fit** = `min((w-70)/mapW, (h-70)/mapH)` clamped to `0.2–1.25`; if the natural
  zoom is below `0.7` it clamps to `0.7` and focuses the first node, then shows the
  readability hint (with its own **Fit all** escape hatch).
- **Zoom**: wheel with exponential factor (`exp(-deltaY*0.0014)`), buttons
  `×1.2`, range `0.2–2.6`, percentage label.
- **Pan**: drag the background (pointer capture). **Drag to pin** in Edit mode
  writes `{x,y,w,h,pinned:true}` to the layout sidecar (debounced 320 ms).
- **Connect mode**: click source → click target → `EdgeModal`.
- **Walkthrough**: 3.8 s auto-advance, space play/pause, arrows step, non-focused
  nodes/edges drop to 18–20 % opacity.
- **Diff**: added nodes outlined green, modified amber, removed drawn as red
  dashed ghosts from the base layout; legend top-right.

### 5.4 Section & bottom panels (`components/Panels.tsx`, 671 lines)

| Panel | Highlights |
| --- | --- |
| `ChangesPanel` | Two-column list/detail; each row has title, relative time, type, phase, sealed/unsealed badge and `+n ~n −n` `Token` chips; detail shows What/Why/How sections parsed from the body, author, commit, "View diff", "Open map", map chips |
| `TimelinePanel` | Slider + tick rail (solid = git commit, hollow = journal) + scrollable list; selected point badge "viewing"; Compare with now / Back to now |
| `PhasesPanel` | Inline "New phase" form; cards with status badge, goal, progress bar, `built/total` + planned counts; Start / Finish / View snapshot / "Show only this phase" (filters the canvas) |
| `NotesPanel` | Note list with `+ New note` (uses `window.prompt` for the title), markdown renderer (headings h1–h4, bullets, code fences, `**bold**`, `` `code` ``, `[[map#node]]` links that open the node), inline editor with Save/Cancel |
| `CoveragePanel` | Big card with conic-gradient coverage ring, per-directory `ProgressBar`s, "Gaps worth mapping" with Copy prompt, unverified/declared `Token` chips, unmapped file list (first 120) with Copy prompt |
| `ProblemsPanel` | Errors/warnings list with severity + code badges, location `file:line`, hint, "Run check", "Copy JSON" |
| `ActivityPanel` | Compact feed of change entries with map chips |
| `MapListAccessible` | Plain button list of maps (exported, not currently mounted) |

Private helpers: `Markdown` and `inline` (the mini markdown renderer).

### 5.5 Shared primitives (`components/ui.tsx`, 130 lines)

| Primitive | Wraps | Notes |
| --- | --- | --- |
| `Modal` | Astryx `Dialog` + `DialogHeader` | 480 / 720 wide, optional footer |
| `Badge` | Astryx `Badge` | Tone vocabulary `neutral｜ok｜warn｜error｜info｜planned` mapped to Astryx variants |
| `Spinner` | inline | `role="status"`, label prop |
| `EmptyState` | inline | glyph icon, title, body, action row |
| `Toast` | Astryx `Toast` | fixed bottom-right, auto-hide 4.5 s (App also clears after 4.5 s) |
| `ProgressBar` | Astryx `ProgressBar` | percent clamped 0–100, tone → variant |

Astryx components actually used: `Button`, `IconButton`, `TabList`/`Tab`, `Badge`,
`Dialog`/`DialogHeader`, `AlertDialog`, `Card`, `List`/`ListItem`, `Collapsible`,
`Selector`, `Switch`, `SegmentedControl`, `Popover`, `TextInput`, `Table`,
`Token`, `ProgressBar`, `Toast`, `CommandPalette`, `Theme`, `defineTheme`.

### 5.6 Utility layer (`util.ts`, 133 lines)

`classNames`, `relativeTime` ("just now" → "12m ago" → "3h ago" → "5d ago" → locale
date), `formatDate`, `copyText`, `downloadText`, `mapFolder`, `mapLeaf`, `mapIcon`,
`checkTone`, `issueLocation`, `mapIdFromIssueFile`, `parseBodySections`,
`nodeLabel`, `clamp`, `shortPath` (`first/…/file` truncation), `promptForFile`
(prompt text used by the Coverage "Copy prompt" buttons).

---

## 6. Design system

### 6.1 Token architecture (three layers)

1. **Astryx neutral theme** (`@astryxdesign/theme-neutral/theme.css`): base
   component styling and spacing tokens (`--spacing-2`, `--radius-md`, …).
2. **VisuCode Astryx theme** (`theme.ts`): a `defineTheme` extension of
   `neutralTheme` that overrides Astryx semantic tokens with **`[light, dark]`
   pairs**: accent, accent-muted, text/icon accent, body/surface/card/popover/muted
   backgrounds, border + emphasized border, primary/secondary text and icons, and
   success/warning/error.
3. **VisuCode CSS variables** (`styles.css` `:root` and `:root[data-theme="dark"]`) :
   the vocabulary actually used by the layout/section CSS. Dark values swap per
   the `data-theme` attribute written by `main.tsx`; many Astryx usages fall back
   to these with `var(--color-x, var(--panel-2))` style expressions, which lets the
   two systems coexist during migration.

### 6.2 Colour tokens

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--bg` | `#f5f6f8` | `#14171c` | app background |
| `--panel` | `#ffffff` | `#1c2027` | top bar, sidebar, inspector, cards |
| `--panel-2` | `#f1f3f5` | `#222831` | hover, inputs, modal footer |
| `--panel-3` | `#e9ecef` | `#2b323c` | deeper inset |
| `--ink` / `--ink-2` | `#212529` / `#343a40` | `#e9ecef` / `#dee2e6` | text |
| `--muted` | `#6c757d` | `#9aa4b2` | secondary text |
| `--line` / `--line-strong` | `#dee2e6` / `#ced4da` | `#333b46` / `#414b58` | borders |
| `--accent` / `--accent-strong` | `#1971c2` / `#1864ab` | `#4dabf7` / `#74c0fc` | selection, links, focus |
| `--accent-soft` | `#e7f5ff` | `#17324a` | active tab/row background |
| `--ok` / `--ok-soft` | `#2f9e44` / `#ebfbee` | `#69db7c` / `#173b22` | check ok, sealed, added |
| `--warn` / `--warn-soft` | `#e67700` / `#fff9db` | `#ffc078` / `#3d2c12` | warnings, modified, unsealed |
| `--error` / `--error-soft` | `#e03131` / `#fff5f5` | `#ff8787` / `#3d1a1a` | errors, stale, removed |
| `--canvas-bg` | `#fbfcfd` | `#191d23` | canvas surface |
| `--grid-dot` | `#d7dde3` | `#2e3640` | dot grid |
| `--group-fill` / `--group-stroke` / `--group-label` | rgba grey / `#adb5bd` / `#495057` | rgba slate / `#64748b` / `#e2e8f0` | group containers |
| `--shadow` | `0 1px 2px rgba(16,24,40,.05), 0 8px 24px rgba(16,24,40,.06)` | `0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.25)` | popovers, tools, modals |
| `--radius` | `10px` | `10px` | cards/tools (7–13 px used by size) |

### 6.3 Canvas palette (semantic, from `theme.yaml` defaults)

Node fill is chosen by **kind**, not by component:

| Kind group | Fill | Shape |
| --- | --- | --- |
| `ui`, `page`, `component` | `#a5d8ff` (blue) | rounded |
| `api`, `service`, `module` | `#d0bfff` (violet) | rounded / rect |
| `database`, `cache`, `storage`, `actor` | `#b2f2bb` (green) | ellipse |
| `external` | `#ffd8a8` (orange) | rect, dashed |
| `queue`, `decision` | `#ffec99` (yellow) | parallelogram / diamond |
| `note` | `#fff3bf` | sticky (folded corner) |
| default | `#e9ecef` | rect |

Ink inside nodes is computed by luminance (`contrastInk`: `#1e1e1e` or `#ffffff`).
Evidence state changes the *stroke*, not the fill: verified = solid `#343a40`,
declared = dashed `#868e96`, stale = solid `#e03131` + a red `!` corner badge,
planned = 0.6 opacity dashed, plus a grey `?` badge for declared. Locked nodes get
a blue 🔒 chip top-left; deprecated labels are struck through.
Edges are `#495057` with rounded orthogonal routing (R = 10) and arrow markers;
group containers are dashed rounded rects with an uppercase-ish bold label.
Sticky notes are `#fff3bf` with an orange border and a × delete affordance.

### 6.4 Typography

| Role | Size / weight |
| --- | --- |
| Base | `14px / 1.5` (`Inter, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif`) |
| Small / `.small` | `13px` |
| Tabs, map titles | `13px`, weight 600 |
| Brand project name | `13.5px`, 600 |
| Inspector title (`h2`) | `18px`, line-height 1.25 |
| Change detail title | `22px` |
| Stat number | `16px` |
| Micro labels, hints, meta | `12.5px`, `12px`, `11.5px`, `11px`, `10.5px` |
| Eyebrow (`eyebrow`) | `10.5px`, 700, `0.08em` tracking, uppercase, muted |
| Field labels | `11.5px` |
| Section titles | uppercase, `0.05–0.07em` tracking, muted |
| Monospace | `ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace` for `code`, `kbd`, `pre`, ids, paths, revs |

Canvas text uses its own scale from `src/core/theme.ts`: 16 px labels (14 px in
`code` theme font), 21 px line height, 18/16 px node padding, label font weight 600,
10.5–12.5 px secondary text for plain-language lines, edge labels (12.5 px, with a
4 px canvas-coloured stroke halo).

### 6.5 Spacing, radii, elevation

- No strict 4/8 scale: values are pragmatic (`4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16,
  18, 24, 28` px). Astryx spacing tokens are used where available with a numeric
  fallback, e.g. `gap: var(--spacing-2, 8px)`.
- Card/panel padding: 10–12 px for chrome, `16px 20px` for modal bodies, 24 px tall
  header rows, `padding: 24px 28px 60px` for section pages.
- Radii: 6–8 px for chips/inputs/rows, 9–10 px for panels/tools, 13 px for the large
  logo, 999 px for pills and dots.
- Elevation: only one shadow token (`--shadow`); canvas tools use
  `color-mix(in srgb, var(--panel) 92%, transparent)` for translucency.
- Motion: 150–180 ms ease transitions on hover/panel collapse, 160 ms node opacity,
  `pulse` keyframe for the connecting dot, and a global
  `prefers-reduced-motion: reduce` override that flattens all durations.

### 6.6 Iconography

Unicode glyphs only: no icon library: `☰ ◀ ▶ « » × ⌕ ↻ ⚙ ? ⇩ ◎ ◌ ▢ ⇄ ▤ ⇧ ← → 🔒
🔑 ↗ ✦`, plus the inline SVG favicon (blue rounded square, white "VM"-like path).

---

## 7. Interaction patterns

| Pattern | Behaviour |
| --- | --- |
| Selection | Click node → inspector detail; background click clears selection and starts panning |
| Hover | View mode shows a cursor-following tooltip: label · kind · status, plain/description, refs |
| Pinning | Edit mode drag writes to `.vibemap/layouts/*.layout.json` via debounced `PUT /api/maps/:id/layout` |
| Optimistic writes | Node edits go through `POST /maps/:id/ops` with `baseRev`; 409 → warn + reload |
| Conflict safety | `pendingDetail` banner keeps your unsaved inspector while offering "Apply update" |
| Toasts | Bottom-right, tone info/ok/warn/error, 4.5 s |
| Banners | Inline warning/error/info/diff strips above the canvas, each with an action |
| Destructive | Astryx `AlertDialog` confirmation, action variant `destructive` |
| Lock affordance | Locker badge on nodes + lock button in inspector; save auto-locks |
| Live status | Dot in the top bar reflects the WebSocket; three reconnecting states |
| Copy-to-clipboard | Refs paths, agent prompts, check JSON, gap prompts all copy silently with a toast |
| Empty states | Maps ("Turn this project into a map" with 3 prompt actions), Changes, Phases, Notes, Timeline, Coverage, Problems |

### Keyboard shortcuts (implemented in `App`'s window `keydown`)

| Keys | Action |
| --- | --- |
| `Ctrl/⌘ + K` | Open search palette |
| `G` then `M/C/T/P/N/V` | Go to Maps / Changes / Timeline / Phases / Notes / Coverage (900 ms chord window) |
| `E` | Toggle Edit mode |
| `B` | Toggle Beginner mode |
| `F` | Fit canvas |
| `?` | Shortcuts dialog |
| `Esc` | Exit connect mode, else clear selection |
| `Space` | Play/pause walkthrough |
| `←` / `→` | Previous/next walkthrough step |
| `[` / `]` | Cycle changed nodes while in diff mode |

Shortcuts are suppressed while a modal is open or the focus is in an
input/textarea/select/contenteditable.

### Persistence keys (localStorage)

`vibemap-token`, `vibemap:theme-mode`, `vibemap:beginner`, `vibemap:lastMap`,
`vibemap:tour-done`.

### Screen-reader / accessibility affordances present

- Landmarks: `header` (banner), `aside` (complementary: "Map navigator",
  "Inspector", "Node inspector"), `main`, `footer` inside modals.
- Roles: `tree`/`treeitem`, `radio` groups for View/Edit, `toolbar` for canvas zoom
  and edit tools, `application` for the SVG canvas, `role="button"` with `tabIndex`
  and Enter/Space handling on every node, `role="status"` for spinners.
- The inspector's **Nodes list** is explicitly labelled "the keyboard-accessible
  alternative to the canvas".
- `:focus-visible` outline uses `--accent` with 2 px offset; reduced-motion override.
- Every icon-only control has `label`/`tooltip`/`aria-label` text.
- Known rough edge observed at runtime: Astryx `Tab`/`Button` render their label
  text twice in `textContent` (visible + hidden affordance), so the DOM text reads
  e.g. "MapsMaps". The accessibility tree still exposes one name, so this is a
  minor cosmetic/snapshot annoyance rather than a screen-reader bug.

---

## 8. Responsive design patterns

The app is a desktop tool; responsiveness is "graceful degradation", not mobile
parity. Breakpoints live at the end of `styles.css`.

| Breakpoint | Changes |
| --- | --- |
| `≤ 1240px` | grid `210px 1fr 300px`; brand copy (project name/map id) hidden, brand min-width 40px; smaller tab padding; check pill 11px |
| `≤ 1040px` | grid `200px 1fr`; **inspector hidden**; `overview-grid` / `coverage-grid` collapse to one column; changes layout narrows to `280px 1fr` |
| `≤ 780px` | single `1fr` column; **sidebar hidden**, **tabs hidden**; top bar gap 8 px/padding 8 px; panel padding 16 px; changes/notes layouts single column; canvas tools pulled to 10 px |
| reduced motion | all animations/transitions ≈0 ms |

Other adaptive behaviour that is not CSS-breakpoint based:

- Canvas auto-fit on mount, on map change (`fitNonce`), and when the layout size
  changes by more than 15 %; the readability floor keeps labels legible on small
  viewports and tells the user what it did.
- Fixed minimums (232 px sidebar / 330 px inspector) mean the canvas absorbs all
  remaining space; the inspector/sidebar never shrink, they disappear.
- The map tree scrolls independently (`overflow-y:auto`); the sidebar footer
  (coverage + version) stays pinned.
- `touch-action:none` on the canvas wrap enables pointer-based pan/drag on
  touch devices, and all interactions are pointer events (not mouse events).
- Below 780 px there is no replacement for the hidden sidebar or tab bar: see
  observations.

Dark mode: the `<meta name="color-scheme" content="light dark">` plus the
`color-scheme` property set on `<html>` keep native scrollbars/inputs in the right
scheme; theme mode is user-selected (default light) and persisted.

---

## 9. State and data flow

```
main.tsx  ──themeMode──▶  <Theme theme={vibemapTheme}>  ──▶  App
                                                              │
       api.ts (fetch /api, x-vibemap-token) ◀──────────────────┤
       connectEvents (WS /ws, backoff 0.5s→10s, max retry 6) ◀─┤
                                                              ▼
    ┌──────────────┬────────────────┬───────────────┬──────────────────┐
    │ TopBar       │ Sidebar        │ MapCanvas     │ Inspector         │
    │ tabs, mode   │ maps, filter   │ layout+visual │ detail, edits     │
    └──────────────┴────────────────┴───────────────┴──────────────────┘
```

- Layout is computed in the browser: `layoutMap(map, theme, {sidecar, previous})`
  is memoised in `App` and re-run only when map/theme/sidecar change; the previous
  result is kept per `mapId:rev` to stabilise edge routing.
- Live events handled: `hello`, `map.changed`, `map.error`, `check.updated`,
  `layout.updated`, `changes.updated`, `phases.updated`, `notes.updated`,
  `config.updated`, `maps.updated`, `drift.updated`, `scan.updated`, `error`.
  Echo suppression uses timestamps (`lastOwnOp`, `lastLocalLayout`) so your own
  writes do not reload the map under you.
- Layout writes are debounced (320 ms) and fire immediately for structural changes
  (sticky add/remove, reset).
- Errors are typed (`ApiError` with `status`/`code`/`details`); 401 escalates to
  the fatal screen, 409 to a reload + warn toast, everything else to a toast.

---

## 10. How to run it locally (what was actually done for this analysis)

```bash
npm install            # dependencies already present in this checkout
npm run build          # vite build -> dist/web, tsup -> dist/cli.js
node dist/cli.js --root . view
```

The CLI prints `http://127.0.0.1:4317` (project name, map count, check summary). The
session token is written to `.vibemap/.cache/server.json` and injected into
`index.html` as `window.__VIBEMAP__`; a URL of the form
`http://127.0.0.1:4317/?token=<token>` opens the viewer. For HMR work use
`npm run dev:web` (Vite on :4318 proxying `/api` and `/ws` to :4317).

Verified in the running app: shell layout and all six sections, map tree with 11
maps in 3 folder groups, overview canvas with groups/edges/evidence badges, node
inspector (view + edit), edit toolbar, settings dialog, shortcuts dialog, search
palette, toasts, empty states for Phases/Notes, coverage ring at 30.7 %, light and
dark token values, and the responsive grid at 232/330 px.

Not verified visually: `≤780 px` layout, sequence/ERD canvases, Mermaid read-only
view, walkthrough playback, diff mode, and the setup/fatal screens (all reviewed in
source only).

---

## 11. Observations and gaps (no fixes applied)

1. **No router.** Sections, diff mode, walkthrough and filters are not linkable;
   only `?map=` survives a reload. Reload also resets mode to View and drops
   selection by design.
2. **Mobile dead-end.** At `≤780 px` both the sidebar and the tab bar are hidden, so
   panels and map switching become unreachable (no drawer, no menu).
3. **Inspector has no small-screen replacement.** It simply disappears below
   1040 px, and the floating expand pill only appears when it was collapsed by the
   user, not when CSS hides it.
4. **Two styling systems coexist.** Astryx tokens and the hand-written
   `--panel/--ink/--line` variables overlap, with fallback chains in both
   directions; some surfaces still use legacy `.btn`, `.icon-btn`, `.chip` classes
   rather than Astryx primitives.
5. **Canvas colours partly bypass the theme.** Node fills, edge strokes (`#495057`),
   evidence strokes and typography are hard-coded in `MapCanvas.tsx`/`core/theme.ts`
   while the surrounding chrome is token-driven, so dark mode relies on the canvas
   background alone to provide contrast.
6. **`window.confirm` / `window.prompt`** are still used for layout reset and new
   note titles, while everything else uses Astryx dialogs.
7. **Inline styles in components** (tooltips' `Math.min` positioning, badge wrappers,
   search rows, the readability hint button) sit outside the stylesheet, which makes
   the design system harder to audit.
8. **`onZoom` is wired but unused**: `App` passes `() => undefined`, so the canvas
   zoom level is not surfaced to the surrounding chrome.
9. **Duplicated label text in `textContent`** from Astryx tab/button internals
   (see accessibility note) shows up in DOM-based tests and snapshots.
10. **Notes have no autosave/unsaved guard**; switching notes while editing discards
    the draft silently.

---

## Appendix: file sizes

| File | Lines |
| --- | --- |
| `viewer/src/App.tsx` | 1429 |
| `viewer/src/styles.css` | 2624 |
| `viewer/src/canvas/MapCanvas.tsx` | 813 |
| `viewer/src/components/Panels.tsx` | 671 |
| `viewer/src/components/Modals.tsx` | 551 |
| `viewer/src/components/Inspector.tsx` | 476 |
| `viewer/src/api.ts` | 256 |
| `viewer/src/components/TopBar.tsx` | 159 |
| `viewer/src/util.ts` | 133 |
| `viewer/src/components/ui.tsx` | 130 |
| `viewer/src/components/Sidebar.tsx` | 121 |
| `viewer/src/main.tsx` | 43 |
| `viewer/src/theme.ts` | 40 |
| **Total** | **7446** |

Related docs already in the repository: `docs/ui/inventory.md`,
`docs/ui/theme.md`, `docs/ui/astryx-components.md`, `docs/ui/gaps.md`,
`docs/ui/setup.md`.
