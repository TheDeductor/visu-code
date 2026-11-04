import { z } from 'zod';
import {
  DIRECTIONS,
  EDGE_KINDS,
  GROUP_KINDS,
  MAP_LEVELS,
  MAP_TYPES,
  NODE_KINDS,
  NODE_STATUSES,
} from './types.js';
import { defaultConfig, defaultTheme } from './defaults.js';

export const SCHEMA_LITERAL = z.literal(1);
export const ID_RE = /^[a-z][a-z0-9-]{0,47}$/;
export const IdSchema = z
  .string()
  .regex(ID_RE, 'IDs must be kebab-case: start with a-z, then a-z/0-9/- (max 48 chars)');
export const MapIdSchema = z
  .string()
  .min(1)
  .max(160)
  .refine((v) => !v.startsWith('/') && !v.includes('..') && !v.includes('\\'), 'Invalid map id');

const relPath = z
  .string()
  .min(1)
  .refine((p) => !p.startsWith('/') && !/^[a-zA-Z]:/.test(p) && !p.split('/').includes('..'), 'Path must be repo-relative');

export const CodeRefSchema = z
  .object({
    path: relPath,
    symbol: z.string().min(1).optional(),
    lines: z
      .tuple([z.number().int().min(1), z.number().int().min(1)])
      .refine(([a, b]) => a <= b, 'lines must be [start, end] with start <= end')
      .optional(),
  })
  .strict();

export const NodeSchema = z
  .object({
    id: IdSchema,
    label: z.string().min(1),
    kind: z.enum(NODE_KINDS),
    group: IdSchema.optional(),
    status: z.enum(NODE_STATUSES).optional(),
    description: z.string().optional(),
    plain: z.string().optional(),
    refs: z.array(CodeRefSchema).optional(),
    tags: z.array(z.string().min(1)).optional(),
    phase: z.string().min(1).optional(),
    drill: MapIdSchema.optional(),
  })
  .strict();

export const EdgeSchema = z
  .object({
    id: z.string().min(1).optional(),
    from: IdSchema,
    to: IdSchema,
    label: z.string().optional(),
    kind: z.enum(EDGE_KINDS),
    description: z.string().optional(),
  })
  .strict();

export const GroupSchema = z
  .object({
    id: IdSchema,
    label: z.string().min(1),
    kind: z.enum(GROUP_KINDS).optional(),
    phase: z.string().min(1).optional(),
  })
  .strict();

export const WalkthroughStepSchema = z
  .object({
    focus: z.array(IdSchema).min(1),
    text: z.string().min(1),
  })
  .strict();

export const BaseFields = {
  schema: SCHEMA_LITERAL,
  title: z.string().min(1),
  level: z.enum(MAP_LEVELS).optional(),
  direction: z.enum(DIRECTIONS).optional(),
  summary: z.string().optional(),
  phase: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional(),
  notes: z.array(relPath).optional(),
};

export const GraphMapSchema = z
  .object({
    ...BaseFields,
    type: z.literal('graph'),
    groups: z.array(GroupSchema).optional(),
    nodes: z.array(NodeSchema),
    edges: z.array(EdgeSchema),
    walkthrough: z.array(WalkthroughStepSchema).optional(),
  })
  .strict();

export const ParticipantSchema = z
  .object({
    id: IdSchema,
    label: z.string().min(1),
    kind: z.enum(NODE_KINDS).optional(),
    refs: z.array(CodeRefSchema).optional(),
  })
  .strict();

export const SequenceStepSchema = z
  .object({
    id: z.string().min(1).optional(),
    from: IdSchema,
    to: IdSchema,
    label: z.string().min(1),
    kind: z.enum(['call', 'return', 'async', 'event', 'note']).optional(),
  })
  .strict();

export const SequenceFragmentSchema = z
  .object({
    id: z.string().min(1).optional(),
    kind: z.enum(['alt', 'opt', 'loop', 'par']),
    label: z.string().optional(),
    from_step: z.number().int().min(0),
    to_step: z.number().int().min(0),
  })
  .strict();

export const SequenceMapSchema = z
  .object({
    ...BaseFields,
    type: z.literal('sequence'),
    participants: z.array(ParticipantSchema),
    steps: z.array(SequenceStepSchema),
    fragments: z.array(SequenceFragmentSchema).optional(),
  })
  .strict();

export const ErdFieldSchema = z
  .object({
    name: z.string().min(1),
    type: z.string().min(1),
    key: z.enum(['pk', 'fk', 'unique', '']).optional(),
    ref: z.string().optional(),
  })
  .strict();

export const ErdEntitySchema = z
  .object({
    id: IdSchema,
    label: z.string().min(1),
    refs: z.array(CodeRefSchema).optional(),
    group: IdSchema.optional(),
    fields: z.array(ErdFieldSchema).default([]),
  })
  .strict();

export const ErdRelationSchema = z
  .object({
    id: z.string().min(1).optional(),
    from: IdSchema,
    to: IdSchema,
    card: z.enum(['1..1', '1..n', 'n..1', 'n..n']).optional(),
    label: z.string().optional(),
  })
  .strict();

export const ErdMapSchema = z
  .object({
    ...BaseFields,
    type: z.literal('erd'),
    entities: z.array(ErdEntitySchema),
    relations: z.array(ErdRelationSchema),
  })
  .strict();

export const MermaidMapSchema = z
  .object({
    ...BaseFields,
    type: z.literal('mermaid'),
    source: z.string().min(1),
  })
  .strict();

export const MapSchema = z.discriminatedUnion('type', [
  GraphMapSchema,
  SequenceMapSchema,
  ErdMapSchema,
  MermaidMapSchema,
]);

export const MapTypeSchema = z.enum(MAP_TYPES);

export const AgentTargetSchema = z.enum([
  'claude-code',
  'cursor',
  'codex',
  'copilot',
  'gemini',
  'windsurf',
  'aider',
  'generic',
]);

export const TrackingModeSchema = z.enum(['every-change', 'per-phase', 'manual', 'off']);
export const ViewerTabSchema = z.enum(['maps', 'changes', 'timeline', 'phases', 'notes', 'coverage']);

export const ConfigSchema = z
  .object({
    schema: SCHEMA_LITERAL,
    project: z.object({ name: z.string().min(1) }).strict().default({ name: 'my-app' }),
    tracking: z
      .object({
        mode: TrackingModeSchema.default('every-change'),
        granularity: z.enum(MAP_LEVELS).default('feature'),
        changeLog: z.boolean().default(true),
      })
      .strict()
      .default(defaultConfig().tracking),
    agents: z.array(AgentTargetSchema).default([]),
    paths: z
      .object({
        include: z.array(z.string()).default(['**/*']),
        exclude: z.array(z.string()).default(defaultConfig().paths.exclude),
      })
      .strict()
      .default(defaultConfig().paths),
    limits: z
      .object({
        softMaxNodes: z.number().int().min(1).default(15),
        hardMaxNodes: z.number().int().min(1).default(30),
        maxLabelChars: z.number().int().min(1).default(40),
        maxDescriptionChars: z.number().int().min(1).default(200),
      })
      .strict()
      .default(defaultConfig().limits),
    validation: z
      .object({ strict: z.boolean().default(false), requireRefs: z.boolean().default(true) })
      .strict()
      .default(defaultConfig().validation),
    editing: z
      .object({
        autoLockHumanEdits: z.boolean().default(true),
        newNodeStatus: z.enum(NODE_STATUSES).default('planned'),
      })
      .strict()
      .default(defaultConfig().editing),
    viewer: z
      .object({
        port: z.number().int().min(1).max(65535).default(4317),
        host: z.string().default('127.0.0.1'),
        open: z.boolean().default(true),
        defaultTab: ViewerTabSchema.default('maps'),
        beginnerMode: z.boolean().default(false),
      })
      .strict()
      .default(defaultConfig().viewer),
    history: z
      .object({
        source: z.enum(['git', 'journal']).default('git'),
        journalMaxEntries: z.number().int().min(1).default(500),
      })
      .strict()
      .default(defaultConfig().history),
    coverage: z.object({ target: z.number().min(0).max(100).default(60) }).strict().default({ target: 60 }),
    glossary: z.record(z.string(), z.string()).default({}),
    privacy: z
      .object({
        llm: z.enum(['none', 'anthropic', 'openai', 'ollama']).default('none'),
        telemetry: z.boolean().default(false),
      })
      .strict()
      .default({ llm: 'none', telemetry: false }),
  })
  .strict();

export const ThemeSchema = z
  .object({
    schema: SCHEMA_LITERAL,
    font: z.enum(['hand', 'normal', 'code']).default('hand'),
    roughness: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(1),
    strokeWidth: z.number().min(1).max(6).default(2),
    gap: z.number().min(20).max(200).default(60),
    minNodeSize: z
      .object({ w: z.number().min(80).max(400).default(140), h: z.number().min(30).max(200).default(56) })
      .strict()
      .default({ w: 140, h: 56 }),
    maxLabelWidth: z.number().min(120).max(500).default(220),
    colors: z
      .object({
        ui: z.string().default('#a5d8ff'),
        api: z.string().default('#d0bfff'),
        database: z.string().default('#b2f2bb'),
        external: z.string().default('#ffd8a8'),
        queue: z.string().default('#ffec99'),
        neutral: z.string().default('#e9ecef'),
        actor: z.string().default('#ffffff'),
        decision: z.string().default('#ffec99'),
        note: z.string().default('#fff3bf'),
        background: z.string().default('#f8f9fa'),
        ink: z.string().default('#1e1e1e'),
      })
      .strict()
      .default(defaultTheme().colors),
  })
  .strict();

export const PhaseSchema = z
  .object({
    id: IdSchema,
    title: z.string().min(1),
    goal: z.string().optional(),
    status: z.enum(['planned', 'active', 'done']).default('planned'),
    started: z.string().optional(),
    finished: z.string().optional(),
    snapshot: z.string().optional(),
  })
  .strict();

export const PhasesSchema = z
  .object({
    schema: SCHEMA_LITERAL,
    phases: z.array(PhaseSchema),
  })
  .strict();

export const LayoutNodeSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    w: z.number().min(20).finite(),
    h: z.number().min(20).finite(),
    pinned: z.boolean().optional(),
  })
  .strict();

export const AnnotationSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    x: z.number().finite(),
    y: z.number().finite(),
    w: z.number().finite().optional(),
    h: z.number().finite().optional(),
    text: z.string().optional(),
    color: z.string().optional(),
    points: z.array(z.tuple([z.number(), z.number()])).optional(),
  })
  .passthrough();

export const LayoutSidecarSchema = z
  .object({
    schema: SCHEMA_LITERAL,
    map: MapIdSchema,
    nodes: z.record(z.string(), LayoutNodeSchema).default({}),
    groups: z.record(z.string(), z.object({ collapsed: z.boolean().optional() }).passthrough()).optional(),
    annotations: z.array(AnnotationSchema).optional(),
    viewport: z
      .object({ x: z.number().finite(), y: z.number().finite(), zoom: z.number().positive().finite() })
      .strict()
      .optional(),
  })
  .strict();

export const LockFileSchema = z
  .object({
    schema: SCHEMA_LITERAL,
    locks: z.record(z.string(), z.string()),
  })
  .strict();

export const DeltaSchema = z
  .object({
    added_nodes: z.array(z.string()).default([]),
    modified_nodes: z.array(z.string()).default([]),
    removed_nodes: z.array(z.string()).default([]),
    added_edges: z.number().int().default(0),
    removed_edges: z.number().int().default(0),
  })
  .strict();

export const ChangeFrontmatterSchema = z
  .object({
    schema: SCHEMA_LITERAL,
    id: z.string().min(1),
    title: z.string().min(1),
    date: z.string().min(1),
    type: z.enum(['feature', 'fix', 'refactor', 'plan', 'docs']).default('feature'),
    phase: z.string().optional(),
    author: z.string().min(1).default('human:unknown'),
    maps: z.array(MapIdSchema).default([]),
    commit: z.string().nullable().optional(),
    bases: z.record(z.string()).optional(),
    delta: DeltaSchema.default({
      added_nodes: [],
      modified_nodes: [],
      removed_nodes: [],
      added_edges: 0,
      removed_edges: 0,
    }),
  })
  .strict();

export const NoteFrontmatterSchema = z
  .object({
    schema: SCHEMA_LITERAL,
    title: z.string().min(1),
    maps: z.array(MapIdSchema).default([]),
    nodes: z.array(z.string()).default([]),
  })
  .strict();

const MetaPatchSchema = z
  .object({
    title: z.string().min(1).optional(),
    level: z.enum(MAP_LEVELS).optional(),
    direction: z.enum(DIRECTIONS).optional(),
    summary: z.string().optional(),
    phase: z.string().optional(),
    tags: z.array(z.string()).optional(),
    notes: z.array(relPath).optional(),
  })
  .strict();

const NodeDraftSchema = NodeSchema.partial().required({ label: true });
const EdgeDraftSchema = EdgeSchema.partial().required({ from: true, to: true });
const EntityDraftSchema = ErdEntitySchema.partial().required({ label: true });

export const PatchOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('add_node'), node: NodeDraftSchema }).strict(),
  z.object({ op: z.literal('update_node'), id: IdSchema, set: NodeSchema.partial().strict() }).strict(),
  z.object({ op: z.literal('remove_node'), id: IdSchema }).strict(),
  z.object({ op: z.literal('rename_node'), id: IdSchema, to: IdSchema }).strict(),
  z.object({ op: z.literal('add_edge'), edge: EdgeDraftSchema }).strict(),
  z.object({ op: z.literal('update_edge'), id: z.string().min(1), set: EdgeSchema.partial().strict() }).strict(),
  z.object({ op: z.literal('remove_edge'), id: z.string().min(1) }).strict(),
  z.object({ op: z.literal('add_group'), group: GroupSchema }).strict(),
  z.object({ op: z.literal('update_group'), id: IdSchema, set: GroupSchema.partial().strict() }).strict(),
  z.object({ op: z.literal('remove_group'), id: IdSchema }).strict(),
  z.object({ op: z.literal('set_meta'), set: MetaPatchSchema }).strict(),
  z.object({ op: z.literal('set_walkthrough'), steps: z.array(WalkthroughStepSchema) }).strict(),
  z.object({ op: z.literal('add_step'), step: SequenceStepSchema }).strict(),
  z.object({ op: z.literal('add_entity'), entity: EntityDraftSchema }).strict(),
  z.object({
    op: z.literal('add_field'),
    entity: IdSchema,
    field: ErdFieldSchema,
  }).strict(),
  z.object({ op: z.literal('add_relation'), relation: ErdRelationSchema }).strict(),
  z.object({ op: z.literal('set_source'), source: z.string().min(1) }).strict(),
]);

export const OpsFileSchema = z.object({ ops: z.array(PatchOpSchema).min(1) }).strict();

export type ConfigInput = z.input<typeof ConfigSchema>;
export type ThemeInput = z.input<typeof ThemeSchema>;
