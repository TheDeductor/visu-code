# VibeMap diagram quality: start here

Read this first. The other four files are the detail.

| File | What it is |
|---|---|
| `00-START-HERE.md` | Verdict, decision, order of work (this file) |
| `01-research-findings.md` | What the leading tools do, with sources, and what I could not verify |
| `02-layout-strategy.md` | The layout/routing architecture to build, and the quality gate |
| `03-agent-instructions.md` | New `AGENT_GUIDE.md` rules, new validator rules, worked examples |
| `04-implementation-prompts.md` | Small, gated prompts to give your coding model (Gemini Flash), one at a time |

## 1. Verdict on the plan you showed me

The compound-layout plan is a correct textbook design (collapse groups, rank, insert dummy nodes, order, route, label). **But your latest message says the engine already does all of it** (super-graph, dummy nodes, swaps, folding, A* routing, label search), **and the output is still messy.** That tells us three things:

1. Another round of hand-written heuristics has diminishing returns. Mature tools do not hand-write this (see file 01).
2. Part of the mess is not the engine. It is the map *content*: an overview with 14 nodes, 16 edges, 4 interleaved groups and hubs with 5+ edges is hard to draw well with any engine.
3. Nobody measures the result. The agent cannot see the canvas, and your pipeline has no numeric gate that says "this map is too tangled, simplify it".

So the fix has three parts, in this order of payoff:

| # | Part | Why |
|---|---|---|
| A | **Measure first** (layout-quality metrics on your 7 maps) | Without numbers, every change is a guess |
| B | **Constrain content + close the loop** (new validator rules, new agent guide, crossing/hub limits that fail `vibemap check`) | Cheapest fix and attacks the real cause; the agent must simplify before the map is accepted |
| C | **Replace the hand-rolled layout with ELK behind an interface** (keep the old engine as fallback) | Layered layout with compound groups, ports and orthogonal routing is what ELK is built for |

## 2. Should you tell it to proceed?

**Not with the plan as one big task, and not on Gemini Flash in one pass.** A rewrite touching layout, routing, labels, pinning, ERD, sequence and the viewer has too many interdependent parts for a weaker model; it tends to loosen tests to make them pass. Use the prompts in file 04 instead: each is small, has a measurable gate, and says what to do if the gate fails.

Recommended order:

1. Prompt 1: add `layoutQuality()` and baseline numbers (no behaviour change).
2. Prompts 2 and 3: new validator rules and the new agent guide (file 03). Re-bootstrap your own maps with the new guide.
3. Prompt 4: ELK **spike** behind a `LayoutEngine` interface. Compare numbers against the old engine on the same 7 maps. Decide from the numbers.
4. Prompts 5 to 7: viewer polish, pinning, ERD/sequence.

## 3. One correction to your reasons for rejecting ELK

Your agent said ELK was rejected for licence, bundle size and hook speed. Please re-check each:

- **Hook speed:** the `post-edit` hook in the spec only records the edited path. It never runs layout. A heavy layout library does not slow it down. Layout only runs in the viewer, `inspect`, `render` and `check`.
- **Bundle size:** it only affects the viewer (lazy-load the chunk) and the CLI install size. Neither is on a hot path.
- **Licence:** EPL-2.0 is a weak (file-level) copyleft licence, not the strong kind; using an unmodified elkjs as an npm dependency in an MIT project is common. I am not a lawyer, and you must ship its licence notice and not modify it. Please confirm with a licence check. If your policy is still "no EPL at all", file 02 lists a fallback path (and its costs).

The real ELK cost is that layout becomes **async**, which touches every caller of `layoutMap`. File 04 handles that explicitly.

## 3b. What I could not find

I could not find the internal layout methods or agent prompts of Eraser, Lucidchart AI, or Miro. Eraser's agent skill folder contents were not retrievable. So "Eraser/draw.io are far more accurate" is your observation, not something I could confirm; draw.io's own docs say generated output is a starting point that usually needs editing. What the research does support is in file 01.

## 4. Decision you need to make

| Decision | My recommendation |
|---|---|
| Allow ELK as a dependency? | Yes, behind an interface, after a licence check |
| Keep your old engine? | Yes, as `legacy` fallback for one release |
| Tighten map limits? | Yes (file 03) |
| Run the whole plan in one go on Gemini Flash? | No |
