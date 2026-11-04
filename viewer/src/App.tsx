import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChangeEntry,
  CheckReport,
  CoverageReport,
  HistoryPoint,
  Issue,
  LayoutBox,
  LayoutResult,
  MapDiff,
  MapLayoutSidecar,
  MapSummary,
  PatchOp,
  Phase,
  Suggestion,
  ViewerTab,
  VibeAnnotation,
  VibeMap,
  VibeNode,
} from '@core/types';
import { layoutMap } from '@core/layout';
import { api, boot, connectEvents, type MapDetail, type NoteEntry, type PhaseProgress, type ProjectInfo, type SearchResult } from './api';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { MapCanvas } from './canvas/MapCanvas';
import { Inspector } from './components/Inspector';
import { ActivityPanel, ChangesPanel, CoveragePanel, NotesPanel, PhasesPanel, ProblemsPanel, TimelinePanel } from './components/Panels';
import { AddNodeModal, EdgeModal, NewMapModal, PromptModal, SearchModal, SettingsModal, ShortcutsModal, StickyModal, TourModal } from './components/Modals';
import { EmptyState, Spinner, Toast } from './components/ui';
import { classNames, copyText, mapIdFromIssueFile, promptForFile } from './util';

type ModalState =
  | { kind: 'new-map' }
  | { kind: 'add-node' }
  | { kind: 'edge'; from: string; to: string }
  | { kind: 'sticky' }
  | { kind: 'settings' }
  | { kind: 'shortcuts' }
  | { kind: 'tour' }
  | { kind: 'search'; initial?: string }
  | { kind: 'prompt'; title: string; prompt: string }
  | null;

interface DiffState {
  diff: MapDiff;
  ghosts: LayoutBox[];
  states: Record<string, 'added' | 'removed' | 'modified'>;
  baseLabel: string;
}

interface WalkthroughState {
  active: boolean;
  index: number;
  playing: boolean;
}

interface PendingDetail {
  detail: MapDetail;
  message: string;
}

function emptyLayout(mapId: string): MapLayoutSidecar {
  return { schema: 1, map: mapId, nodes: {}, groups: {}, annotations: [], viewport: { x: 0, y: 0, zoom: 1 } };
}

function graphNodeIds(map: VibeMap | null | undefined): string[] {
  return map?.type === 'graph' ? map.nodes.map((node) => node.id) : [];
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const PLAN_PROMPT = `Plan this project visually in VibeMap before writing code.

1. Read .vibemap/AGENT_GUIDE.md.
2. Create a 00-overview map (level overview) with the main pieces, groups and the people/systems outside the app. Keep it ≤ 15 nodes; planned nodes need no refs.
3. Create one feature map per top-level flow with nodes marked status: planned. Add walkthroughs.
4. Run vibemap check and fix all errors.
5. When you build code, add refs to the planned nodes, flip them to built, and record a change entry.

Do not invent components. Keep every map small.`;

export function App(): React.ReactElement {
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [maps, setMaps] = useState<MapSummary[]>([]);
  const [check, setCheck] = useState<CheckReport | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MapDetail | null>(null);
  const [sidecar, setSidecar] = useState<MapLayoutSidecar | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [tab, setTab] = useState<ViewerTab>('maps');
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [beginner, setBeginner] = useState(() => localStorage.getItem('vibemap:beginner') === '1');
  const [live, setLive] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | null>(null);
  const [toastState, setToastState] = useState<{ message: string; tone: 'info' | 'ok' | 'error' | 'warn' } | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [mapFilter, setMapFilter] = useState('');
  const [changes, setChanges] = useState<ChangeEntry[]>([]);
  const [phases, setPhases] = useState<PhaseProgress[]>([]);
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [coverage, setCoverage] = useState<CoverageReport | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingTab, setLoadingTab] = useState(false);
  const [bottom, setBottom] = useState<'problems' | 'activity' | null>(null);
  const [fitNonce, setFitNonce] = useState(0);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [walkthrough, setWalkthrough] = useState<WalkthroughState>({ active: false, index: 0, playing: false });
  const [historical, setHistorical] = useState<{ map: VibeMap; rev: string; point: HistoryPoint } | null>(null);
  const [diffData, setDiffData] = useState<DiffState | null>(null);
  const [pendingDiff, setPendingDiff] = useState<{ map: string; base: string; label: string } | null>(null);
  const [phaseFilter, setPhaseFilter] = useState<string | null>(null);
  const [pendingDetail, setPendingDetail] = useState<PendingDetail | null>(null);
  const [pendingNode, setPendingNode] = useState<{ map: string; node: string } | null>(null);

  const detailRef = useRef<MapDetail | null>(null);
  const sidecarRef = useRef<MapLayoutSidecar | null>(null);
  const selectedMapRef = useRef<string | null>(null);
  const modeRef = useRef(mode);
  const tabRef = useRef(tab);
  const lastLocalLayout = useRef(0);
  const lastOwnOp = useRef(0);
  const layoutSaveTimer = useRef<number | undefined>(undefined);
  const previousLayouts = useRef<Record<string, LayoutResult>>({});
  const gKey = useRef(0);

  useEffect(() => {
    detailRef.current = detail;
  }, [detail]);
  useEffect(() => {
    sidecarRef.current = sidecar;
  }, [sidecar]);
  useEffect(() => {
    selectedMapRef.current = selectedMapId;
  }, [selectedMapId]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  const toast = useCallback((message: string, tone: 'info' | 'ok' | 'error' | 'warn' = 'info') => {
    setToastState({ message, tone });
  }, []);

  useEffect(() => {
    if (!toastState) return;
    const timer = window.setTimeout(() => setToastState(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toastState]);

  useEffect(() => {
    localStorage.setItem('vibemap:beginner', beginner ? '1' : '0');
  }, [beginner]);

  useEffect(() => {
    document.title = `${project?.name ?? 'VibeMap'} — VibeMap`;
  }, [project?.name]);

  const applyDetail = useCallback((next: MapDetail) => {
    detailRef.current = next;
    setDetail(next);
    const layout = next.layout ?? emptyLayout(next.id);
    sidecarRef.current = layout;
    setSidecar(layout);
    setSelectedNodeId((current) => (current && graphNodeIds(next.map).includes(current) ? current : null));
  }, []);

  const refreshMaps = useCallback(async () => {
    try {
      const response = await api.maps();
      setMaps(response.maps);
      if (response.check) setCheck(response.check);
      const current = selectedMapRef.current;
      if (current && !response.maps.some((map) => map.id === current) && response.maps[0]) {
        setSelectedMapId(response.maps[0].id);
      }
    } catch (error) {
      if ((error as { status?: number }).status === 401) setFatal('The VibeMap token is invalid. Restart `vibemap view` and reopen the URL from the terminal.');
    }
  }, []);

  const loadDetail = useCallback(
    async (id: string, options: { force?: boolean; quiet?: boolean } = {}): Promise<MapDetail | null> => {
      try {
        const next = await api.map(id);
        const editingSame = modeRef.current === 'edit' && detailRef.current?.id === id && !options.force;
        if (editingSame) {
          setPendingDetail({ detail: next, message: 'The map changed on disk while you were editing.' });
          return next;
        }
        applyDetail(next);
        return next;
      } catch (error) {
        if (!options.quiet) toast((error as Error).message, 'error');
        return null;
      }
    },
    [applyDetail, toast],
  );

  const loadChanges = useCallback(async () => {
    try {
      const response = await api.changes();
      setChanges(response.changes);
    } catch {
      // ignore transient errors
    }
  }, []);

  const loadTimeline = useCallback(async (id: string) => {
    try {
      const response = await api.history(id);
      setHistory(response.history);
    } catch {
      setHistory([]);
    }
  }, []);

  const loadPhases = useCallback(async () => {
    try {
      const response = await api.phases();
      setPhases(response.phases);
    } catch {
      // ignore
    }
  }, []);

  const loadNotes = useCallback(async () => {
    try {
      const response = await api.notes();
      setNotes(response.notes);
    } catch {
      // ignore
    }
  }, []);

  const loadCoverage = useCallback(async () => {
    try {
      const [coverageResponse, suggestionResponse] = await Promise.all([api.coverage(), api.suggest(20)]);
      setCoverage(coverageResponse);
      setSuggestions(suggestionResponse.suggestions);
    } catch (error) {
      toast((error as Error).message, 'error');
    }
  }, [toast]);

  // Initial load.
  useEffect(() => {
    if (!boot.token) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    Promise.all([api.project(), api.maps()])
      .then(([projectResponse, mapsResponse]) => {
        if (!active) return;
        setProject(projectResponse);
        setMaps(mapsResponse.maps);
        setCheck(mapsResponse.check);
        setBeginner(projectResponse.config.viewer.beginnerMode || localStorage.getItem('vibemap:beginner') === '1');
        setTab(projectResponse.config.viewer.defaultTab ?? 'maps');
        const remembered = localStorage.getItem('vibemap:lastMap');
        const initial =
          (remembered && mapsResponse.maps.some((map) => map.id === remembered) ? remembered : null) ??
          (mapsResponse.maps.some((map) => map.id === '00-overview') ? '00-overview' : mapsResponse.maps[0]?.id ?? null);
        setSelectedMapId(initial);
        setLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        setFatal((error as Error).message);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Load the selected map and its timeline.
  useEffect(() => {
    if (!selectedMapId) {
      setDetail(null);
      detailRef.current = null;
      return;
    }
    let active = true;
    localStorage.setItem('vibemap:lastMap', selectedMapId);
    setMode('view');
    setHistorical(null);
    setDiffData(null);
    setPhaseFilter(null);
    setWalkthrough({ active: false, index: 0, playing: false });
    setConnectMode(false);
    setConnectFrom(null);
    setSelectedNodeId(null);
    setPendingDetail(null);
    void loadDetail(selectedMapId, { force: true, quiet: true }).then((next) => {
      if (active && next) setFitNonce((value) => value + 1);
    });
    void loadTimeline(selectedMapId);
    return () => {
      active = false;
    };
  }, [selectedMapId, loadDetail, loadTimeline]);

  // Background load for inspector history and tab data.
  useEffect(() => {
    void loadChanges();
    void loadPhases();
  }, [loadChanges, loadPhases]);

  useEffect(() => {
    if (pendingNode && detail?.id === pendingNode.map) {
      if (detail.map.type === 'graph' && detail.map.nodes.some((node) => node.id === pendingNode.node)) {
        setSelectedNodeId(pendingNode.node);
        setFitNonce((value) => value + 1);
      }
      setPendingNode(null);
    }
  }, [detail, pendingNode]);

  // Tab data.
  useEffect(() => {
    if (tab === 'changes') void loadChanges();
    if (tab === 'phases') void loadPhases();
    if (tab === 'notes') void loadNotes();
    if (tab === 'coverage') void loadCoverage();
    if (tab === 'timeline' && selectedMapId) void loadTimeline(selectedMapId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Live events.
  useEffect(() => {
    if (!boot.token) return;
    const disconnect = connectEvents(
      (event) => {
        const data = event.data as Record<string, unknown>;
        if (event.type === 'hello') {
          setLive('live');
          return;
        }
        if (event.type === 'map.changed') {
          const id = data.id as string;
          if (id === selectedMapRef.current && Date.now() - lastOwnOp.current > 1600) {
            if (modeRef.current === 'edit' && detailRef.current) {
              void api
                .map(id)
                .then((next) => setPendingDetail({ detail: next, message: 'The map changed on disk while you were editing. Apply its latest version or keep your edits.' }))
                .catch(() => undefined);
            } else {
              void loadDetail(id, { force: true, quiet: true });
            }
            toast(`Map updated: ${String(data.summary ?? 'changed')}`, 'info');
          }
          void refreshMaps();
          return;
        }
        if (event.type === 'map.error') {
          if (data.id === selectedMapRef.current) void loadDetail(String(data.id), { force: true, quiet: true });
          const issues = Array.isArray(data.issues) ? data.issues : [];
          const first = issues[0] as { message?: string } | undefined;
          toast(`Map file is invalid. ${first?.message ?? 'Showing last good version.'}`, 'error');
          void refreshMaps();
          return;
        }
        if (event.type === 'check.updated') {
          const report = data.report as CheckReport | undefined;
          if (report) setCheck(report);
          void refreshMaps();
          return;
        }
        if (event.type === 'layout.updated') {
          if (data.map === selectedMapRef.current && Date.now() - lastLocalLayout.current > 1200 && modeRef.current !== 'edit') {
            void loadDetail(String(data.map), { force: true, quiet: true });
          }
          return;
        }
        if (event.type === 'changes.updated') {
          void loadChanges();
          return;
        }
        if (event.type === 'phases.updated') {
          void loadPhases();
          return;
        }
        if (event.type === 'notes.updated') {
          if (tabRef.current === 'notes') void loadNotes();
          return;
        }
        if (event.type === 'config.updated') {
          void api.project().then(setProject).catch(() => undefined);
          return;
        }
        if (event.type === 'maps.updated' || event.type === 'drift.updated') {
          void refreshMaps();
          return;
        }
        if (event.type === 'scan.updated') {
          toast('Scanner refreshed.', 'ok');
          return;
        }
        if (event.type === 'error') {
          toast(String(data.message ?? 'Unknown server error'), 'error');
        }
      },
      (status) => setLive(status),
    );
    return disconnect;
  }, [loadChanges, loadDetail, loadNotes, loadPhases, refreshMaps, toast]);

  const refreshAll = useCallback(async () => {
    await refreshMaps();
    if (selectedMapRef.current) {
      await loadDetail(selectedMapRef.current, { force: true, quiet: true });
      await loadTimeline(selectedMapRef.current);
    }
    await loadChanges();
    await loadPhases();
    try {
      setCheck(await api.check());
    } catch {
      // keep prior
    }
    toast('Refreshed from disk.', 'ok');
  }, [loadChanges, loadDetail, loadPhases, loadTimeline, refreshMaps, toast]);

  const theme = detail?.theme ?? project?.theme;
  const activeMap = historical?.map ?? detail?.map ?? null;
  const activeLayout = useMemo(() => {
    if (!activeMap || !theme) return null;
    try {
      return layoutMap(activeMap, theme, {
        sidecar: historical ? null : sidecar,
        previous: previousLayouts.current[`${detail?.id ?? ''}:${historical?.rev ?? ''}`] ?? null,
      });
    } catch {
      return null;
    }
  }, [activeMap, theme, sidecar, historical, detail?.id]);

  useEffect(() => {
    if (activeLayout && detail?.id) {
      previousLayouts.current[`${detail.id}:${historical?.rev ?? ''}`] = activeLayout;
    }
  }, [activeLayout, detail?.id, historical?.rev]);

  const viewDetail = useMemo<MapDetail | null>(() => {
    if (!detail) return null;
    if (!historical) return detail;
    return { ...detail, map: historical.map, evidence: {}, locked: [], error: null, stale: false, rev: historical.rev };
  }, [detail, historical]);

  const canvasFocus = useMemo(() => {
    if (walkthrough.active && viewDetail?.map.type === 'graph') {
      return viewDetail.map.walkthrough?.[walkthrough.index]?.focus ?? null;
    }
    if (phaseFilter && viewDetail?.map.type === 'graph') {
      return viewDetail.map.nodes.filter((node) => (node.phase ?? viewDetail.map.phase) === phaseFilter).map((node) => node.id);
    }
    return null;
  }, [walkthrough.active, walkthrough.index, phaseFilter, viewDetail]);

  const diffCanvas = useMemo(() => {
    if (!diffData) return null;
    return { states: diffData.states, ghosts: diffData.ghosts };
  }, [diffData]);

  const persistLayout = useCallback(
    (next: MapLayoutSidecar, immediate = false) => {
      sidecarRef.current = next;
      setSidecar(next);
      lastLocalLayout.current = Date.now();
      if (layoutSaveTimer.current) window.clearTimeout(layoutSaveTimer.current);
      const run = (): void => {
        if (!detailRef.current) return;
        api
          .saveLayout(detailRef.current.id, next)
          .catch((error) => toast(`Could not save layout: ${(error as Error).message}`, 'error'));
      };
      if (immediate) run();
      else layoutSaveTimer.current = window.setTimeout(run, 320);
    },
    [toast],
  );

  useEffect(
    () => () => {
      if (layoutSaveTimer.current) window.clearTimeout(layoutSaveTimer.current);
    },
    [],
  );

  const moveNode = useCallback(
    (id: string, x: number, y: number, w: number, h: number) => {
      const current = sidecarRef.current;
      if (!current) return;
      const next: MapLayoutSidecar = { ...current, nodes: { ...current.nodes, [id]: { x, y, w, h, pinned: true } } };
      persistLayout(next);
    },
    [persistLayout],
  );

  const moveAnnotation = useCallback(
    (id: string, x: number, y: number) => {
      const current = sidecarRef.current;
      if (!current) return;
      const next: MapLayoutSidecar = {
        ...current,
        annotations: (current.annotations ?? []).map((annotation) => (annotation.id === id ? { ...annotation, x, y } : annotation)),
      };
      persistLayout(next);
    },
    [persistLayout],
  );

  const addSticky = useCallback(
    async (text: string) => {
      const current = sidecarRef.current;
      if (!current) return;
      const annotation: VibeAnnotation = {
        id: `sticky-${Date.now().toString(36)}`,
        type: 'sticky',
        x: 60 + ((current.annotations?.length ?? 0) % 4) * 24,
        y: 60 + ((current.annotations?.length ?? 0) % 4) * 20,
        w: 180,
        h: 100,
        text,
      };
      const next: MapLayoutSidecar = { ...current, annotations: [...(current.annotations ?? []), annotation] };
      persistLayout(next, true);
      toast('Sticky note added. Drag it in edit mode.', 'ok');
    },
    [persistLayout, toast],
  );

  const resetLayout = useCallback(() => {
    const current = sidecarRef.current;
    if (!current) return;
    if (!window.confirm('Reset all pinned positions? Annotations are kept. Agents never write layouts; this only affects your view.')) return;
    const next = { ...current, nodes: {} };
    persistLayout(next, true);
    setFitNonce((value) => value + 1);
    toast('Layout reset to automatic.', 'ok');
  }, [persistLayout, toast]);

  const runOps = useCallback(
    async (ops: PatchOp[]): Promise<MapDetail & { changedNodeIds: string[] }> => {
      const current = detailRef.current;
      if (!current) throw new Error('No map is open.');
      // Set this before the request: the server broadcasts over WS before it sends the HTTP response.
      lastOwnOp.current = Date.now();
      try {
        const result = await api.ops(current.id, { baseRev: current.rev, ops });
        lastOwnOp.current = Date.now();
        detailRef.current = result;
        setDetail(result);
        const nextSidecar = result.layout ?? emptyLayout(result.id);
        sidecarRef.current = nextSidecar;
        setSidecar(nextSidecar);
        void refreshMaps();
        return result;
      } catch (error) {
        if ((error as { status?: number }).status === 409) {
          toast('The map changed while you were editing. Reloading the latest version.', 'warn');
          await loadDetail(current.id, { force: true, quiet: true });
        }
        throw error;
      }
    },
    [loadDetail, refreshMaps, toast],
  );

  const updateNode = useCallback(
    async (id: string, set: Partial<VibeNode>) => {
      await runOps([{ op: 'update_node', id, set }]);
      setSelectedNodeId(id);
      toast('Node saved and locked.', 'ok');
    },
    [runOps, toast],
  );

  const deleteNode = useCallback(
    async (id: string) => {
      if (!window.confirm('Delete this node and all of its edges? This is recorded in the change journal.')) return;
      await runOps([{ op: 'remove_node', id }]);
      setSelectedNodeId(null);
      toast('Node deleted.', 'ok');
    },
    [runOps, toast],
  );

  const toggleLock = useCallback(
    async (id: string, locked: boolean) => {
      if (!detailRef.current) return;
      try {
        await api.locks(detailRef.current.id, id, locked);
        const current = detailRef.current;
        const nextLocked = locked ? [...new Set([...current.locked, id])] : current.locked.filter((item) => item !== id);
        const next = { ...current, locked: nextLocked };
        detailRef.current = next;
        setDetail(next);
        toast(locked ? 'Node locked against agent edits.' : 'Node unlocked.', 'ok');
      } catch (error) {
        toast((error as Error).message, 'error');
      }
    },
    [toast],
  );

  const createNode = useCallback(
    async (node: { label: string; kind: string; status: string; description?: string }) => {
      const result = await runOps([
        {
          op: 'add_node',
          node: {
            label: node.label,
            kind: node.kind as VibeNode['kind'],
            status: node.status as VibeNode['status'],
            ...(node.description ? { description: node.description } : {}),
          },
        },
      ]);
      const newId = result.changedNodeIds[0];
      if (connectFrom && newId) {
        await runOps([{ op: 'add_edge', edge: { from: connectFrom, to: newId, kind: 'flow' } }]);
        setConnectFrom(null);
        setConnectMode(false);
      }
      setSelectedNodeId(newId ?? null);
      toast('Node added. Add code refs to make it verifiable.', 'ok');
    },
    [connectFrom, runOps, toast],
  );

  const createEdge = useCallback(
    async (edge: { from: string; to: string; label?: string; kind: string }) => {
      await runOps([{ op: 'add_edge', edge: { from: edge.from, to: edge.to, kind: edge.kind as VibeEdgeKind, ...(edge.label ? { label: edge.label } : {}) } }]);
      setConnectFrom(null);
      setConnectMode(false);
      toast('Edge added.', 'ok');
    },
    [runOps, toast],
  );

  const addAnnotation = useCallback(
    async (text: string) => {
      await addSticky(text);
    },
    [addSticky],
  );

  const onConnectNode = useCallback(
    (id: string) => {
      if (!connectFrom) {
        setConnectFrom(id);
        return;
      }
      if (connectFrom === id) {
        setConnectFrom(null);
        return;
      }
      setModal({ kind: 'edge', from: connectFrom, to: id });
    },
    [connectFrom],
  );

  const startWalkthrough = useCallback(() => {
    if (!detail?.map || detail.map.type !== 'graph' || !detail.map.walkthrough?.length) return;
    setWalkthrough({ active: true, index: 0, playing: true });
    setTab('maps');
  }, [detail]);

  useEffect(() => {
    if (!walkthrough.active || !walkthrough.playing) return;
    const steps = viewDetail?.map.type === 'graph' ? viewDetail.map.walkthrough?.length ?? 0 : 0;
    if (!steps) return;
    const timer = window.setInterval(() => {
      setWalkthrough((current) => {
        if (current.index + 1 >= steps) return { ...current, playing: false };
        return { ...current, index: current.index + 1 };
      });
    }, 3800);
    return () => window.clearInterval(timer);
  }, [walkthrough.active, walkthrough.playing, viewDetail?.map]);

  const openHistorical = useCallback((point: HistoryPoint) => {
    const id = detailRef.current?.id;
    if (!id) return;
    api
      .mapAt(id, point.rev)
      .then((result) => {
        setHistorical({ map: result.map, rev: result.rev, point });
        setDiffData(null);
        setTab('maps');
        setFitNonce((value) => value + 1);
        toast(`Viewing ${point.kind === 'git' ? 'commit' : 'journal point'} from ${new Date(point.ts).toLocaleString()}.`, 'info');
      })
      .catch((error) => toast((error as Error).message, 'error'));
  }, [toast]);

  const openDiff = useCallback(
    async (base: string, label: string) => {
      const current = detailRef.current;
      if (!current) return;
      try {
        const diff = await api.diff(current.id, base, 'working');
        const hasChanges = diff.added.length || diff.removed.length || diff.modified.length || diff.addedEdges.length || diff.removedEdges.length || diff.modifiedEdges.length;
        if (!hasChanges) {
          toast('No semantic changes between these points.', 'info');
          return;
        }
        let ghosts: LayoutBox[] = [];
        if (diff.baseMap?.type === 'graph') {
          const baseLayout = layoutMap(diff.baseMap, current.theme);
          const headIds = new Set(graphNodeIds(current.map));
          ghosts = baseLayout.type === 'graph' ? baseLayout.nodes.filter((node) => !headIds.has(node.id)) : [];
        }
        const states: DiffState['states'] = {};
        for (const node of diff.added) states[node.id] = 'added';
        for (const node of diff.modified) states[node.id] = 'modified';
        setHistorical(null);
        setDiffData({ diff, ghosts, states, baseLabel: label });
        setTab('maps');
        setFitNonce((value) => value + 1);
        toast(`Comparing ${label} with now: ${diff.added.length} added, ${diff.modified.length} modified, ${diff.removed.length} removed.`, 'info');
      } catch (error) {
        toast((error as Error).message, 'error');
      }
    },
    [toast],
  );

  const diffForChange = useCallback(
    async (change: ChangeEntry) => {
      const mapId = change.maps[0];
      if (!mapId) {
        toast('This change entry has no map to diff.', 'warn');
        return;
      }
      let points = mapId === selectedMapRef.current ? history : [];
      if (!points.length) {
        try {
          points = (await api.history(mapId)).history;
        } catch {
          points = [];
        }
      }
      const point = points.find((item) => item.ts < change.date);
      if (!point) {
        toast('No earlier timeline point to compare this change against. Make one map save or commit before the change.', 'warn');
        return;
      }
      if (detailRef.current?.id !== mapId) {
        setPendingDiff({ map: mapId, base: point.rev, label: point.summary });
        setSelectedMapId(mapId);
        setTab('maps');
        return;
      }
      void openDiff(point.rev, point.summary);
    },
    [history, openDiff, toast],
  );

  useEffect(() => {
    if (!pendingDiff || detail?.id !== pendingDiff.map) return;
    const pending = pendingDiff;
    setPendingDiff(null);
    void openDiff(pending.base, pending.label);
  }, [detail?.id, pendingDiff, openDiff]);

  const openNode = useCallback(
    (mapId: string, nodeId: string) => {
      if (detailRef.current?.id === mapId) {
        setSelectedNodeId(nodeId);
        setTab('maps');
        setModal(null);
        return;
      }
      setPendingNode({ map: mapId, node: nodeId });
      setSelectedMapId(mapId);
      setTab('maps');
      setModal(null);
    },
    [],
  );

  const openMap = useCallback(
    (id: string) => {
      setSelectedMapId(id);
      setTab('maps');
      setModal(null);
    },
    [],
  );

  const openIssue = useCallback(
    (issue: Issue) => {
      const mapId = mapIdFromIssueFile(issue.file);
      if (mapId) {
        setSelectedMapId(mapId);
        setTab('maps');
      }
      setBottom('problems');
    },
    [],
  );

  const exportMap = useCallback(
    async (format: string) => {
      if (!detailRef.current) return;
      try {
        const blob = await api.exportMap(detailRef.current.id, format);
        const extension = format === 'mermaid' ? 'mmd' : format === 'md' ? 'md' : format === 'excalidraw' ? 'excalidraw' : format;
        downloadBlob(blob, `${detailRef.current.id.replace(/\//g, '-')}.${extension}`);
        toast(`Exported ${format.toUpperCase()}.`, 'ok');
      } catch (error) {
        toast((error as Error).message, 'error');
      }
    },
    [toast],
  );

  const saveSettings = useCallback(
    async (body: { mode?: string; granularity?: string }) => {
      await api.config(body);
      const nextProject = await api.project();
      setProject(nextProject);
      toast('Tracking settings saved and agent guide synced.', 'ok');
    },
    [toast],
  );

  const createNewMap = useCallback(
    async (body: { id: string; title: string; type: string; level: string }) => {
      const result = await api.createMap(body);
      await refreshMaps();
      setSelectedMapId(body.id);
      applyDetail(result.detail);
      toast(`Map ${body.id} created.`, 'ok');
    },
    [applyDetail, refreshMaps, toast],
  );

  const bootstrap = useCallback(async () => {
    toast('Generating a bootstrap prompt from the scanner…', 'info');
    try {
      const result = await api.bootstrap();
      setModal({ kind: 'prompt', title: 'Bootstrap prompt', prompt: result.prompt });
    } catch (error) {
      toast((error as Error).message, 'error');
    }
  }, [toast]);

  const copyPrompt = useCallback(
    async (text: string, message = 'Prompt copied. Paste it into your agent.') => {
      if (await copyText(text)) toast(message, 'ok');
      else toast('Could not copy to clipboard.', 'error');
    },
    [toast],
  );

  const onSearchPick = useCallback(
    (result: SearchResult) => {
      setModal(null);
      if (result.type === 'map' && result.map) openMap(result.map);
      else if (result.type === 'node' && result.map && result.node) openNode(result.map, result.node);
      else if (result.type === 'change') setTab('changes');
      else if (result.type === 'note') setTab('notes');
    },
    [openMap, openNode],
  );

  const applyPendingDetail = useCallback(() => {
    if (!pendingDetail) return;
    applyDetail(pendingDetail.detail);
    setPendingDetail(null);
    toast('Latest map applied.', 'ok');
  }, [applyDetail, pendingDetail, toast]);

  const changeTab = useCallback((nextTab: ViewerTab) => {
    setTab(nextTab);
    setModal(null);
  }, []);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (modal) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setModal({ kind: 'search' });
        return;
      }
      if (event.key === 'g') {
        gKey.current = Date.now();
        return;
      }
      if (Date.now() - gKey.current < 900) {
        const map: Record<string, ViewerTab> = { m: 'maps', c: 'changes', t: 'timeline', p: 'phases', n: 'notes', v: 'coverage' };
        const next = map[event.key.toLowerCase()];
        if (next) {
          event.preventDefault();
          gKey.current = 0;
          setTab(next);
          return;
        }
      }
      if (event.key === 'Escape') {
        if (connectMode) {
          setConnectMode(false);
          setConnectFrom(null);
        } else {
          setSelectedNodeId(null);
        }
        return;
      }
      if (event.key.toLowerCase() === 'e') {
        setMode((current) => (current === 'edit' ? 'view' : 'edit'));
        return;
      }
      if (event.key.toLowerCase() === 'b') {
        setBeginner((current) => !current);
        return;
      }
      if (event.key === '?') {
        setModal({ kind: 'shortcuts' });
        return;
      }
      if (event.key.toLowerCase() === 'f') {
        setFitNonce((value) => value + 1);
        return;
      }
      if (event.key === ' ' && walkthrough.active) {
        event.preventDefault();
        setWalkthrough((current) => ({ ...current, playing: !current.playing }));
        return;
      }
      if (walkthrough.active && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
        event.preventDefault();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        const total = viewDetail?.map.type === 'graph' ? viewDetail.map.walkthrough?.length ?? 0 : 0;
        setWalkthrough((current) => ({ ...current, playing: false, index: Math.max(0, Math.min(total - 1, current.index + direction)) }));
        return;
      }
      if ((event.key === '[' || event.key === ']') && diffData) {
        event.preventDefault();
        const ids = [...diffData.diff.added.map((n) => n.id), ...diffData.diff.modified.map((n) => n.id), ...diffData.diff.removed.map((n) => n.id)];
        if (!ids.length) return;
        const index = selectedNodeId ? ids.indexOf(selectedNodeId) : -1;
        const delta = event.key === ']' ? 1 : -1;
        const next = ids[(index + delta + ids.length) % ids.length];
        setSelectedNodeId(next ?? null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [connectMode, diffData, modal, selectedNodeId, viewDetail?.map, walkthrough.active]);

  // First-run tour.
  useEffect(() => {
    if (!loading && maps.length && !localStorage.getItem('vibemap:tour-done')) setModal({ kind: 'tour' });
  }, [loading, maps.length]);

  if (!boot.token) {
    return (
      <div className="setup-screen">
        <div className="setup-card">
          <div className="logo large">VM</div>
          <h1>VibeMap needs the local server</h1>
          <p>Open the URL printed by <code>vibemap view</code>. The viewer uses a per-session token and must be served by the local VibeMap server.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const value = new FormData(event.currentTarget).get('token');
              if (typeof value === 'string' && value.trim()) {
                localStorage.setItem('vibemap-token', value.trim());
                window.location.reload();
              }
            }}
          >
            <label className="field">
              <span>Server token (from .vibemap/.cache/server.json)</span>
              <input name="token" placeholder="Paste token" />
            </label>
            <button type="submit" className="btn primary">
              Connect
            </button>
          </form>
          <p className="muted">Or run <code>vibemap view</code> in your project and use that URL.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="logo large">VM</div>
        <Spinner label="Opening your project…" />
      </div>
    );
  }

  if (fatal) {
    return (
      <div className="setup-screen">
        <div className="setup-card">
          <div className="logo large">VM</div>
          <h1>Could not open the project</h1>
          <p className="inline-error">{fatal}</p>
          <p>Restart <code>vibemap view</code> in your project, then reload the URL it prints.</p>
          <button type="button" className="btn primary" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const summary = maps.find((map) => map.id === selectedMapId);
  const noMaps = maps.length === 0;
  const mapTheme = project?.theme;
  const canEdit = tab === 'maps' && !!viewDetail && !historical && mode === 'edit' && viewDetail.map.type === 'graph';
  const currentWalkthrough = viewDetail?.map.type === 'graph' ? viewDetail.map.walkthrough?.[walkthrough.index] : undefined;

  return (
    <div className="app">
      <TopBar
        project={project}
        detail={viewDetail}
        summary={summary}
        check={check}
        tab={tab}
        onTab={changeTab}
        mode={mode}
        onMode={(nextMode) => {
          setMode(nextMode);
          if (nextMode === 'view') {
            setConnectMode(false);
            setConnectFrom(null);
          }
          if (nextMode === 'edit' && tab !== 'maps') setTab('maps');
        }}
        beginner={beginner}
        onBeginner={setBeginner}
        live={live}
        problemsOpen={bottom === 'problems'}
        onProblems={() => setBottom((current) => (current === 'problems' ? null : 'problems'))}
        onSearch={() => setModal({ kind: 'search' })}
        onSettings={() => project && setModal({ kind: 'settings' })}
        onHelp={() => setModal({ kind: 'shortcuts' })}
        onExport={(format) => void exportMap(format)}
        onRefresh={() => void refreshAll()}
      />
      <div className={classNames('app-body', tab !== 'maps' && 'no-inspector')}>
        <Sidebar
          maps={maps}
          selectedId={selectedMapId}
          onSelect={openMap}
          filter={mapFilter}
          onFilter={setMapFilter}
          coverage={check?.stats.coverage}
          onNewMap={() => setModal({ kind: 'new-map' })}
          onBootstrap={() => void bootstrap()}
          version={project?.versions.vibemap}
        />
        <main className="workspace">
          {noMaps ? (
            <div className="empty-workspace">
              <EmptyState
                icon="◎"
                title="Turn this project into a map"
                actions={
                  <>
                    <button type="button" className="btn primary" onClick={() => void bootstrap()}>
                      Copy bootstrap prompt
                    </button>
                    <button type="button" className="btn" onClick={() => setModal({ kind: 'prompt', title: 'Plan-first prompt', prompt: PLAN_PROMPT })}>
                      Plan-first prompt
                    </button>
                    <button type="button" className="btn subtle" onClick={() => setModal({ kind: 'new-map' })}>
                      Draw by hand
                    </button>
                  </>
                }
              >
                <p>VibeMap keeps diagrams and plain-language notes next to your code. The agent describes what exists; the tool draws it and checks every claim against real files.</p>
                <p className="muted">
                  Start with <code>vibemap bootstrap</code>, paste the prompt into Claude Code, Cursor, Codex or any agent, then watch maps appear here live.
                </p>
              </EmptyState>
            </div>
          ) : tab === 'maps' ? (
            <div className="canvas-column">
              {pendingDetail ? (
                <div className="banner banner-warn">
                  <span>{pendingDetail.message}</span>
                  <button type="button" className="btn tiny" onClick={applyPendingDetail}>
                    Apply update
                  </button>
                  <button type="button" className="icon-btn" onClick={() => setPendingDetail(null)} aria-label="Dismiss">
                    ×
                  </button>
                </div>
              ) : null}
              {detail?.error ? (
                <div className="banner banner-error">
                  <strong>Map has an error{detail.error.issues[0]?.line ? ` at line ${detail.error.issues[0].line}` : ''}.</strong>
                  <span> Showing the last good version.</span>
                  <button type="button" className="btn tiny" onClick={() => setBottom('problems')}>
                    View problem
                  </button>
                </div>
              ) : null}
              {historical ? (
                <div className="banner banner-info">
                  <span>
                    Viewing history: <strong>{historical.point.summary}</strong> · {new Date(historical.point.ts).toLocaleString()}
                  </span>
                  <button type="button" className="btn tiny" onClick={() => void openDiff(historical.rev, historical.point.summary)}>
                    Compare with now
                  </button>
                  <button type="button" className="btn tiny subtle" onClick={() => setHistorical(null)}>
                    Back to now
                  </button>
                </div>
              ) : null}
              {diffData ? (
                <div className="banner banner-diff">
                  <span>
                    Comparing <strong>{diffData.baseLabel}</strong> → now. <span className="muted">[ / ] steps through changed nodes.</span>
                  </span>
                  <button type="button" className="btn tiny subtle" onClick={() => setDiffData(null)}>
                    Exit diff
                  </button>
                </div>
              ) : null}
              {phaseFilter ? (
                <div className="banner banner-info">
                  <span>Showing phase <strong>{phaseFilter}</strong></span>
                  <button type="button" className="btn tiny subtle" onClick={() => setPhaseFilter(null)}>
                    Clear filter
                  </button>
                </div>
              ) : null}
              <div className="canvas-host">
                {viewDetail && activeLayout ? (
                  <MapCanvas
                    detail={viewDetail}
                    layout={activeLayout}
                    mode={historical ? 'view' : mode}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={(id) => setSelectedNodeId(id)}
                    onMoveNode={moveNode}
                    onMoveAnnotation={moveAnnotation}
                    connectMode={connectMode && !historical}
                    connectStart={connectFrom}
                    onConnectNode={onConnectNode}
                    walkthroughFocus={canvasFocus}
                    beginner={beginner}
                    fitNonce={fitNonce}
                    diff={diffCanvas}
                    readOnly={!!historical}
                    onZoom={() => undefined}
                  />
                ) : (
                  <div className="canvas-loading">
                    <Spinner label="Laying out the map…" />
                  </div>
                )}
                {canEdit ? (
                  <div className="edit-toolbar" role="toolbar" aria-label="Edit tools">
                    <button type="button" className="btn small" onClick={() => setModal({ kind: 'add-node' })}>
                      + Node
                    </button>
                    <button
                      type="button"
                      className={classNames('btn small', connectMode && 'active')}
                      onClick={() => {
                        setConnectMode((value) => !value);
                        setConnectFrom(null);
                      }}
                    >
                      Connect
                    </button>
                    <button type="button" className="btn small" onClick={() => setModal({ kind: 'sticky' })}>
                      Sticky
                    </button>
                    <button type="button" className="btn small subtle" onClick={resetLayout}>
                      Reset layout
                    </button>
                    <button type="button" className="btn small subtle" onClick={() => setMode('view')}>
                      Done
                    </button>
                  </div>
                ) : null}
                {walkthrough.active && currentWalkthrough ? (
                  <div className="walkthrough" role="region" aria-label="Walkthrough">
                    <div className="walkthrough-count">
                      {walkthrough.index + 1} / {viewDetail?.map.type === 'graph' ? viewDetail.map.walkthrough?.length : 0}
                    </div>
                    <p>{currentWalkthrough.text}</p>
                    <div className="walkthrough-actions">
                      <button type="button" className="icon-btn" onClick={() => setWalkthrough((current) => ({ ...current, playing: false, index: Math.max(0, current.index - 1) }))} aria-label="Previous step">
                        ‹
                      </button>
                      <button type="button" className="btn small" onClick={() => setWalkthrough((current) => ({ ...current, playing: !current.playing }))}>
                        {walkthrough.playing ? 'Pause' : 'Play'}
                      </button>
                      <button type="button" className="icon-btn" onClick={() => setWalkthrough((current) => ({ ...current, playing: false, index: Math.min((viewDetail?.map.type === 'graph' ? viewDetail.map.walkthrough?.length ?? 1 : 1) - 1, current.index + 1) }))} aria-label="Next step">
                        ›
                      </button>
                      <button type="button" className="btn small subtle" onClick={() => setWalkthrough({ active: false, index: 0, playing: false })}>
                        Close
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              {bottom ? (
                <div className="bottom-panel">
                  <div className="bottom-head">
                    <div className="bottom-tabs">
                      <button type="button" className={bottom === 'problems' ? 'active' : ''} onClick={() => setBottom('problems')}>
                        Problems {check ? `(${check.errors.length + check.warnings.length})` : ''}
                      </button>
                      <button type="button" className={bottom === 'activity' ? 'active' : ''} onClick={() => setBottom('activity')}>
                        Activity
                      </button>
                    </div>
                    <button type="button" className="icon-btn" onClick={() => setBottom(null)} aria-label="Close panel">
                      ×
                    </button>
                  </div>
                  <div className="bottom-body">
                    {bottom === 'problems' ? (
                      <ProblemsPanel
                        report={check}
                        onOpenIssue={openIssue}
                        onRunCheck={() => {
                          void api.runCheck().then((report) => {
                            setCheck(report);
                            toast(`Check complete: ${report.errors.length} errors, ${report.warnings.length} warnings.`, report.errors.length ? 'error' : 'ok');
                          });
                        }}
                      />
                    ) : (
                      <ActivityPanel changes={changes} onOpenMap={openMap} />
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="panel-page">
              {tab === 'changes' ? <ChangesPanel changes={changes} loading={loadingTab} onOpenMap={openMap} onDiff={diffForChange} /> : null}
              {tab === 'timeline' ? (
                <TimelinePanel
                  history={history}
                  loading={loadingTab}
                  selectedRev={historical?.rev ?? null}
                  currentMap={selectedMapId}
                  onSelect={openHistorical}
                  onDiff={(point) => void openDiff(point.rev, point.summary)}
                  onBack={() => setHistorical(null)}
                />
              ) : null}
              {tab === 'phases' ? (
                <PhasesPanel
                  phases={phases}
                  loading={loadingTab}
                  onStart={(id) => {
                    void api.phaseAction(id, 'start').then(() => {
                      void loadPhases();
                      toast('Phase started.', 'ok');
                    });
                  }}
                  onDone={(id) => {
                    void api.phaseAction(id, 'done').then(() => {
                      void loadPhases();
                      toast('Phase finished and snapshotted.', 'ok');
                    });
                  }}
                  onFilter={(id) => {
                    setPhaseFilter(id);
                    setTab('maps');
                  }}
                  onSnapshot={(phase: Phase) => {
                    if (phase.snapshot) void openDiff(phase.snapshot, `phase ${phase.id}`);
                  }}
                  onCreate={async (title) => {
                    await api.addPhase(title);
                    await loadPhases();
                    toast('Phase added.', 'ok');
                  }}
                />
              ) : null}
              {tab === 'notes' ? <NotesPanel notes={notes} loading={loadingTab} onOpenNode={openNode} onRefresh={() => void loadNotes()} /> : null}
              {tab === 'coverage' ? <CoveragePanel coverage={coverage} suggestions={suggestions} loading={loadingTab} onOpenNode={openNode} onCopy={copyPrompt} /> : null}
            </div>
          )}
        </main>
        {tab === 'maps' && viewDetail ? (
          <Inspector
            detail={viewDetail}
            selectedNodeId={selectedNodeId}
            mode={historical ? 'view' : mode}
            beginner={beginner}
            changes={changes}
            onSelectNode={(id) => setSelectedNodeId(id || null)}
            onUpdateNode={updateNode}
            onDeleteNode={deleteNode}
            onLock={toggleLock}
            onStartWalkthrough={startWalkthrough}
            onOpenNotes={() => setTab('notes')}
            onToast={toast}
          />
        ) : null}
      </div>
      {toastState ? <Toast message={toastState.message} tone={toastState.tone} onClose={() => setToastState(null)} /> : null}
      {modal?.kind === 'new-map' ? <NewMapModal onClose={() => setModal(null)} onCreate={createNewMap} /> : null}
      {modal?.kind === 'add-node' ? <AddNodeModal onClose={() => setModal(null)} onCreate={createNode} startConnect={connectFrom} /> : null}
      {modal?.kind === 'edge' ? <EdgeModal from={modal.from} to={modal.to} onClose={() => setModal(null)} onCreate={createEdge} /> : null}
      {modal?.kind === 'sticky' ? <StickyModal onClose={() => setModal(null)} onCreate={addAnnotation} /> : null}
      {modal?.kind === 'settings' && project ? <SettingsModal project={project} onClose={() => setModal(null)} onSave={saveSettings} /> : null}
      {modal?.kind === 'shortcuts' ? <ShortcutsModal onClose={() => setModal(null)} /> : null}
      {modal?.kind === 'tour' ? (
        <TourModal
          onClose={() => {
            localStorage.setItem('vibemap:tour-done', '1');
            setModal(null);
          }}
        />
      ) : null}
      {modal?.kind === 'search' ? <SearchModal initial={modal.initial ?? ''} onClose={() => setModal(null)} onPick={onSearchPick} /> : null}
      {modal?.kind === 'prompt' ? (
        <PromptModal
          title={modal.title}
          prompt={modal.prompt}
          onClose={() => setModal(null)}
          onCopied={() => {
            toast('Prompt copied. Paste it into your coding agent.', 'ok');
            setModal(null);
          }}
        />
      ) : null}
    </div>
  );
}

type VibeEdgeKind = 'calls' | 'reads' | 'writes' | 'imports' | 'data' | 'event' | 'depends' | 'returns' | 'flow' | 'contains';
