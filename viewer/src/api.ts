import type {
  ChangeEntry,
  CheckReport,
  CoverageReport,
  EvidenceMap,
  HistoryPoint,
  Issue,
  MapDiff,
  MapLayoutSidecar,
  MapSummary,
  Phase,
  ProjectConfig,
  Suggestion,
  Theme,
  VibeMap,
} from '@core/types';

export interface BootInfo {
  token: string;
  port?: number;
  host?: string;
  version?: string;
  projectName?: string;
  mode?: string;
}

declare global {
  interface Window {
    __VIBEMAP__?: BootInfo;
  }
}

const queryToken = new URLSearchParams(window.location.search).get('token');
export const boot: BootInfo = window.__VIBEMAP__ ?? {
  token: queryToken ?? localStorage.getItem('vibemap-token') ?? '',
  mode: 'dev',
};

if (boot.token) localStorage.setItem('vibemap-token', boot.token);

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('x-vibemap-token', boot.token);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`/api${path}`, { ...init, headers });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const error = (data as { error?: { code?: string; message?: string; details?: unknown } })?.error;
    throw new ApiError(response.status, error?.code ?? `HTTP_${response.status}`, error?.message ?? response.statusText, error?.details ?? data);
  }
  return data as T;
}

export interface MapDetail {
  id: string;
  rev: string;
  file: string;
  map: VibeMap;
  layout: MapLayoutSidecar | null;
  evidence: EvidenceMap;
  issues: { errors: Issue[]; warnings: Issue[] };
  locked: string[];
  error: { issues: Issue[]; message: string } | null;
  stale: boolean;
  theme: Theme;
  project: {
    name: string;
    tracking: ProjectConfig['tracking'];
    glossary: Record<string, string>;
    editing: ProjectConfig['editing'];
  };
}

export interface ProjectInfo {
  root: string;
  name: string;
  config: ProjectConfig;
  theme: Theme;
  git: { available: boolean; branch?: string; head?: string };
  versions: { vibemap: string; schema: number; node: string };
  server: { port: number; host: string; startedAt: string };
  check: { ok: boolean; errors: number; warnings: number } | null;
}

export interface PhaseProgress extends Phase {
  planned: number;
  built: number;
  total: number;
}

export interface NoteEntry {
  path: string;
  title: string;
  maps: string[];
  nodes: string[];
  body: string;
  raw: string;
}

export interface SearchResult {
  type: 'map' | 'node' | 'change' | 'note';
  id: string;
  label: string;
  map?: string;
  node?: string;
}

export interface ActivityEntry {
  changes: ChangeEntry[];
}

export const api = {
  project: () => request<ProjectInfo>('/project'),
  maps: () => request<{ maps: MapSummary[]; check: CheckReport | null }>('/maps'),
  createMap: (body: { id: string; title?: string; type?: string; level?: string }) =>
    request<{ map: VibeMap; file: string; rev: string; detail: MapDetail }>('/maps', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  bootstrap: () => request<{ prompt: string; summary: { files: number; routes: number; models: number; deps: number } }>('/bootstrap', { method: 'POST' }),
  map: (id: string) => request<MapDetail>(`/maps/${id.split('/').map(encodeURIComponent).join('/')}`),
  mapAt: (id: string, rev: string) =>
    request<{ map: VibeMap; content: string; rev: string }>(`/maps/${id.split('/').map(encodeURIComponent).join('/')}/at/${encodeURIComponent(rev)}`),
  ops: (id: string, body: { baseRev?: string; ops: unknown[]; origin?: string }) =>
    request<MapDetail & { changedNodeIds: string[] }>(`/maps/${id.split('/').map(encodeURIComponent).join('/')}/ops`, {
      method: 'POST',
      body: JSON.stringify({ ...body, origin: body.origin ?? 'human' }),
    }),
  saveLayout: (id: string, layout: MapLayoutSidecar) =>
    request<MapLayoutSidecar>(`/maps/${id.split('/').map(encodeURIComponent).join('/')}/layout`, {
      method: 'PUT',
      body: JSON.stringify({ layout }),
    }),
  history: (id: string, limit = 80) =>
    request<{ history: HistoryPoint[] }>(`/maps/${id.split('/').map(encodeURIComponent).join('/')}/history?limit=${limit}`),
  diff: (map: string, base: string, head = 'working') =>
    request<MapDiff>(`/diff?map=${encodeURIComponent(map)}&base=${encodeURIComponent(base)}&head=${encodeURIComponent(head)}`),
  changes: () => request<{ changes: ChangeEntry[] }>('/changes'),
  phases: () => request<{ phases: PhaseProgress[] }>('/phases'),
  addPhase: (title: string, goal?: string) =>
    request<Phase>('/phases', { method: 'POST', body: JSON.stringify({ title, goal }) }),
  phaseAction: (id: string, action: 'start' | 'done') =>
    request<Phase>(`/phases/${encodeURIComponent(id)}/${action}`, { method: 'POST' }),
  notes: () => request<{ notes: NoteEntry[] }>('/notes'),
  note: (path: string) => request<NoteEntry>(`/notes/${path.replace(/^\.vibemap\/notes\//, '').split('/').map(encodeURIComponent).join('/')}`),
  saveNote: (path: string, content: string) =>
    request<NoteEntry>(`/notes/${path.replace(/^\.vibemap\/notes\//, '').split('/').map(encodeURIComponent).join('/')}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),
  check: () => request<CheckReport>('/check'),
  runCheck: () => request<CheckReport>('/check/run', { method: 'POST' }),
  coverage: () => request<CoverageReport>('/coverage'),
  suggest: (limit = 20) => request<{ suggestions: Suggestion[] }>(`/suggest?limit=${limit}`),
  code: (path: string, from?: number, to?: number) =>
    request<{ path: string; from: number; to: number; content: string; language: string; truncated: boolean }>(
      `/code?path=${encodeURIComponent(path)}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`,
    ),
  locks: (map: string, node: string, locked: boolean) =>
    request<{ map: string; node: string; locked: boolean }>('/locks', {
      method: 'POST',
      body: JSON.stringify({ map, node, locked }),
    }),
  explain: (body: { map?: string; node?: string; change?: string }) =>
    request<{ prompt: string }>('/prompt/explain', { method: 'POST', body: JSON.stringify(body) }),
  search: (q: string) => request<{ results: SearchResult[] }>(`/search?q=${encodeURIComponent(q)}`),
  config: (body: { mode?: string; granularity?: string }) =>
    request<{ config: ProjectConfig }>('/config', { method: 'POST', body: JSON.stringify(body) }),
  activity: () => request<ActivityEntry>('/activity'),
  drift: () => request<unknown>('/drift'),
  exportMap: async (id: string, format: string): Promise<Blob> => {
    const response = await fetch(`/api/export/${id.split('/').map(encodeURIComponent).join('/')}?format=${encodeURIComponent(format)}`, {
      headers: { 'x-vibemap-token': boot.token },
    });
    if (!response.ok) {
      const text = await response.text();
      let message = text;
      try {
        message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? text;
      } catch {
        // plain text
      }
      throw new ApiError(response.status, 'EXPORT_FAILED', message);
    }
    return response.blob();
  },
};

export interface ServerEvent {
  type: string;
  data: unknown;
  at: string;
}

export function connectEvents(onEvent: (event: ServerEvent) => void, onStatus: (status: 'connecting' | 'live' | 'offline') => void): () => void {
  let closed = false;
  let socket: WebSocket | null = null;
  let retry = 0;
  let timer: number | undefined;

  const open = (): void => {
    if (closed) return;
    onStatus(retry === 0 ? 'connecting' : 'offline');
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${protocol}://${window.location.host}/ws?token=${encodeURIComponent(boot.token)}`;
    socket = new WebSocket(url);
    socket.onopen = () => {
      retry = 0;
      onStatus('live');
    };
    socket.onmessage = (message) => {
      try {
        onEvent(JSON.parse(message.data as string) as ServerEvent);
      } catch {
        // ignore malformed frames
      }
    };
    socket.onclose = () => {
      onStatus('offline');
      if (closed) return;
      retry = Math.min(retry + 1, 6);
      timer = window.setTimeout(open, Math.min(10_000, 500 * 2 ** retry));
    };
    socket.onerror = () => socket?.close();
  };
  open();
  return () => {
    closed = true;
    if (timer) window.clearTimeout(timer);
    socket?.close();
  };
}

export function isMapDetail(value: unknown): value is MapDetail {
  return !!value && typeof value === 'object' && 'map' in value;
}
