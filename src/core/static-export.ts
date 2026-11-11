import fs from 'node:fs';
import path from 'node:path';
import type { Project } from './project.js';
import { loadAllMaps } from './maps.js';
import { readLayout } from './project.js';
import { resolveEvidence } from './evidence.js';
import { loadFacts } from './scanner.js';
import { layoutMap } from './layout.js';
import { renderSvg } from './render.js';
import { listChanges } from './changes.js';
import { listNotes } from './notes.js';
import { readPhases } from './project.js';
import { validateProject, validateProjectAsync } from './validate.js';
import { computeCoverage } from './suggest.js';
import { toPosix } from './paths.js';

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slug(id: string): string {
  return id.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '') || 'map';
}

export interface StaticExportResult {
  outDir: string;
  maps: number;
  files: string[];
}

export async function staticExport(project: Project, outDir: string): Promise<StaticExportResult> {
  const out = path.resolve(outDir);
  if (out === path.resolve(project.root) || out === path.resolve(project.vibemapDir)) {
    throw new Error('Refusing to export into the project root or .vibemap/. Choose a subdirectory such as ./site.');
  }
  fs.mkdirSync(path.join(out, 'maps'), { recursive: true });
  const { maps } = loadAllMaps(project);
  const report = await validateProjectAsync(project, { strict: false });
  const facts = loadFacts(project);
  const changes = listChanges(project);
  const notes = listNotes(project, true);
  const phases = readPhases(project);
  const coverage = computeCoverage(project);
  const fileMap: Array<{ id: string; title: string; file: string; svg: string }> = [];
  const data: Record<string, unknown> = {
    schema: 1,
    generatedAt: new Date().toISOString(),
    project: project.config.project.name,
    maps: [],
    changes,
    notes,
    phases: phases.phases,
    coverage,
    check: report,
  };
  const dataMaps: unknown[] = [];
  for (const loaded of maps) {
    const evidence = resolveEvidence(project, loaded.map, facts);
    const sidecar = (() => {
      try {
        return readLayout(project, loaded.id);
      } catch {
        return null;
      }
    })();
    const layout = layoutMap(loaded.map, project.theme, { sidecar });
    const svg = renderSvg(loaded.map, project.theme, layout, evidence, sidecar);
    const name = `${slug(loaded.id)}.svg`;
    fs.writeFileSync(path.join(out, 'maps', name), svg, 'utf8');
    fileMap.push({ id: loaded.id, title: loaded.map.title, file: `maps/${name}`, svg });
    dataMaps.push({ id: loaded.id, map: loaded.map, evidence, layout: { width: layout.width, height: layout.height } });
  }
  data.maps = dataMaps;
  fs.writeFileSync(path.join(out, 'data.json'), `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  const mapSections = fileMap
    .map((map) => {
      const loaded = maps.find((m) => m.id === map.id)!;
      const nodes = loaded.map.type === 'graph' ? loaded.map.nodes : [];
      const table = nodes.length
        ? `<table><thead><tr><th>Node</th><th>Kind</th><th>Status</th><th>Evidence</th><th>Code refs</th></tr></thead><tbody>${nodes
            .map((node) => {
              const ev = resolveEvidence(project, loaded.map, facts)[node.id]?.status ?? '—';
              const refs = (node.refs ?? []).map((r) => `<code>${esc(r.path)}${r.symbol ? `#${esc(r.symbol)}` : ''}</code>`).join('<br>');
              return `<tr><td>${esc(node.label)}</td><td>${esc(node.kind)}</td><td>${esc(node.status ?? 'built')}</td><td><span class="ev ${esc(ev)}">${esc(ev)}</span></td><td>${refs || '—'}</td></tr>`;
            })
            .join('')}</tbody></table>`
        : '';
      const walk = loaded.map.type === 'graph' && loaded.map.walkthrough?.length
        ? `<details><summary>Walkthrough (${loaded.map.walkthrough.length} steps)</summary><ol>${loaded.map.walkthrough.map((s) => `<li>${esc(s.text)} <span class="muted">(${esc(s.focus.join(', '))})</span></li>`).join('')}</ol></details>`
        : '';
      return `<section id="map-${esc(map.id)}"><h2>${esc(map.title)} <span class="muted">${esc(map.id)}</span></h2>${loaded.map.summary ? `<p>${esc(loaded.map.summary)}</p>` : ''}<img src="${map.file}" alt="${esc(map.title)} diagram" loading="lazy">${table}${walk}</section>`;
    })
    .join('\n');

  const changeSections = changes.length
    ? changes
        .map(
          (change) =>
            `<details class="change"><summary><strong>${esc(change.title)}</strong> <span class="muted">${esc(change.date.slice(0, 10))} · ${esc(change.type)} · ${esc(change.author)}</span></summary><div class="md">${esc(change.body)}</div><p class="muted">Maps: ${change.maps.map((m) => `<a href="#map-${esc(m)}">${esc(m)}</a>`).join(', ') || '—'}</p></details>`,
        )
        .join('\n')
    : '<p>No change entries yet.</p>';

  const phaseRows = phases.phases.length
    ? phases.phases
        .map((phase) => `<tr><td>${esc(phase.id)}</td><td>${esc(phase.title)}</td><td>${esc(phase.status)}</td><td>${esc(phase.goal ?? '')}</td><td>${esc(phase.snapshot ?? '')}</td></tr>`)
        .join('')
    : '<tr><td colspan="5">No phases yet.</td></tr>';

  const noteSections = notes.length
    ? notes
        .map(
          (note) =>
            `<details class="note"><summary><strong>${esc(note.title)}</strong> <span class="muted">${esc(note.path)}</span></summary><div class="md">${esc(note.body)}</div></details>`,
        )
        .join('\n')
    : '<p>No notes yet.</p>';

  const unverified = coverage.unverified.length
    ? `<ul>${coverage.unverified.slice(0, 200).map((u) => `<li><code>${esc(u.map)}#${esc(u.node)}</code> — ${esc(u.label)} <span class="ev ${esc(u.status)}">${esc(u.status)}</span></li>`).join('')}</ul>`
    : '<p>All mapped items are verified or intentionally planned.</p>';

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(project.config.project.name)} — VibeMap</title>
<style>
:root{--bg:#f8f9fa;--panel:#fff;--ink:#212529;--muted:#6c757d;--line:#dee2e6;--accent:#1971c2}
@media(prefers-color-scheme:dark){:root{--bg:#16181d;--panel:#1f2329;--ink:#e9ecef;--muted:#9aa4b2;--line:#333a44;--accent:#74c0fc}}
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--ink);line-height:1.55}
header{padding:28px 32px;border-bottom:1px solid var(--line);background:var(--panel)}h1{margin:0;font-size:26px}header p{margin:6px 0 0;color:var(--muted)}
.layout{display:grid;grid-template-columns:250px minmax(0,1fr);gap:0;max-width:1400px;margin:0 auto}
nav{position:sticky;top:0;align-self:start;height:100vh;overflow:auto;padding:20px;border-right:1px solid var(--line);background:var(--panel)}
nav h3{margin:16px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}nav a{display:block;padding:5px 0;color:var(--ink);text-decoration:none;font-size:14px}nav a:hover{color:var(--accent)}
main{padding:28px 32px 80px;min-width:0}section{margin:0 0 40px;padding:22px;background:var(--panel);border:1px solid var(--line);border-radius:12px}
h2{margin:0 0 8px;font-size:20px}.muted{color:var(--muted);font-weight:400;font-size:13px}img{max-width:100%;height:auto;border:1px solid var(--line);border-radius:8px;background:#fff;margin:12px 0}
table{width:100%;border-collapse:collapse;font-size:13px;margin:12px 0}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:600}
code{font-family:ui-monospace,Consolas,monospace;font-size:12px;background:rgba(127,127,127,.13);padding:1px 4px;border-radius:4px}
.ev{font-size:11px;padding:1px 6px;border-radius:999px;border:1px solid currentColor}.ev.verified{color:#2f9e44}.ev.declared{color:#e67700}.ev.stale{color:#e03131}.ev.planned{color:#1971c2}
details{margin:10px 0;border:1px solid var(--line);border-radius:8px;padding:10px 14px}summary{cursor:pointer;padding:4px 0}.md{white-space:pre-wrap;font-size:14px}
.bar{height:8px;background:var(--line);border-radius:999px;overflow:hidden}.bar>span{display:block;height:100%;background:var(--accent)}
footer{color:var(--muted);font-size:12px;padding:20px 32px;border-top:1px solid var(--line)}
@media(max-width:800px){.layout{grid-template-columns:1fr}nav{position:static;height:auto;border-right:0;border-bottom:1px solid var(--line)}main{padding:20px}}
</style>
</head>
<body>
<header><h1>${esc(project.config.project.name)} — architecture map</h1><p>Generated by VibeMap · ${esc(new Date().toISOString().slice(0, 10))} · read-only export · ${maps.length} maps</p></header>
<div class="layout">
<nav>
<h3>Maps</h3>${fileMap.map((m) => `<a href="#map-${esc(m.id)}">${esc(m.title)}</a>`).join('')}
<h3>Sections</h3><a href="#changes">Changes</a><a href="#phases">Phases</a><a href="#notes">Notes</a><a href="#coverage">Coverage</a><a href="#problems">Validation</a>
<h3>Data</h3><a href="data.json">data.json</a>
</nav>
<main>
<section id="projects"><h2>${esc(project.config.project.name)}</h2><p>${esc(project.config.tracking.mode)} tracking · ${esc(project.config.tracking.granularity)} granularity · ${report.errors.length} errors · ${report.warnings.length} warnings</p><p class="bar"><span style="width:${Math.min(100, coverage.percent)}%"></span></p><p class="muted">Coverage ${coverage.percent}% — ${coverage.coveredFiles}/${coverage.totalFiles} source files referenced.</p></section>
${mapSections}
<section id="changes"><h2>Changes</h2>${changeSections}</section>
<section id="phases"><h2>Phases</h2><table><thead><tr><th>Id</th><th>Title</th><th>Status</th><th>Goal</th><th>Snapshot</th></tr></thead><tbody>${phaseRows}</tbody></table></section>
<section id="notes"><h2>Notes</h2>${noteSections}</section>
<section id="coverage"><h2>Coverage</h2><p>${coverage.percent}% of scanned source files are referenced by a map.</p><p class="bar"><span style="width:${Math.min(100, coverage.percent)}%"></span></p><h3>Unverified / declared</h3>${unverified}</section>
<section id="problems"><h2>Validation</h2><pre>${esc([...report.errors, ...report.warnings].map((i) => `${i.severity === 'error' ? '✖' : '⚠'} ${i.code} ${i.file}${i.line ? `:${i.line}` : ''} ${i.message}`).join('\n') || 'No issues.')}</pre></section>
</main></div>
<footer>Read-only static export. Run <code>vibemap view</code> in the project for the live, editable viewer. No telemetry, no network.</footer>
</body></html>`;
  fs.writeFileSync(path.join(out, 'index.html'), html, 'utf8');
  fs.writeFileSync(
    path.join(out, 'README.txt'),
    `VibeMap static export for ${project.config.project.name}\nGenerated ${new Date().toISOString()}\n\nOpen index.html in a browser. This export is read-only and needs no server.\nData: data.json. Diagrams: maps/*.svg.\nIt contains no source code, no .cache, no locks, no absolute paths and no secrets.\n`,
    'utf8',
  );
  return { outDir: out, maps: maps.length, files: [toPosix(path.join(out, 'index.html')), toPosix(path.join(out, 'data.json'))] };
}
