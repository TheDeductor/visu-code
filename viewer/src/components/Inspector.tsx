import React, { useEffect, useMemo, useState } from 'react';
import type { ChangeEntry, CodeRef, NodeKind, NodeStatus, VibeNode } from '@core/types';
import { NODE_KINDS, NODE_STATUSES } from '@core/types';
import { kindLabel } from '@core/theme';
import { api, type MapDetail } from '../api';
import { Badge } from './ui';
import { classNames, copyText, shortPath } from '../util';

export function Inspector({
  detail,
  selectedNodeId,
  mode,
  beginner,
  changes,
  onSelectNode,
  onUpdateNode,
  onDeleteNode,
  onLock,
  onStartWalkthrough,
  onOpenNotes,
  onToast,
}: {
  detail: MapDetail | null;
  selectedNodeId: string | null;
  mode: 'view' | 'edit';
  beginner: boolean;
  changes: ChangeEntry[];
  onSelectNode: (id: string) => void;
  onUpdateNode: (id: string, set: Partial<VibeNode>) => Promise<void>;
  onDeleteNode: (id: string) => Promise<void>;
  onLock: (id: string, locked: boolean) => Promise<void>;
  onStartWalkthrough: () => void;
  onOpenNotes: () => void;
  onToast: (message: string, tone?: 'info' | 'ok' | 'error' | 'warn') => void;
}): React.ReactElement {
  const graph = detail?.map.type === 'graph' ? detail.map : null;
  const node = graph?.nodes.find((n) => n.id === selectedNodeId) ?? null;
  const evidence = node ? detail?.evidence[node.id] : undefined;
  const [draft, setDraft] = useState<Partial<VibeNode>>({});
  const [refs, setRefs] = useState<Array<{ path: string; symbol: string }>>([]);
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState<{ path: string; content: string } | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    if (!node) {
      setDraft({});
      setRefs([]);
      setTags('');
      setCode(null);
      setCodeError(null);
      return;
    }
    setDraft({
      label: node.label,
      kind: node.kind,
      status: node.status ?? 'built',
      description: node.description ?? '',
      plain: node.plain ?? '',
    });
    setRefs((node.refs ?? []).map((ref) => ({ path: ref.path, symbol: ref.symbol ?? '' })));
    setTags((node.tags ?? []).join(', '));
    setCode(null);
    setCodeError(null);
  }, [node?.id, node?.label, node?.kind, node?.status, node?.description, node?.plain, node?.refs, node?.tags]);

  const connections = useMemo(() => {
    if (!graph || !node) return { incoming: [], outgoing: [] };
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    return {
      incoming: graph.edges.filter((edge) => edge.to === node.id).map((edge) => ({ edge, node: byId.get(edge.from) })),
      outgoing: graph.edges.filter((edge) => edge.from === node.id).map((edge) => ({ edge, node: byId.get(edge.to) })),
    };
  }, [graph, node]);

  const nodeChanges = useMemo(() => {
    if (!detail || !node) return [];
    return changes.filter((change) => change.delta.added_nodes.includes(`${detail.id}#${node.id}`) || change.delta.modified_nodes.includes(`${detail.id}#${node.id}`)).slice(0, 5);
  }, [changes, detail, node]);

  if (!detail) {
    return (
      <aside className="inspector" aria-label="Inspector">
        <div className="inspector-placeholder">
          <p>Select a map to inspect it.</p>
        </div>
      </aside>
    );
  }

  if (!node) {
    const map = detail.map;
    const evidenceCounts = Object.values(detail.evidence).reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    const nodes = map.type === 'graph' ? map.nodes : map.type === 'sequence' ? map.participants.map((p) => ({ id: p.id, label: p.label, kind: p.kind ?? 'actor', status: undefined, refs: p.refs })) : map.type === 'erd' ? map.entities.map((e) => ({ id: e.id, label: e.label, kind: 'database', status: undefined, refs: e.refs })) : [];
    return (
      <aside className="inspector" aria-label="Inspector">
        <div className="inspector-scroll">
          <div className="inspector-head">
            <div>
              <span className="eyebrow">{map.type.toUpperCase()}</span>
              <h2>{map.title}</h2>
            </div>
          </div>
          <p className="map-summary">{map.summary || 'No summary yet. Ask an agent to add one.'}</p>
          <div className="stat-grid">
            <div>
              <strong>{nodes.length}</strong>
              <span>{map.type === 'erd' ? 'entities' : 'nodes'}</span>
            </div>
            <div>
              <strong>{map.type === 'graph' ? map.edges.length : map.type === 'sequence' ? map.steps.length : map.type === 'erd' ? map.relations.length : 0}</strong>
              <span>edges</span>
            </div>
            <div>
              <strong>{detail.issues.errors.length}</strong>
              <span>errors</span>
            </div>
            <div>
              <strong>{detail.locked.length}</strong>
              <span>locked</span>
            </div>
          </div>
          {map.type === 'graph' ? (
            <>
              <div className="inspector-section">
                <div className="section-title">Evidence</div>
                {(['verified', 'declared', 'stale', 'planned'] as const).map((status) => (
                  <div key={status} className="evidence-row">
                    <Badge tone={status === 'verified' ? 'ok' : status === 'stale' ? 'error' : status === 'declared' ? 'warn' : 'info'}>{status}</Badge>
                    <span>{evidenceCounts[status] ?? 0}</span>
                  </div>
                ))}
                {detail.error ? <p className="inline-error">{detail.error.message}</p> : null}
              </div>
              {map.walkthrough?.length ? (
                <div className="inspector-section">
                  <button type="button" className="btn full" onClick={onStartWalkthrough}>
                    ▶ Start walkthrough ({map.walkthrough.length} steps)
                  </button>
                </div>
              ) : null}
              <div className="inspector-section">
                <div className="section-title">Nodes</div>
                <div className="node-list" role="list">
                  {nodes.map((item) => (
                    <button key={item.id} type="button" className="node-list-row" onClick={() => onSelectNode(item.id)} role="listitem">
                      <span>{item.label}</span>
                      <span className="muted">{kindLabel(item.kind)}</span>
                    </button>
                  ))}
                </div>
                <p className="muted small">This list is the keyboard-accessible alternative to the canvas.</p>
              </div>
            </>
          ) : map.type === 'sequence' ? (
            <div className="inspector-section">
              <div className="section-title">Participants</div>
              {map.participants.map((participant) => (
                <div key={participant.id} className="conn-row">
                  <strong>{participant.label}</strong>
                  <span className="muted">{participant.id}</span>
                </div>
              ))}
            </div>
          ) : map.type === 'erd' ? (
            <div className="inspector-section">
              <div className="section-title">Entities</div>
              {map.entities.map((entity) => (
                <div key={entity.id} className="conn-row">
                  <strong>{entity.label}</strong>
                  <span className="muted">{entity.fields.length} fields</span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="inspector-section">
            <div className="section-title">Details</div>
            <div className="kv">
              <span>Level</span>
              <strong>{map.level ?? 'unset'}</strong>
            </div>
            <div className="kv">
              <span>Phase</span>
              <strong>{map.phase ?? '—'}</strong>
            </div>
            <div className="kv">
              <span>File</span>
              <code>{detail.file}</code>
            </div>
            <div className="kv">
              <span>Rev</span>
              <code>{detail.rev.slice(0, 10)}</code>
            </div>
          </div>
          <div className="inspector-section">
            <button type="button" className="btn subtle full" onClick={onOpenNotes}>
              Open related notes
            </button>
          </div>
        </div>
      </aside>
    );
  }

  const evidenceTone = evidence?.status === 'verified' ? 'ok' : evidence?.status === 'stale' ? 'error' : evidence?.status === 'planned' ? 'info' : 'warn';
  const isLocked = detail.locked.includes(node.id);

  const save = async (): Promise<void> => {
    if (!String(draft.label ?? '').trim()) {
      onToast('Label cannot be empty.', 'error');
      return;
    }
    setSaving(true);
    try {
      const cleanRefs: CodeRef[] = refs
        .filter((ref) => ref.path.trim())
        .map((ref) => {
          const path = ref.path.trim().replace(/\\/g, '/');
          const existing = (node.refs ?? []).find((candidate) => candidate.path === path && (candidate.symbol ?? '') === ref.symbol.trim());
          return {
            path,
            ...(ref.symbol.trim() ? { symbol: ref.symbol.trim() } : {}),
            ...(existing?.lines ? { lines: existing.lines } : {}),
          };
        });
      const next: Partial<VibeNode> = {
        label: String(draft.label ?? '').trim(),
        kind: draft.kind as NodeKind,
        status: draft.status as NodeStatus,
        description: String(draft.description ?? '').trim(),
        plain: String(draft.plain ?? '').trim(),
        refs: cleanRefs,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      };
      await onUpdateNode(node.id, next);
      onToast('Node updated.', 'ok');
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const previewCode = async (ref: CodeRef): Promise<void> => {
    setCodeError(null);
    try {
      const result = await api.code(ref.path, ref.lines?.[0], ref.lines?.[1]);
      setCode({ path: ref.path, content: result.content });
    } catch (err) {
      setCodeError((err as Error).message);
    }
  };

  const askAgent = async (): Promise<void> => {
    try {
      const { prompt } = await api.explain({ map: detail.id, node: node.id });
      if (await copyText(prompt)) onToast('Explain prompt copied. Paste it into your agent.', 'ok');
      else onToast('Could not copy prompt.', 'error');
    } catch (err) {
      onToast((err as Error).message, 'error');
    }
  };

  return (
    <aside className="inspector" aria-label="Node inspector">
      <div className="inspector-scroll">
        <div className="inspector-head">
          <div>
            <span className="eyebrow">
              {kindLabel(node.kind)} {node.status ? `· ${node.status}` : ''}
            </span>
            <h2>{node.label}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={() => onSelectNode('')} aria-label="Clear selection">
            ×
          </button>
        </div>
        <div className="inspector-badges">
          <Badge tone={evidenceTone}>{evidence?.status ?? 'declared'}</Badge>
          {isLocked ? <Badge tone="info">🔒 locked</Badge> : null}
          {node.group ? <Badge tone="neutral">{node.group}</Badge> : null}
          {node.tags?.map((tag) => (
            <Badge key={tag} tone="neutral">
              #{tag}
            </Badge>
          ))}
        </div>

        {mode === 'edit' ? (
          <>
            <div className="inspector-section">
              <label className="field">
                <span>Label</span>
                <input value={String(draft.label ?? '')} onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
              </label>
              <div className="field-row">
                <label className="field">
                  <span>Kind</span>
                  <select value={String(draft.kind ?? node.kind)} onChange={(event) => setDraft({ ...draft, kind: event.target.value as NodeKind })}>
                    {NODE_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Status</span>
                  <select value={String(draft.status ?? 'built')} onChange={(event) => setDraft({ ...draft, status: event.target.value as NodeStatus })}>
                    {NODE_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="field">
                <span>Description (≤ 200 chars)</span>
                <textarea rows={3} maxLength={200} value={String(draft.description ?? '')} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
              </label>
              <label className="field">
                <span>Plain-language (beginner mode)</span>
                <textarea rows={2} value={String(draft.plain ?? '')} onChange={(event) => setDraft({ ...draft, plain: event.target.value })} />
              </label>
              <label className="field">
                <span>Tags (comma separated)</span>
                <input value={tags} onChange={(event) => setTags(event.target.value)} />
              </label>
            </div>
            <div className="inspector-section">
              <div className="section-title">Code refs</div>
              {refs.map((ref, index) => (
                <div key={index} className="ref-editor">
                  <input placeholder="src/path.ts" value={ref.path} onChange={(event) => setRefs(refs.map((r, i) => (i === index ? { ...r, path: event.target.value } : r)))} />
                  <input placeholder="symbol (optional)" value={ref.symbol} onChange={(event) => setRefs(refs.map((r, i) => (i === index ? { ...r, symbol: event.target.value } : r)))} />
                  <button type="button" className="icon-btn" onClick={() => setRefs(refs.filter((_, i) => i !== index))} aria-label="Remove ref">
                    ×
                  </button>
                </div>
              ))}
              <button type="button" className="btn small subtle" onClick={() => setRefs([...refs, { path: '', symbol: '' }])}>
                + Add ref
              </button>
            </div>
            <div className="inspector-actions">
              <button type="button" className="btn primary" onClick={() => void save()} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button type="button" className="btn subtle" onClick={() => setDraft({ ...draft, label: node.label, kind: node.kind, description: node.description ?? '', plain: node.plain ?? '', status: node.status ?? 'built' })}>
                Reset
              </button>
              <button type="button" className="btn danger" onClick={() => void onDeleteNode(node.id)}>
                Delete
              </button>
            </div>
            <p className="muted small">Saving a human edit auto-locks this node so agents cannot overwrite it silently.</p>
          </>
        ) : (
          <>
            <p className={classNames('node-description', beginner && node.plain && 'plain')}>{beginner ? node.plain ?? node.description ?? 'No plain-language note yet.' : node.description ?? 'No description yet.'}</p>
            {!beginner && node.plain ? (
              <div className="plain-note">
                <span>Plain language</span>
                <p>{node.plain}</p>
              </div>
            ) : null}
            <div className="inspector-section">
              <div className="section-title">Code refs</div>
              {(node.refs ?? []).length ? (
                (node.refs ?? []).map((ref, index) => (
                  <div key={index} className="ref-view">
                    <button type="button" className="ref-path" onClick={() => void copyText(ref.path)} title="Copy path">
                      <code>{shortPath(ref.path)}</code>
                      {ref.symbol ? <span>#{ref.symbol}</span> : null}
                      {ref.lines ? <span className="muted">:{ref.lines[0]}–{ref.lines[1]}</span> : null}
                    </button>
                    <button type="button" className="btn tiny" onClick={() => void previewCode(ref)}>
                      Peek
                    </button>
                  </div>
                ))
              ) : (
                <p className="muted small">No refs. {node.kind === 'external' || node.kind === 'actor' ? 'Allowed for external systems and people.' : 'Add code refs so this node is verifiable.'}</p>
              )}
              {codeError ? <p className="inline-error">{codeError}</p> : null}
              {code ? (
                <div className="code-peek">
                  <div className="code-peek-head">
                    <code>{code.path}</code>
                    <button type="button" className="icon-btn" onClick={() => setCode(null)} aria-label="Close code preview">
                      ×
                    </button>
                  </div>
                  <pre>{code.content}</pre>
                </div>
              ) : null}
            </div>
            <div className="inspector-section">
              <div className="section-title">Connections</div>
              {connections.incoming.length + connections.outgoing.length === 0 ? <p className="muted small">No connections yet.</p> : null}
              {connections.incoming.map(({ edge, node: other }) => (
                <button key={`in-${edge.from}-${edge.to}-${edge.kind}`} type="button" className="conn-row clickable" onClick={() => other && onSelectNode(other.id)}>
                  <span className="conn-dir">←</span>
                  <span>{other?.label ?? edge.from}</span>
                  <Badge tone="neutral">{edge.kind}</Badge>
                </button>
              ))}
              {connections.outgoing.map(({ edge, node: other }) => (
                <button key={`out-${edge.from}-${edge.to}-${edge.kind}`} type="button" className="conn-row clickable" onClick={() => other && onSelectNode(other.id)}>
                  <span className="conn-dir">→</span>
                  <span>{other?.label ?? edge.to}</span>
                  <Badge tone="neutral">{edge.kind}</Badge>
                </button>
              ))}
            </div>
            <div className="inspector-section">
              <div className="section-title">History</div>
              {nodeChanges.length ? (
                nodeChanges.map((change) => (
                  <div key={change.id} className="history-row">
                    <strong>{change.title}</strong>
                    <span className="muted">{change.date.slice(0, 10)}</span>
                  </div>
                ))
              ) : (
                <p className="muted small">No recorded changes touch this node yet.</p>
              )}
            </div>
            {node.drill ? (
              <div className="inspector-section">
                <div className="section-title">Drill down</div>
                <code>{node.drill}</code>
              </div>
            ) : null}
            <div className="inspector-actions">
              <button type="button" className="btn primary" onClick={() => void askAgent()}>
                Ask agent about this
              </button>
              <button type="button" className={classNames('btn', isLocked ? 'subtle' : 'subtle')} onClick={() => void onLock(node.id, !isLocked)}>
                {isLocked ? 'Unlock node' : 'Lock node'}
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
