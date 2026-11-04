import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import type {
  CodeSymbol,
  DepFact,
  EnvFact,
  Facts,
  FactsFile,
  ModelFact,
  RouteFact,
} from './types.js';
import { SCHEMA_VERSION } from './types.js';
import type { Project } from './project.js';
import { readJsonFile, sha1, writeFileAtomic } from './yaml.js';
import {
  isCodeLanguage,
  isSecretFile,
  languageForPath,
  matchesAny,
  pathInScope,
  toPosix,
} from './paths.js';

const MAX_PARSE_BYTES = 1_000_000;
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);
const MAX_FILE_BYTES = 2_000_000;

export interface ScanStats {
  files: number;
  parsed: number;
  reused: number;
  skipped: number;
  routes: number;
  models: number;
  durationMs: number;
}

export interface ScanResult {
  facts: Facts;
  stats: ScanStats;
}

export function factsPath(project: Project): string {
  return path.join(project.root, '.vibemap', '.cache', 'facts.json');
}

export function loadFacts(project: Project): Facts | null {
  const raw = readJsonFile<Facts>(factsPath(project));
  if (!raw || raw.schema !== SCHEMA_VERSION || !Array.isArray(raw.files)) return null;
  return raw;
}

export function ensureFacts(project: Project, opts: { full?: boolean } = {}): Facts {
  const existing = loadFacts(project);
  if (existing && !opts.full) return existing;
  return scanProject(project, opts).facts;
}

interface Candidate {
  rel: string;
  abs: string;
  size: number;
  mtimeMs: number;
  secret: boolean;
  lang: string;
}

function gitFileList(root: string): string[] | null {
  try {
    const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 128 * 1024 * 1024,
    });
    return out.split('\0').filter(Boolean);
  } catch {
    return null;
  }
}

function walkFiles(root: string, exclude: string[], out: string[]): void {
  const stack: string[] = [root];
  let guard = 0;
  while (stack.length) {
    const dir = stack.pop()!;
    if (guard++ > 80_000) break;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = toPosix(path.relative(root, abs));
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.vibemap') continue;
        if (matchesAny(`${rel}/`, exclude)) continue;
        stack.push(abs);
      } else if (entry.isFile()) {
        if (!pathInScope(rel, [], exclude)) continue;
        out.push(rel);
      }
    }
  }
}

function listCandidates(project: Project): Candidate[] {
  const { include, exclude } = project.config.paths;
  const gitFiles = gitFileList(project.root);
  let rels: string[];
  if (gitFiles) {
    rels = gitFiles;
  } else {
    const out: string[] = [];
    walkFiles(project.root, exclude, out);
    rels = out;
  }
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const relRaw of rels.sort()) {
    const rel = toPosix(relRaw).replace(/^\.\//, '');
    if (!rel || seen.has(rel)) continue;
    seen.add(rel);
    if (rel.startsWith('.vibemap/')) continue;
    if (!pathInScope(rel, include, exclude)) continue;
    const abs = path.join(project.root, rel);
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(abs);
    } catch {
      continue;
    }
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) continue;
    const secret = isSecretFile(rel);
    const lang = languageForPath(rel);
    const interesting =
      secret ||
      isCodeLanguage(lang) ||
      lang === 'prisma' ||
      path.posix.basename(rel) === 'package.json' ||
      path.posix.basename(rel) === 'requirements.txt';
    if (!interesting) continue;
    candidates.push({ rel, abs, size: stat.size, mtimeMs: stat.mtimeMs, secret, lang });
  }
  return candidates;
}

function lineOf(sf: ts.SourceFile, node: ts.Node): number {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

function hasExportModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return !!modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword || m.kind === ts.SyntaxKind.DefaultKeyword);
}

function stringArg(node: ts.Node | undefined): string | null {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function addSymbol(symbols: CodeSymbol[], name: string, kind: string, line: number): void {
  if (!name) return;
  if (symbols.some((s) => s.name === name && s.kind === kind)) return;
  symbols.push({ name, kind, line });
}

function collectDecorator(node: ts.Node, name: string): ts.CallExpression | null {
  if (!ts.canHaveDecorators(node)) return null;
  const decorators = ts.getDecorators(node);
  if (!decorators) return null;
  for (const decorator of decorators) {
    const expr = decorator.expression;
    if (ts.isCallExpression(expr)) {
      const callee = expr.expression;
      if (ts.isIdentifier(callee) && callee.text === name) return expr;
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === name) return expr;
    } else if (ts.isIdentifier(expr) && expr.text === name) {
      return ts.factory.createCallExpression(expr, undefined, []);
    }
  }
  return null;
}

function routePathFromFile(rel: string): string | null {
  const norm = toPosix(rel);
  const appMatch = norm.match(/(?:^|\/)(?:src\/)?app\/(.*)\/route\.(?:ts|tsx|js|jsx)$/);
  if (appMatch) {
    const segments = appMatch[1]!
      .split('/')
      .filter((s) => s && !(s.startsWith('(') && s.endsWith(')')))
      .map((s) => (s.startsWith('[') && s.endsWith(']') ? `:${s.slice(1, -1).replace(/^\.\.\./, '')}` : s));
    return `/${segments.join('/')}`.replace(/\/$/, '') || '/';
  }
  const pagesMatch = norm.match(/(?:^|\/)(?:src\/)?pages\/api\/(.*)\.(?:ts|tsx|js|jsx)$/);
  if (pagesMatch) {
    const segments = pagesMatch[1]!
      .split('/')
      .filter((s) => s && s !== 'index')
      .map((s) => (s.startsWith('[') && s.endsWith(']') ? `:${s.slice(1, -1).replace(/^\.\.\./, '')}` : s));
    return `/api${segments.length ? `/${segments.join('/')}` : ''}`;
  }
  return null;
}

interface TsFileResult {
  imports: string[];
  exports: string[];
  symbols: CodeSymbol[];
  routes: RouteFact[];
  env: string[];
  models: ModelFact[];
}

function scanTs(rel: string, text: string, lang: string): TsFileResult {
  const scriptKind = lang === 'tsx' || lang === 'jsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, scriptKind);
  const imports: string[] = [];
  const exports = new Set<string>();
  const symbols: CodeSymbol[] = [];
  const routes: RouteFact[] = [];
  const env = new Set<string>();
  const models: ModelFact[] = [];

  const envRegex = /process\.env\.([A-Za-z_$][\w$]*)|process\.env\[['"]([^'"]+)['"]\]/g;
  for (const match of text.matchAll(envRegex)) {
    const name = match[1] ?? match[2];
    if (name) env.add(name);
  }

  for (const statement of sf.statements) {
    if (ts.isImportDeclaration(statement)) {
      const spec = statement.moduleSpecifier;
      if (ts.isStringLiteral(spec)) imports.push(spec.text);
    } else if (ts.isExportDeclaration(statement)) {
      if (statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
        imports.push(statement.moduleSpecifier.text);
      }
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const el of statement.exportClause.elements) exports.add(el.name.text);
      }
    } else if (ts.isExportAssignment(statement)) {
      exports.add('default');
    }

    if (ts.isFunctionDeclaration(statement) && statement.name) {
      addSymbol(symbols, statement.name.text, 'function', lineOf(sf, statement));
      if (hasExportModifier(statement)) exports.add(statement.name.text);
    } else if (ts.isClassDeclaration(statement) && statement.name) {
      addSymbol(symbols, statement.name.text, 'class', lineOf(sf, statement));
      if (hasExportModifier(statement)) exports.add(statement.name.text);
      for (const member of statement.members) {
        if ((ts.isMethodDeclaration(member) || ts.isPropertyDeclaration(member)) && member.name && ts.isIdentifier(member.name)) {
          addSymbol(symbols, member.name.text, ts.isMethodDeclaration(member) ? 'method' : 'property', lineOf(sf, member));
        }
      }
      if (collectDecorator(statement, 'Entity')) {
        models.push({ name: statement.name.text, file: rel, fields: [] });
      }
    } else if (ts.isInterfaceDeclaration(statement)) {
      addSymbol(symbols, statement.name.text, 'interface', lineOf(sf, statement));
      if (hasExportModifier(statement)) exports.add(statement.name.text);
    } else if (ts.isTypeAliasDeclaration(statement)) {
      addSymbol(symbols, statement.name.text, 'type', lineOf(sf, statement));
      if (hasExportModifier(statement)) exports.add(statement.name.text);
    } else if (ts.isEnumDeclaration(statement)) {
      addSymbol(symbols, statement.name.text, 'enum', lineOf(sf, statement));
      if (hasExportModifier(statement)) exports.add(statement.name.text);
    } else if (ts.isVariableStatement(statement)) {
      const exported = hasExportModifier(statement);
      for (const decl of statement.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          addSymbol(symbols, decl.name.text, 'variable', lineOf(sf, decl));
          if (exported) exports.add(decl.name.text);
        }
      }
    }
  }

  const walk = (node: ts.Node, controllerPrefix = '', inController = false): void => {
    if (ts.isClassDeclaration(node) && node.name) {
      const controller = collectDecorator(node, 'Controller');
      const prefix = controller ? (stringArg(controller.arguments[0]) ?? '') : '';
      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member) || !member.name || !ts.isIdentifier(member.name)) continue;
        for (const method of HTTP_METHODS) {
          const dec = collectDecorator(member, method[0]!.toUpperCase() + method.slice(1));
          if (!dec) continue;
          const suffix = stringArg(dec.arguments[0]) ?? '';
          const combined = `/${[prefix, suffix].join('/')}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
          routes.push({ method: method.toUpperCase(), path: combined, file: rel, line: lineOf(sf, member) });
        }
      }
      for (const member of node.members) walk(member, prefix, true);
      return;
    }
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr) && HTTP_METHODS.has(expr.name.text.toLowerCase())) {
        const method = expr.name.text.toUpperCase();
        const routePath = stringArg(node.arguments[0]);
        if (routePath && routePath.startsWith('/')) {
          routes.push({ method, path: routePath, file: rel, line: lineOf(sf, node) });
        }
      }
      if (ts.isPropertyAccessExpression(expr) && expr.name.text === 'route') {
        const arg = node.arguments[0];
        if (arg && ts.isObjectLiteralExpression(arg)) {
          let method = '';
          let routePath = '';
          for (const prop of arg.properties) {
            if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue;
            if (prop.name.text === 'method') method = (stringArg(prop.initializer) ?? '').toUpperCase();
            if (prop.name.text === 'url' || prop.name.text === 'path') routePath = stringArg(prop.initializer) ?? '';
          }
          if (method && routePath.startsWith('/')) {
            routes.push({ method, path: routePath, file: rel, line: lineOf(sf, node) });
          }
        }
      }
      if (ts.isPropertyAccessExpression(expr)) {
        const calleeName = expr.name.text;
        if (calleeName === 'model') {
          const name = stringArg(node.arguments[0]);
          if (name) models.push({ name, file: rel, fields: [] });
        }
        if (calleeName === 'pgTable' || calleeName === 'sqliteTable' || calleeName === 'mysqlTable') {
          const name = stringArg(node.arguments[0]);
          if (name) models.push({ name, file: rel, fields: [] });
        }
      }
    }
    ts.forEachChild(node, (child) => walk(child, controllerPrefix, inController));
  };
  walk(sf);

  const nextPath = routePathFromFile(rel);
  if (nextPath) {
    for (const method of exports) {
      if (HTTP_METHODS.has(method.toLowerCase())) {
        routes.push({ method: method.toUpperCase(), path: nextPath, file: rel, line: 1 });
      }
    }
  }

  // Deduplicate routes emitted twice by nested traversal.
  const uniqueRoutes = new Map<string, RouteFact>();
  for (const r of routes) {
    if (!r.path.startsWith('/')) continue;
    uniqueRoutes.set(`${r.method} ${r.path} ${r.file}`, r);
  }

  return {
    imports: [...new Set(imports)].sort(),
    exports: [...exports].sort(),
    symbols,
    routes: [...uniqueRoutes.values()],
    env: [...env].sort(),
    models,
  };
}

function scanPython(rel: string, text: string): TsFileResult {
  const imports: string[] = [];
  const exports: string[] = [];
  const symbols: CodeSymbol[] = [];
  const routes: RouteFact[] = [];
  const env = new Set<string>();
  const models: ModelFact[] = [];
  const lines = text.split('\n');
  const classStack: Array<{ name: string; indent: number; fields: string[] }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNo = i + 1;
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    const importMatch = line.match(/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.,\s]+))/);
    if (importMatch) {
      const mod = importMatch[1];
      if (mod) imports.push(mod);
      else if (importMatch[2]) imports.push(...importMatch[2].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]!));
    }
    const classMatch = line.match(/^(\s*)class\s+(\w+)(?:\(([^)]*)\))?\s*:/);
    if (classMatch) {
      const cls = classMatch[2]!;
      addSymbol(symbols, cls, 'class', lineNo);
      while (classStack.length && (classStack[classStack.length - 1]?.indent ?? -1) >= indent) classStack.pop();
      const base = classMatch[3] ?? '';
      const fields: string[] = [];
      classStack.push({ name: cls, indent, fields });
      if (/Model|Base|db\.Model/.test(base)) models.push({ name: cls, file: rel, fields });
    } else if (classStack.length && indent <= classStack[classStack.length - 1]!.indent && line.trim()) {
      classStack.pop();
    }
    const defMatch = line.match(/^\s*(?:async\s+)?def\s+(\w+)/);
    if (defMatch && !defMatch[1]!.startsWith('__')) {
      addSymbol(symbols, defMatch[1]!, 'function', lineNo);
    }
    const fieldMatch = classStack.length ? line.match(/^\s+(\w+)\s*=\s*(?:db\.)?(?:Column|mapped_column|relationship)\(/) : null;
    if (fieldMatch && classStack.length) classStack[classStack.length - 1]!.fields.push(fieldMatch[1]!);

    const fastapi = line.match(/@(?:\w+)\.(get|post|put|patch|delete|head|options)\(\s*["']([^"']+)["']/i);
    if (fastapi) routes.push({ method: fastapi[1]!.toUpperCase(), path: fastapi[2]!, file: rel, line: lineNo });
    const flaskRoute = line.match(/@(?:\w+)\.route\(\s*["']([^"']+)["'](.*)\)/);
    if (flaskRoute) {
      const methods = flaskRoute[2]!.match(/methods\s*=\s*\[([^\]]+)\]/i);
      const verbs = methods
        ? [...methods[1]!.matchAll(/["'](\w+)["']/g)].map((m) => m[1]!.toUpperCase())
        : ['GET'];
      for (const verb of verbs) routes.push({ method: verb, path: flaskRoute[1]!, file: rel, line: lineNo });
    }
    const django = line.match(/^\s*(?:path|re_path)\(\s*r?["']([^"']*)["']/);
    if (django && /urls?\.py$/.test(rel)) routes.push({ method: 'GET', path: `/${django[1]!}`, file: rel, line: lineNo });
    const envRegex = /(?:os\.environ\.get|os\.getenv|os\.environ\[)\(?\s*["']([A-Za-z_][\w]*)["']/g;
    for (const match of line.matchAll(envRegex)) if (match[1]) env.add(match[1]);
  }

  return {
    imports: [...new Set(imports)].sort(),
    exports,
    symbols,
    routes,
    env: [...env].sort(),
    models,
  };
}

function scanGenericImports(rel: string, text: string, lang: string): TsFileResult {
  const imports = new Set<string>();
  const patterns = [
    /^\s*import\s+(?:\([^)]*\)\s+)?["']([^"']+)["']/gm,
    /^\s*use\s+([\w:]+)/gm,
    /^\s*import\s+([\w.]+)\s*;/gm,
    /^\s*using\s+([\w.]+)\s*;/gm,
    /^\s*require(?:_relative)?\s*\(?["']([^"']+)["']/gm,
    /^\s*import\s+["']([^"']+)["']/gm,
  ];
  for (const re of patterns) {
    for (const match of text.matchAll(re)) if (match[1]) imports.add(match[1]);
  }
  const env = new Set<string>();
  for (const match of text.matchAll(/process\.env\.([A-Za-z_$][\w$]*)/g)) if (match[1]) env.add(match[1]);
  const symbols: CodeSymbol[] = [];
  if (lang === 'go') {
    for (const match of text.matchAll(/^func\s+(?:\([^)]*\)\s*)?(\w+)\s*\(/gm)) {
      addSymbol(symbols, match[1]!, 'function', text.slice(0, match.index ?? 0).split('\n').length);
    }
  }
  return { imports: [...imports].sort(), exports: [], symbols, routes: [], env: [...env].sort(), models: [] };
}

function parsePrisma(rel: string, text: string): ModelFact[] {
  const models: ModelFact[] = [];
  const re = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  for (const match of text.matchAll(re)) {
    const name = match[1]!;
    const body = match[2] ?? '';
    const fields = body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'))
      .map((l) => l.split(/\s+/)[0]!)
      .filter(Boolean);
    models.push({ name, file: rel, fields });
  }
  return models;
}

function parseRequirements(root: string): DepFact[] {
  const file = path.join(root, 'requirements.txt');
  if (!fs.existsSync(file)) return [];
  const out: DepFact[] = [];
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const clean = line.trim();
      if (!clean || clean.startsWith('#')) continue;
      const match = clean.match(/^([A-Za-z0-9_.-]+)\s*(?:[=<>!~]=?\s*([^\s;]+))?/);
      if (match) out.push({ name: match[1]!, version: match[2] ?? '*', dev: false });
    }
  } catch {
    // ignore unreadable requirements
  }
  return out;
}

function readPackageDeps(root: string): DepFact[] {
  const file = path.join(root, 'package.json');
  if (!fs.existsSync(file)) return [];
  try {
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const out: DepFact[] = [];
    for (const [name, version] of Object.entries(pkg.dependencies ?? {})) out.push({ name, version, dev: false });
    for (const [name, version] of Object.entries(pkg.devDependencies ?? {})) out.push({ name, version, dev: true });
    return out;
  } catch {
    return [];
  }
}

function packageEntrypoints(root: string): string[] {
  const file = path.join(root, 'package.json');
  if (!fs.existsSync(file)) return [];
  try {
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
    const out: string[] = [];
    for (const key of ['main', 'module', 'browser']) {
      if (typeof pkg[key] === 'string') out.push(toPosix(pkg[key] as string));
    }
    return out;
  } catch {
    return [];
  }
}

export function scanProject(project: Project, opts: { full?: boolean } = {}): ScanResult {
  const started = Date.now();
  const previous = opts.full ? null : loadFacts(project);
  const prevByPath = new Map<string, FactsFile>((previous?.files ?? []).map((f) => [f.path, f]));
  const candidates = listCandidates(project);
  const files: FactsFile[] = [];
  const routes: RouteFact[] = [];
  const models: ModelFact[] = [];
  const envMap = new Map<string, Set<string>>();
  const entrypoints = new Set<string>();
  let parsedCount = 0;
  let reusedCount = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const pkg = path.posix.basename(candidate.rel) === 'package.json';
    if (pkg) {
      for (const entry of packageEntrypoints(project.root)) entrypoints.add(entry);
      continue;
    }
    if (path.posix.basename(candidate.rel) === 'requirements.txt') {
      continue;
    }
    if (candidate.secret) {
      files.push({
        path: candidate.rel,
        lang: candidate.lang,
        size: candidate.size,
        hash: '',
        imports: [],
        exports: [],
        symbols: [],
        mtimeMs: candidate.mtimeMs,
        secret: true,
      });
      skipped++;
      continue;
    }
    const cached = prevByPath.get(candidate.rel);
    if (cached && !cached.secret && cached.mtimeMs === candidate.mtimeMs && cached.size === candidate.size) {
      files.push(cached);
      for (const r of previous?.routes ?? []) if (r.file === candidate.rel) routes.push(r);
      for (const m of previous?.models ?? []) if (m.file === candidate.rel) models.push(m);
      reusedCount++;
      continue;
    }
    let text: string;
    try {
      text = fs.readFileSync(candidate.abs, 'utf8').replace(/^\uFEFF/, '');
    } catch {
      skipped++;
      continue;
    }
    const fact: FactsFile = {
      path: candidate.rel,
      lang: candidate.lang,
      size: candidate.size,
      hash: sha1(text),
      imports: [],
      exports: [],
      symbols: [],
      lines: text.split('\n').length,
      mtimeMs: candidate.mtimeMs,
    };
    if (candidate.size <= MAX_PARSE_BYTES) {
      let result: TsFileResult | null = null;
      try {
        if (['ts', 'tsx', 'js', 'jsx'].includes(candidate.lang)) {
          result = scanTs(candidate.rel, text, candidate.lang);
        } else if (candidate.lang === 'py') {
          result = scanPython(candidate.rel, text);
        } else if (candidate.lang === 'prisma') {
          models.push(...parsePrisma(candidate.rel, text));
        } else if (isCodeLanguage(candidate.lang)) {
          result = scanGenericImports(candidate.rel, text, candidate.lang);
        }
      } catch {
        result = null;
      }
      if (result) {
        fact.imports = result.imports;
        fact.exports = result.exports;
        fact.symbols = result.symbols;
        routes.push(...result.routes);
        models.push(...result.models);
        for (const envName of result.env) {
          if (!envMap.has(envName)) envMap.set(envName, new Set());
          envMap.get(envName)!.add(candidate.rel);
        }
        parsedCount++;
      }
    } else {
      skipped++;
    }
    files.push(fact);
  }

  // Deduplicate models/routes but preserve deterministic order.
  const modelKey = new Set<string>();
  const uniqueModels = models.filter((m) => {
    const key = `${m.name} ${m.file}`;
    if (modelKey.has(key)) return false;
    modelKey.add(key);
    return true;
  });
  const routeKey = new Set<string>();
  const uniqueRoutes = routes.filter((r) => {
    const key = `${r.method} ${r.path} ${r.file}:${r.line}`;
    if (routeKey.has(key)) return false;
    routeKey.add(key);
    return true;
  });

  const allPaths = new Set(files.map((f) => f.path));
  for (const candidate of ['src/index.ts', 'src/index.tsx', 'src/server.ts', 'src/main.ts', 'src/main.tsx', 'app/page.tsx', 'app/main.py', 'main.py', 'manage.py', 'index.js', 'server.js']) {
    if (allPaths.has(candidate)) entrypoints.add(candidate);
  }
  for (const r of uniqueRoutes) if (/(?:server|main|index)\.(?:ts|js|py)$/.test(r.file)) entrypoints.add(r.file);

  const deps = [...readPackageDeps(project.root), ...parseRequirements(project.root)].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const env: EnvFact[] = [...envMap.entries()]
    .map(([name, set]) => ({ name, files: [...set].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const facts: Facts = {
    schema: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
    routes: uniqueRoutes.sort((a, b) => `${a.file}${a.line}`.localeCompare(`${b.file}${b.line}`)),
    models: uniqueModels.sort((a, b) => `${a.file}${a.name}`.localeCompare(`${b.file}${b.name}`)),
    env,
    deps,
    entrypoints: [...entrypoints].sort(),
  };

  writeFileAtomicSyncSafe(factsPath(project), `${JSON.stringify(facts, null, 2)}\n`);
  return {
    facts,
    stats: {
      files: facts.files.length,
      parsed: parsedCount,
      reused: reusedCount,
      skipped,
      routes: facts.routes.length,
      models: facts.models.length,
      durationMs: Date.now() - started,
    },
  };
}

function writeFileAtomicSyncSafe(file: string, content: string): void {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, 'utf8');
  } catch {
    // The scan result is still usable in memory; the cache is best-effort.
  }
}

export function findSymbol(facts: Facts, rel: string, symbol: string): { file: FactsFile; found: boolean } | null {
  const file = facts.files.find((f) => f.path === rel);
  if (!file) return null;
  return { file, found: file.symbols.some((s) => s.name === symbol) };
}
