import path from 'node:path';
import type { BootstrapInfo, Facts } from './types.js';
import type { Project } from './project.js';
import { scanProject, loadFacts } from './scanner.js';
import { writeFileAtomic } from './yaml.js';
import { toPosix } from './paths.js';

function bulletList(items: string[], limit = 40): string {
  if (!items.length) return '- (none detected)';
  return items
    .slice(0, limit)
    .map((item) => `- ${item}`)
    .join('\n');
}

export function buildBootstrapPrompt(project: Project, facts: Facts): string {
  const routes = facts.routes.map((r) => `\`${r.method} ${r.path}\` — \`${r.file}:${r.line}\``);
  const models = facts.models.map((m) => `\`${m.name}\` — \`${m.file}\`${m.fields.length ? ` (${m.fields.slice(0, 8).join(', ')})` : ''}`);
  const entrypoints = facts.entrypoints.map((e) => `\`${e}\``);
  const env = facts.env.map((e) => `\`${e.name}\` (${e.files.slice(0, 2).join(', ')})`);
  const deps = facts.deps
    .filter((d) => !d.dev)
    .slice(0, 30)
    .map((d) => `\`${d.name}@${d.version}\``);
  return `# VibeMap bootstrap prompt

You are the coding agent for **${project.config.project.name}**. Your job is to create a small, accurate, visual map of this existing project in \`.vibemap/\`.

Read \`.vibemap/AGENT_GUIDE.md\` first. It is the canonical rulebook. Then follow the steps below. Do not ask the user questions unless a fact is genuinely ambiguous; make the smallest defensible map and validate it.

## Ground truth from the scanner

- Source files indexed: **${facts.files.length}**
- Entrypoints: ${entrypoints.length ? entrypoints.join(', ') : '(none detected)'}
- Routes: **${facts.routes.length}**
- Data models: **${facts.models.length}**
- Environment variables (names only): **${facts.env.length}**
- Runtime dependencies: **${facts.deps.filter((d) => !d.dev).length}**

### Routes

${bulletList(routes, 50)}

### Data models

${bulletList(models, 30)}

### Entrypoints

${bulletList(entrypoints, 15)}

### Environment variables

${bulletList(env, 25)}

### Dependencies

${bulletList(deps, 30)}

## What to create

1. **First**, create \`00-overview\` (level: overview):
   - The major runtime pieces (web app, API, worker, database, external services).
   - Group them into 2–5 boundaries (Frontend, Backend, Data, External).
   - Every real component node must have \`refs\` to an existing file. External services and actors use kind \`external\`/\`actor\` and need no refs.
   - Keep it to **15 nodes or fewer**.

2. **Then** create one feature map per top-level feature or flow under \`maps/\`:
   - Example: \`auth/login-flow\`, \`billing/checkout\`, \`data/schema\`.
   - Use the routes and models above as anchors. Do not invent a route that is not in this list.
   - Add edges with meaningful kinds (\`calls\`, \`reads\`, \`writes\`, \`event\`, …).
   - Add a \`walkthrough\` and \`plain\` text for any user-facing flow.

3. **Then** add notes for the two or three most important "why" explanations in \`.vibemap/notes/\`. Keep node descriptions under 200 characters.

4. **Validate** with \`vibemap check\`. Fix every error. Warnings about missing refs, duplicate labels and node count should be addressed or consciously justified.

5. **Record** the bootstrap as one change entry:
   \`\`\`bash
   vibemap change add --title "Bootstrap project maps" --why "The project had no visual map." --maps 00-overview,auth/login-flow --type docs
   \`\`\`
   (Replace the map list with the maps you actually created.)

## Hard rules

- Never write coordinates, sizes, colours, layout or evidence. The tool draws.
- Never edit \`.vibemap/layouts/\`, \`config.yaml\`, \`theme.yaml\` or \`locks.json\`.
- Use \`vibemap patch\` for changes; direct YAML editing is acceptable only for large initial maps.
- Every node must be traceable. If you cannot find code for it, do not add it.
- Do not add a technology just because it is common. Use only what the scanner and code show.
- Ids are kebab-case and stable. Labels are short.

## Useful commands

\`\`\`bash
vibemap map new auth/login-flow --type graph --title "Login flow" --level feature
vibemap patch auth/login-flow --file ops.json
vibemap check
vibemap context --area auth
vibemap schema --format md
\`\`\`

When finished, reply with: maps created, node/edge counts, \`vibemap check\` status, and any facts you could not verify.
`;
}

export async function bootstrapProject(project: Project, out?: string): Promise<BootstrapInfo> {
  const facts = loadFacts(project) ?? scanProject(project, { full: true }).facts;
  const prompt = buildBootstrapPrompt(project, facts);
  const rel = out ?? '.vibemap/BOOTSTRAP_PROMPT.md';
  const abs = path.isAbsolute(rel) ? rel : path.join(project.root, rel);
  await writeFileAtomic(abs, prompt);
  return {
    prompt,
    summary: {
      files: facts.files.length,
      routes: facts.routes.length,
      models: facts.models.length,
      deps: facts.deps.length,
      entrypoints: facts.entrypoints,
    },
  };
}

export function bootstrapInstructions(project: Project): string {
  return `Bootstrap prompt written to .vibemap/BOOTSTRAP_PROMPT.md.

Next:
  1. Open your coding agent in ${toPosix(project.root)}.
  2. Paste: "Read .vibemap/BOOTSTRAP_PROMPT.md and follow it."
     (or paste the file contents directly)
  3. Run \`vibemap view\` to watch maps appear live.
`;
}
