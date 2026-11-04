import type { CoverageReport, EvidenceMap, Suggestion, VibeMap } from './types.js';
import type { Project } from './project.js';
import { loadAllMaps } from './maps.js';
import { ensureFacts } from './scanner.js';
import { coverageReport, nodeRefs, resolveEvidence } from './evidence.js';
import { isCodeLanguage } from './paths.js';

export function computeCoverage(project: Project): CoverageReport {
  const facts = ensureFacts(project);
  const { maps } = loadAllMaps(project);
  return coverageReport(
    maps.map((m) => ({ id: m.id, map: m.map, evidence: resolveEvidence(project, m.map, facts) })),
    facts,
    project.config.coverage.target,
    (file) => {
      const fact = facts.files.find((f) => f.path === file);
      return !!fact && (isCodeLanguage(fact.lang) || fact.lang === 'prisma');
    },
  );
}

export function computeSuggestions(project: Project, limit = 20): Suggestion[] {
  const facts = ensureFacts(project);
  const { maps } = loadAllMaps(project);
  const suggestions: Suggestion[] = [];
  const referenced = new Set<string>();
  const labels: string[] = [];
  const overview = maps.find((m) => m.id === '00-overview' || m.map.level === 'overview');
  const overviewRefs = new Set<string>();
  const evidence = new Map<string, EvidenceMap>();
  for (const loaded of maps) {
    evidence.set(loaded.id, resolveEvidence(project, loaded.map, facts));
    for (const { refs } of nodeRefs(loaded.map)) for (const ref of refs) referenced.add(ref.path);
    if (loaded.map.type === 'graph') {
      for (const node of loaded.map.nodes) {
        labels.push(`${node.label} ${node.description ?? ''} ${node.plain ?? ''}`.toLowerCase());
        if (overview?.id === loaded.id) for (const ref of node.refs ?? []) overviewRefs.add(ref.path);
      }
    }
  }

  for (const route of facts.routes) {
    if (referenced.has(route.file)) continue;
    suggestions.push({
      priority: 10,
      kind: 'route',
      title: `${route.method} ${route.path}`,
      file: route.file,
      line: route.line,
      prompt: `Map route ${route.method} ${route.path} (${route.file}:${route.line}). Find which map it belongs to, or create a feature map for it, then add the handler node with refs to this file and symbol.`,
    });
  }
  for (const model of facts.models) {
    if (referenced.has(model.file)) continue;
    suggestions.push({
      priority: 8,
      kind: 'model',
      title: `Model ${model.name}`,
      file: model.file,
      prompt: `Add model ${model.name} (${model.file}) to the data model ERD or the relevant feature map, with refs to the model definition and its fields.`,
    });
  }
  for (const entry of facts.entrypoints) {
    if (overviewRefs.has(entry)) continue;
    suggestions.push({
      priority: 9,
      kind: 'entrypoint',
      title: `Entrypoint ${entry}`,
      file: entry,
      prompt: `Add the application entrypoint ${entry} to the 00-overview map (kind: file/service) and connect it to the main services it starts.`,
    });
  }
  for (const env of facts.env) {
    const seen = labels.some((text) => text.includes(env.name.toLowerCase()));
    if (seen) continue;
    suggestions.push({
      priority: 5,
      kind: 'env',
      title: `Env var ${env.name}`,
      file: env.files[0],
      prompt: `If ${env.name} is operationally important, document it as a config node (refs: ${env.files.slice(0, 3).join(', ')}) and connect it to the service that reads it. Never include the value.`,
    });
  }
  const coverage = computeCoverage(project);
  for (const file of coverage.unmapped.slice(0, 8)) {
    suggestions.push({
      priority: 3,
      kind: 'unmapped',
      title: `Unmapped ${file}`,
      file,
      prompt: `Map ${file}: decide whether it belongs to an existing feature map. Add a node with refs (path + symbol) and connect it to its callers/callees.`,
    });
  }
  for (const item of coverage.unverified) {
    suggestions.push({
      priority: 6,
      kind: 'unverified',
      title: `${item.map}#${item.node} is ${item.status}`,
      map: item.map,
      prompt: `Verify ${item.map}#${item.node} ("${item.label}") against the code. Fix its refs/symbol, mark it planned if not built, or remove it if it does not exist.`,
    });
  }
  const seen = new Set<string>();
  return suggestions
    .filter((s) => {
      const key = `${s.kind}:${s.title}:${s.file ?? ''}:${s.map ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title))
    .slice(0, Math.max(1, limit));
}

export function mapRefs(map: VibeMap): Set<string> {
  const out = new Set<string>();
  for (const { refs } of nodeRefs(map)) for (const ref of refs) out.add(ref.path);
  return out;
}
