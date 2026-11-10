# 01: Research findings

Scope: how successful diagram tools and research handle layout, edge routing, and AI-generated diagrams. Every claim is tagged **[verified]** (read on the page), **[search-only]** (appeared in a search result title or snippet but I did not read the page), or **[inference]** (my reasoning). Gaps are listed at the end.

## 1. Tools

### draw.io (diagrams.net)
- Guidance says generation suits generic flows and simple types (flowcharts, sequence, state, ER, concept maps), and is weak for notation standards like C4/BPMN/AWS and for documenting existing systems. **[verified]** ([draw.io: generated diagrams](https://www.drawio.com/blog/generated-diagrams))
- It warns generators do not sanity-check output, may hallucinate elements, and regenerate from scratch with no memory of earlier attempts. **[verified]**
- Prompt rules it publishes: name the diagram type first, set direction ("vertical"/"horizontal"), use consistent names for each actor, keep the query short (there is a character limit), and split long processes into several short diagrams. **[verified]** ([draw.io: write better queries](https://www.drawio.com/docs/best-practice/write-query-generate-diagram/))
- Its MCP tool server vendors **libavoid** (WASM) for obstacle-avoiding orthogonal connector routing via a `routing: "libavoid"` option. **[verified]** ([@drawio/mcp libavoid README](https://cdn.jsdelivr.net/npm/@drawio/mcp@1.5.0/vendor/libavoid/README.md)). Takeaway: even draw.io treats routing as a separate, dedicated engine, not something each generator does itself.

### Eraser
- Agents connect via MCP or "Agent Skills"; the agent writes **diagram-as-code** and Eraser **renders it server-side**, returning an image and an editor link. **[verified]** ([Eraser: AI agent integrations](https://docs.eraser.io/using-ai-agent-integrations))
- Skills are MIT-licensed and cover general diagrams, Terraform, AWS, Azure, Bicep. **[verified]** ([eraser-io skills README](https://github.com/eraserlabs/eraser-io/blob/main/skills/README.md))
- The agent's instruction text and Eraser's layout algorithm were **not retrievable**.
- Takeaway **[inference]**: the architecture is the same one you are building (agent writes structured text, tool does layout). The difference is a mature layout/render service, not a smarter agent.

### Mermaid
- Supports multiple layout engines: dagre (default, fast, for small/medium), **ELK** (for complex/large, most tunable), tidy-tree, cose-bilkent. **[verified]** ([Mermaid layouts](https://www.mintlify.com/mermaid-js/mermaid/configuration/layouts))
- ELK is the documented choice "when standard layouts give poor results". **[verified]**

### D2
- Offers dagre, ELK, and its own TALA engine. In its comparison, dagre has the most limited feature support (no container sizing), ELK is more mature, TALA is built for software architecture diagrams and supports per-container direction and position locking. **[verified]** ([D2 layouts](https://d2lang.com/tour/layouts/))
- Takeaway: the successful diagram languages **pick an existing layout engine and make it swappable**.

### JointJS / libavoid
- libavoid routes every connector as part of **one shared router** that treats all shapes as obstacles, uses ports as pins that fix the approach side, and "nudges" parallel segments apart. Per-link routers are described as worse because links can overlap. **[verified]** ([JointJS: libavoid routing](https://docs.jointjs.com/learn/features/automatic-layouts/standalone-link-routing))
- Caveats: libavoid does not report whether its output is valid, so wrappers check heuristically and fall back; the package licensing is MPL-2.0 and libavoid-js is LGPL-2.1+. **[verified]**
- Takeaway: global routing with nudging is what avoids overlapping and tangled edges. Your per-edge A* routing cannot nudge globally.

## 2. Layout algorithm (ELK layered)
Five phases: cycle breaking, layer assignment, crossing minimisation, node placement, edge routing; edge routing can be polyline, orthogonal or spline; defaults are greedy cycle breaking, network-simplex layering, layer-sweep (barycenter) crossing minimisation, Brandes-Koepf placement. Options exist for post-compaction and for unzipping very tall layers. **[verified]** ([ELK layered](https://eclipse.dev/elk/blog/posts/2025/25-08-21-layered.html))
The page did **not** cover ports or compound handling, so those option names in file 02 are marked "verify".

## 3. What humans read best
- A classic empirical study concludes reducing **edge crossings** is "by far the most important aesthetic"; bends and symmetry matter less. **[verified]** ([Purchase et al., Monash record](https://research.monash.edu/en/publications/which-aesthetic-has-the-greatest-effect-on-human-understanding/)). This justifies using crossing count as the primary quality gate.
- C4-style guidance: scope each diagram to one audience, remove elements that do not serve the purpose, label edges with concise verb phrases, keep notation consistent, keep diagrams matching the code. No numeric element limits were given. **[verified]** ([C4 methodology article](https://besthub.dev/articles/how-to-craft-clear-architecture-diagrams-a-practical-c4-methodology-df2695685aad))

## 4. LLMs generating diagram code
- A Mermaid sequence-diagram benchmark found scores for **syntax and "Mermaid only" output were generally higher than logic, completeness, activation handling and error tracking**. It is a small initial baseline (132 samples) judged by LLMs. **[verified]** ([MermaidSeqBench](https://arxiv.org/html/2511.14967v1)). Takeaway **[inference]**: validating syntax is not enough; you need *semantic* checks (does every node have a ref, is the map the right type, is it small enough).

## 5. Licence lead
- A GitLab merge request titled "Remove blanket allowlist for EPL 2.0; allowlist elkjs instead" appeared in search. **[search-only]** It suggests organisations review elkjs specifically. Worth reading before deciding.

## 6. Synthesis: what successful tools have in common
1. **The generator never positions anything.** It emits structure; an engine lays it out. (Eraser, Mermaid, D2, draw.io generation.)
2. **The layout engine is a mature, swappable component**, not a bespoke heuristic. (Mermaid and D2 expose engine choice.)
3. **Routing is global and port-aware**, with nudging. (libavoid, ELK ports/orthogonal.)
4. **Scope is small and typed.** Simple diagram types; long things are split. (draw.io guidance, C4.)
5. **Output is a starting point with an editor on top.** (draw.io, Eraser editor links.)
6. **Crossings are the metric that matters.** (Purchase.)

Your system has 1 and 5, a bespoke version of 2 and 3, and no enforcement of 4 or 6. That is the gap.

## 7. Not covered
- Lucidchart AI, Miro AI, Whimsical, Structurizr rendering internals, Excalidraw text-to-diagram, Graphviz tuning: not researched in this pass.
- No benchmark comparing ELK, dagre and your engine on *your* maps exists; file 04 prompt 4 produces one.
