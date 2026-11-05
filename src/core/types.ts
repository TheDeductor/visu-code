/**
 * Shared domain types for VibeMap.
 *
 * These types are the contract between the CLI, server, scanner and viewer.
 * Everything here is plain data and safe to import from the browser.
 */

export const SCHEMA_VERSION = 1 as const;
export const MAP_SUFFIX = '.vmap.yaml';
export const MAPS_DIR = '.vibemap';
export const DEFAULT_PORT = 4317;

export const NODE_KINDS = [
  'ui',
  'page',
  'component',
  'api',
  'service',
  'module',
  'function',
  'file',
  'database',
  'queue',
  'cache',
  'storage',
  'external',
  'actor',
  'decision',
  'process',
  'config',
  'note',
  'custom',
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export const EDGE_KINDS = [
  'calls',
  'reads',
  'writes',
  'imports',
  'data',
  'event',
  'depends',
  'returns',
  'flow',
  'contains',
] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

export const NODE_STATUSES = ['planned', 'built', 'deprecated'] as const;
export type NodeStatus = (typeof NODE_STATUSES)[number];

export const MAP_TYPES = ['graph', 'sequence', 'erd', 'mermaid'] as const;
export type MapType = (typeof MAP_TYPES)[number];

export const MAP_LEVELS = ['overview', 'feature', 'detail'] as const;
export type MapLevel = (typeof MAP_LEVELS)[number];

export const DIRECTIONS = ['right', 'down', 'left', 'up'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const GROUP_KINDS = ['boundary', 'layer', 'team'] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

export type EvidenceStatus = 'verified' | 'declared' | 'stale' | 'planned';

export interface CodeRef {
  path: string;
  symbol?: string;
  lines?: [number, number];
}

export interface VibeNode {
  id: string;
  label: string;
  kind: NodeKind;
  group?: string;
  status?: NodeStatus;
  description?: string;
  plain?: string;
  refs?: CodeRef[];
  tags?: string[];
  phase?: string;
  /** Optional map id to open when this node is activated (drill-down). */
  drill?: string;
}

export interface VibeEdge {
  id?: string;
  from: string;
  to: string;
  label?: string;
  kind: EdgeKind;
  description?: string;
}

export interface VibeGroup {
  id: string;
  label: string;
  kind?: GroupKind;
  phase?: string;
}

export interface WalkthroughStep {
  focus: string[];
  text: string;
}

export interface MapBase {
  schema: typeof SCHEMA_VERSION;
  title: string;
  level?: MapLevel;
  direction?: Direction;
  summary?: string;
  phase?: string;
  tags?: string[];
  notes?: string[];
}

export interface GraphMap extends MapBase {
  type: 'graph';
  groups?: VibeGroup[];
  nodes: VibeNode[];
  edges: VibeEdge[];
  walkthrough?: WalkthroughStep[];
}

export interface SequenceParticipant {
  id: string;
  label: string;
  kind?: NodeKind;
  refs?: CodeRef[];
}

export type SequenceStepKind = 'call' | 'return' | 'async' | 'event' | 'note';

export interface SequenceStep {
  id?: string;
  from: string;
  to: string;
  label: string;
  kind?: SequenceStepKind;
}

export interface SequenceFragment {
  id?: string;
  kind: 'alt' | 'opt' | 'loop' | 'par';
  label?: string;
  from_step: number;
  to_step: number;
}

export interface SequenceMap extends MapBase {
  type: 'sequence';
  participants: SequenceParticipant[];
  steps: SequenceStep[];
  fragments?: SequenceFragment[];
}

export type ErdKey = 'pk' | 'fk' | 'unique' | '';

export interface ErdField {
  name: string;
  type: string;
  key?: ErdKey;
  ref?: string;
}

export interface ErdEntity {
  id: string;
  label: string;
  refs?: CodeRef[];
  group?: string;
  fields: ErdField[];
}

export type ErdCardinality = '1..1' | '1..n' | 'n..1' | 'n..n';

export interface ErdRelation {
  id?: string;
  from: string;
  to: string;
  card?: ErdCardinality;
  label?: string;
}

export interface ErdMap extends MapBase {
  type: 'erd';
  entities: ErdEntity[];
  relations: ErdRelation[];
}

export interface MermaidMap extends MapBase {
  type: 'mermaid';
  source: string;
}

export type VibeMap = GraphMap | SequenceMap | ErdMap | MermaidMap;

export interface RefEvidence {
  ref: CodeRef;
  pathExists: boolean;
  symbolFound?: boolean;
  linesValid?: boolean;
  /** verified only when every check that can run passed. */
  status: EvidenceStatus;
  detail?: string;
}

export interface NodeEvidence {
  status: EvidenceStatus;
  refs: RefEvidence[];
  /** True when there is at least one ref but none of them resolve. */
  stale: boolean;
}

export type EvidenceMap = Record<string, NodeEvidence>;

export interface MapSummary {
  id: string;
  path: string;
  title: string;
  type: MapType;
  level?: MapLevel;
  phase?: string;
  summary?: string;
  nodeCount: number;
  edgeCount: number;
  rev: string;
  updatedAt?: string;
  errors: number;
  warnings: number;
  drift: boolean;
  /** True when the map file is currently invalid and this summary is a last-good fallback. */
  stale?: boolean;
}

export interface ProjectConfig {
  schema: typeof SCHEMA_VERSION;
  project: { name: string };
  tracking: {
    mode: TrackingMode;
    granularity: MapLevel;
    changeLog: boolean;
  };
  agents: AgentTarget[];
  paths: { include: string[]; exclude: string[] };
  limits: {
    softMaxNodes: number;
    hardMaxNodes: number;
    maxLabelChars: number;
    maxDescriptionChars: number;
  };
  validation: { strict: boolean; requireRefs: boolean };
  editing: { autoLockHumanEdits: boolean; newNodeStatus: NodeStatus };
  viewer: {
    port: number;
    host: string;
    open: boolean;
    defaultTab: ViewerTab;
    beginnerMode: boolean;
  };
  history: { source: 'git' | 'journal'; journalMaxEntries: number };
  coverage: { target: number };
  glossary: Record<string, string>;
  privacy: { llm: 'none' | 'anthropic' | 'openai' | 'ollama'; telemetry: boolean };
}

export type TrackingMode = 'every-change' | 'per-phase' | 'manual' | 'off';
export type AgentTarget =
  | 'claude-code'
  | 'cursor'
  | 'codex'
  | 'copilot'
  | 'gemini'
  | 'windsurf'
  | 'aider'
  | 'generic';
export type ViewerTab = 'maps' | 'changes' | 'timeline' | 'phases' | 'notes' | 'coverage';

export interface Theme {
  schema: typeof SCHEMA_VERSION;
  font: 'hand' | 'normal' | 'code';
  roughness: 0 | 1 | 2;
  strokeWidth: number;
  /** @deprecated Deprecated alias for nodeSep and rankSep / 2. Kept for backward compatibility. */
  gap: number;
  rankSep: number;
  nodeSep: number;
  groupPad: { x: number; top: number; bottom: number };
  groupSep: number;
  nodeMargin: number;
  minNodeSize: { w: number; h: number };
  maxLabelWidth: number;
  colors: {
    ui: string;
    api: string;
    database: string;
    external: string;
    queue: string;
    neutral: string;
    actor: string;
    decision: string;
    note: string;
    background: string;
    ink: string;
  };
}

export interface Phase {
  id: string;
  title: string;
  goal?: string;
  status: 'planned' | 'active' | 'done';
  started?: string;
  finished?: string;
  snapshot?: string;
}

export interface PhasesFile {
  schema: typeof SCHEMA_VERSION;
  phases: Phase[];
}

export interface LayoutNode {
  x: number;
  y: number;
  w: number;
  h: number;
  pinned?: boolean;
}

export interface VibeAnnotation {
  id: string;
  type: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  text?: string;
  color?: string;
  points?: Array<[number, number]>;
  [key: string]: unknown;
}

export interface MapLayoutSidecar {
  schema: typeof SCHEMA_VERSION;
  map: string;
  nodes: Record<string, LayoutNode>;
  groups?: Record<string, { collapsed?: boolean; [key: string]: unknown }>;
  annotations?: VibeAnnotation[];
  viewport?: { x: number; y: number; zoom: number };
}

export interface LockFile {
  schema: typeof SCHEMA_VERSION;
  locks: Record<string, string>;
}

export interface ChangeDelta {
  added_nodes: string[];
  modified_nodes: string[];
  removed_nodes: string[];
  added_edges: number;
  removed_edges: number;
}

export interface ChangeEntry {
  schema: typeof SCHEMA_VERSION;
  id: string;
  title: string;
  date: string;
  type: 'feature' | 'fix' | 'refactor' | 'plan' | 'docs';
  phase?: string;
  author: string;
  maps: string[];
  commit?: string | null;
  /** Map id to the revision the change delta was computed against. */
  bases?: Record<string, string>;
  delta: ChangeDelta;
  body: string;
  file: string;
}

export interface NoteEntry {
  path: string;
  title: string;
  maps: string[];
  nodes: string[];
  body: string;
  raw: string;
}

export interface Issue {
  code: string;
  severity: 'error' | 'warning';
  file: string;
  line?: number;
  col?: number;
  message: string;
  hint?: string;
  fix?: string;
}

export interface CheckStats {
  maps: number;
  nodes: number;
  edges: number;
  verified: number;
  declared: number;
  stale: number;
  planned: number;
  coverage?: number;
}

export interface CheckReport {
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
  stats: CheckStats;
  generatedAt: string;
}

export interface CheckOptions {
  strict?: boolean;
  runScan?: boolean;
  includeWarnings?: boolean;
  coverage?: boolean;
}

export interface CodeSymbol {
  name: string;
  kind: string;
  line: number;
}

export interface FactsFile {
  path: string;
  lang: string;
  size: number;
  hash: string;
  imports: string[];
  exports: string[];
  symbols: CodeSymbol[];
  lines?: number;
  mtimeMs?: number;
  /** Files matching secret patterns are inventoried but never read. */
  secret?: boolean;
}

export interface RouteFact {
  method: string;
  path: string;
  file: string;
  line: number;
}

export interface ModelFact {
  name: string;
  file: string;
  fields: string[];
}

export interface EnvFact {
  name: string;
  files: string[];
}

export interface DepFact {
  name: string;
  version: string;
  dev: boolean;
}

export interface Facts {
  schema: typeof SCHEMA_VERSION;
  generatedAt: string;
  files: FactsFile[];
  routes: RouteFact[];
  models: ModelFact[];
  env: EnvFact[];
  deps: DepFact[];
  entrypoints: string[];
}

export interface CoverageReport {
  target: number;
  totalFiles: number;
  coveredFiles: number;
  percent: number;
  byDirectory: Array<{ dir: string; total: number; covered: number; percent: number }>;
  unmapped: string[];
  unverified: Array<{ map: string; node: string; label: string; status: EvidenceStatus }>;
}

export interface DriftReport {
  ok: boolean;
  changedFiles: string[];
  direct: Array<{ map: string; files: string[] }>;
  unmapped: string[];
  removedRefs: Array<{ map: string; node: string; path: string }>;
  generatedAt: string;
}

export interface Suggestion {
  priority: number;
  kind: 'route' | 'model' | 'env' | 'entrypoint' | 'unmapped' | 'unverified';
  title: string;
  file?: string;
  line?: number;
  map?: string;
  prompt: string;
}

export interface JournalEntry {
  schema: typeof SCHEMA_VERSION;
  id: string;
  ts: string;
  map: string;
  rev: string;
  origin: string;
  summary: string;
  content: string;
}

export interface HistoryPoint {
  id: string;
  ts: string;
  kind: 'journal' | 'git';
  origin?: string;
  summary: string;
  commit?: string;
  rev: string;
}

export interface MapDiff {
  map: string;
  base: string;
  head: string;
  added: VibeNode[];
  removed: VibeNode[];
  modified: Array<{ id: string; before: VibeNode; after: VibeNode; fields: string[] }>;
  addedEdges: VibeEdge[];
  removedEdges: VibeEdge[];
  modifiedEdges: Array<{ id: string; before: VibeEdge; after: VibeEdge; fields: string[] }>;
  baseMap?: VibeMap;
  headMap?: VibeMap;
  possibleRenames?: Array<{ from: string; to: string; reason: string }>;
}

export interface LayoutBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  labelLines: string[];
  kind: string;
  group?: string;
  pinned?: boolean;
}

export interface LayoutEdge {
  id: string;
  from: string;
  to: string;
  kind: string;
  label?: string;
  labelLines: string[];
  path: string;
  points: Array<{ x: number; y: number }>;
  labelPos: { x: number; y: number };
}

export interface LayoutGroup {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GraphLayout {
  type: 'graph';
  width: number;
  height: number;
  nodes: LayoutBox[];
  edges: LayoutEdge[];
  groups: LayoutGroup[];
  direction: Direction;
  warnings: string[];
}

export interface SequenceParticipantLayout {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  lifelineBottom: number;
}

export interface SequenceStepLayout {
  index: number;
  from: string;
  to: string;
  y: number;
  label: string;
  kind: string;
  reverse: boolean;
}

export interface SequenceFragmentLayout {
  index: number;
  kind: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SequenceLayout {
  type: 'sequence';
  width: number;
  height: number;
  participants: SequenceParticipantLayout[];
  steps: SequenceStepLayout[];
  fragments: SequenceFragmentLayout[];
}

export interface ErdFieldLayout {
  name: string;
  type: string;
  key: string;
}

export interface ErdEntityLayout extends LayoutBox {
  fields: ErdFieldLayout[];
}

export interface ErdLayout {
  type: 'erd';
  width: number;
  height: number;
  entities: ErdEntityLayout[];
  relations: LayoutEdge[];
}

export interface MermaidLayout {
  type: 'mermaid';
  width: number;
  height: number;
  source: string;
}

export type LayoutResult = GraphLayout | SequenceLayout | ErdLayout | MermaidLayout;

export interface OpsFile {
  ops: PatchOp[];
}

export type PatchOp =
  | { op: 'add_node'; node: Partial<VibeNode> & { label: string } }
  | { op: 'update_node'; id: string; set: Partial<VibeNode> }
  | { op: 'remove_node'; id: string }
  | { op: 'rename_node'; id: string; to: string }
  | { op: 'add_edge'; edge: Partial<VibeEdge> & { from: string; to: string } }
  | { op: 'update_edge'; id: string; set: Partial<VibeEdge> }
  | { op: 'remove_edge'; id: string }
  | { op: 'add_group'; group: VibeGroup }
  | { op: 'update_group'; id: string; set: Partial<VibeGroup> }
  | { op: 'remove_group'; id: string }
  | { op: 'set_meta'; set: Partial<MapBase> }
  | { op: 'set_walkthrough'; steps: WalkthroughStep[] }
  | { op: 'add_step'; step: SequenceStep }
  | { op: 'add_entity'; entity: Partial<ErdEntity> & { label: string } }
  | { op: 'add_field'; entity: string; field: ErdField }
  | { op: 'add_relation'; relation: ErdRelation }
  | { op: 'set_source'; source: string };

export interface ApplyOpsResult {
  map: VibeMap;
  content: string;
  changedNodeIds: string[];
  changedEdgeIds: string[];
  journalSummary: string;
}

export interface ProjectInfo {
  root: string;
  name: string;
  config: ProjectConfig;
  theme: Theme;
  git: { available: boolean; branch?: string; head?: string; dirty?: boolean };
  hasMaps: boolean;
  versions: { vibemap: string; schema: number; node: string };
}

export interface ServerInfo {
  port: number;
  token: string;
  pid: number;
  url: string;
  startedAt: string;
  root: string;
}

export interface BootstrapInfo {
  prompt: string;
  summary: {
    files: number;
    routes: number;
    models: number;
    deps: number;
    entrypoints: string[];
  };
}

export interface AgentGuideOptions {
  config: ProjectConfig;
  packageVersion: string;
}
