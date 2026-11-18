import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { List, ListItem } from '@astryxdesign/core/List';
import { Collapsible } from '@astryxdesign/core/Collapsible';
import type { ChangeEntry, CodeRef, NodeKind, NodeStatus, VibeNode } from '@core/types';
import { NODE_KINDS, NODE_STATUSES } from '@core/types';
import { kindLabel } from '@core/theme';
import { api, type MapDetail } from '../api';
import { Badge } from './ui';
import { Icon } from './icons';
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
  onCollapse,
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
  onCollapse?: () => void;
}): React.ReactElement {
  const graph = detail?.map.type === 'graph' ? detail.map : null;
  const node = graph?.nodes.find((item) => item.id === selectedNodeId) ?? null;
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
    const byId = new Map(graph.nodes.map((item) => [item.id, item]));
    return {
      incoming: graph.edges.filter((edge) => edge.to === node.id).map((edge) => ({ edge, node: byId.get(edge.from) })),
      outgoing: graph.edges.filter((edge) => edge.from === node.id).map((edge) => ({ edge, node: byId.get(edge.to) })),
    };
  }, [graph, node]);

  const nodeChanges = useMemo(() => {
    if (!detail || !node) return [];
    return changes
      .filter((change) => change.delta.added_nodes.includes(`${detail.id}#${node.id}`) || change.delta.modified_nodes.includes(`${detail.id}#${node.id}`))
      .slice(0, 5);
  }, [changes, detail, node]);

  if (!detail) {
    return (
      <aside className="inspector" aria-label="Inspector">
        <div className="inspector-head">
          <h2>Inspector</h2>
          {onCollapse ? (
            <IconButton label="Collapse inspector" tooltip="Collapse inspector" icon={<Icon name="panelRightOpen" />} variant="ghost" size="sm" onClick={onCollapse} />
          ) : null}
        </div>
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
    const nodes =
      map.type === 'graph'
        ? map.nodes
        : map.type === 'sequence'
          ? map.participants.map((participant) => ({ id: participant.id, label: participant.label, kind: participant.kind ?? 'actor', status: undefined, refs: participant.refs }))
          : map.type === 'erd'
            ? map.entities.map((entity) => ({ id: entity.id, label: entity.label, kind: 'database', status: undefined, refs: entity.refs }))
            : [];
    const edgeCount = map.type === 'graph' ? map.edges.length : map.type === 'sequence' ? map.steps.length : map.type === 'erd' ? map.relations.length : 0;

    return (
      <aside className="inspector" aria-label="Inspector">
        <div className="inspector-scroll">
          <div className="inspector-head">
            <div>
              <h2>{map.title}</h2>
              <div className="inspector-meta">
                <span>{map.type === 'graph' ? 'Graph' : map.type === 'erd' ? 'Data model' : map.type === 'sequence' ? 'Sequence' : 'Mermaid'}</span>
                <span>{map.level ?? 'unset'} level</span>
              </div>
            </div>
            {onCollapse ? (
              <IconButton label="Collapse inspector" tooltip="Collapse inspector" icon={<Icon name="panelRightOpen" />} variant="ghost" size="sm" onClick={onCollapse} />
            ) : null}
          </div>

          <p className="map-summary">{map.summary || 'No summary yet. Ask an agent to add one.'}</p>

          <div className="stat-row">
            <div>
              <strong>{nodes.length}</strong>
              <span>{map.type === 'erd' ? 'entities' : 'nodes'}</span>
            </div>
            <div>
              <strong>{edgeCount}</strong>
              <span>{map.type === 'sequence' ? 'steps' : 'edges'}</span>
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
                <Collapsible trigger={<div className="section-title">Evidence</div>} defaultIsOpen>
                  {(['verified', 'declared', 'stale', 'planned'] as const).map((status) => (
                    <div key={status} className="evidence-row">
                      <Badge tone={status === 'verified' ? 'ok' : status === 'stale' ? 'error' : status === 'declared' ? 'warn' : 'info'}>{status}</Badge>
                      <span className="tabular">{evidenceCounts[status] ?? 0}</span>
                    </div>
                  ))}
                  {detail.error ? <p className="inline-error">{detail.error.message}</p> : null}
                </Collapsible>
              </div>

              {map.walkthrough?.length ? (
                <div className="inspector-section">
                  <Button label={`Start walkthrough (${map.walkthrough.length} steps)`} variant="secondary" width="100%" onClick={onStartWalkthrough} />
                </div>
              ) : null}

              <div className="inspector-section">
                <Collapsible trigger={<div className="section-title">Nodes</div>} defaultIsOpen>
                  <div className="node-list">
                    <List density="compact" hasDividers>
                      {nodes.map((item) => (
                        <ListItem key={item.id} onClick={() => onSelectNode(item.id)} label={item.label} endContent={<span className="muted small">{kindLabel(item.kind)}</span>} />
                      ))}
                    </List>
                  </div>
                  <p className="muted small">Keyboard-accessible alternative to the canvas.</p>
                </Collapsible>
              </div>
            </>
          ) : map.type === 'sequence' ? (
            <div className="inspector-section">
              <div className="section-title">Participants</div>
              {map.participants.map((participant) => (
                <div key={participant.id} className="conn-row">
                  <strong>{participant.label}</strong>
                  <span className="muted small">{participant.id}</span>
                </div>
              ))}
            </div>
          ) : map.type === 'erd' ? (
            <div className="inspector-section">
              <div className="section-title">Entities</div>
              {map.entities.map((entity) => (
                <div key={entity.id} className="conn-row">
                  <strong>{entity.label}</strong>
                  <span className="muted small">{entity.fields.length} fields</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="inspector-section">
            <Collapsible trigger={<div className="section-title">Details</div>} defaultIsOpen>
              <div className="kv">
                <span>Phase</span>
                <strong>{map.phase ?? 'none'}</strong>
              </div>
              <div className="kv">
                <span>File</span>
                <code>{detail.file}</code>
              </div>
              <div className="kv">
                <span>Revision</span>
                <code>{detail.rev.slice(0, 10)}</code>
              </div>
            </Collapsible>
          </div>

          <div className="inspector-section">
            <Button label="Open related notes" variant="ghost" width="100%" onClick={onOpenNotes} />
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
      onToast('Node saved and locked.', 'ok');
    } catch (error) {
      onToast((error as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const previewCode = async (ref: CodeRef): Promise<void> => {
    setCodeError(null);
    try {
      const result = await api.code(ref.path, ref.lines?.[0], ref.lines?.[1]);
      setCode({ path: ref.path, content: result.content });
    } catch (error) {
      setCodeError((error as Error).message);
    }
  };

  const askAgent = async (): Promise<void> => {
    try {
      const { prompt } = await api.explain({ map: detail.id, node: node.id });
      if (await copyText(prompt)) onToast('Prompt copied. Paste it into your agent.', 'ok');
      else onToast('Could not copy to clipboard.', 'error');
    } catch (error) {
      onToast((error as Error).message, 'error');
    }
  };

  return (
    <aside className="inspector" aria-label="Node inspector">
      <div className="inspector-scroll">
        <div className="inspector-head">
          <div>
            <h2>{node.label}</h2>
            <div className="inspector-meta">
              <span>{kindLabel(node.kind)}</span>
              {node.status ? <span>{node.status}</span> : null}
              {node.group ? <span>{node.group}</span> : null}
            </div>
          </div>
          <div className="inspector-head-actions">
            <IconButton label="Clear selection" tooltip="Clear selection" icon={<Icon name="close" />} variant="ghost" size="sm" onClick={() => onSelectNode('')} />
            {onCollapse ? (
              <IconButton label="Collapse inspector" tooltip="Collapse inspector" icon={<Icon name="panelRightOpen" />} variant="ghost" size="sm" onClick={onCollapse} />
            ) : null}
          </div>
        </div>

        <div className="inspector-badges">
          <Badge tone={evidenceTone}>{evidence?.status ?? 'declared'}</Badge>
          {isLocked ? (
            <span className="lock-badge">
              <Icon name="lock" size={14} />
              Locked
            </span>
          ) : null}
          {node.tags?.map((tag) => (
            <Badge key={tag} tone="neutral">
              {tag}
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
                <span>Description</span>
                <textarea rows={3} maxLength={200} value={String(draft.description ?? '')} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
              </label>
              <label className="field">
                <span>Plain-language note</span>
                <textarea rows={2} value={String(draft.plain ?? '')} onChange={(event) => setDraft({ ...draft, plain: event.target.value })} />
              </label>
              <label className="field">
                <span>Tags, comma separated</span>
                <input value={tags} onChange={(event) => setTags(event.target.value)} />
              </label>
            </div>

            <div className="inspector-section">
              <div className="section-title">Code refs</div>
              {refs.map((ref, index) => (
                <div key={index} className="ref-editor">
                  <input
                    placeholder="src/path.ts"
                    aria-label="Reference path"
                    value={ref.path}
                    onChange={(event) => setRefs(refs.map((item, itemIndex) => (itemIndex === index ? { ...item, path: event.target.value } : item)))}
                  />
                  <input
                    placeholder="symbol"
                    aria-label="Reference symbol"
                    value={ref.symbol}
                    onChange={(event) => setRefs(refs.map((item, itemIndex) => (itemIndex === index ? { ...item, symbol: event.target.value } : item)))}
                  />
                  <IconButton label="Remove reference" icon={<Icon name="close" />} variant="ghost" size="sm" onClick={() => setRefs(refs.filter((_, itemIndex) => itemIndex !== index))} />
                </div>
              ))}
              <Button label="Add reference" variant="ghost" size="sm" onClick={() => setRefs([...refs, { path: '', symbol: '' }])} />
            </div>

            <div className="inspector-actions">
              <Button label={saving ? 'Saving' : 'Save changes'} variant="primary" isDisabled={saving} onClick={() => void save()} />
              <Button
                label="Reset"
                variant="ghost"
                onClick={() => setDraft({ ...draft, label: node.label, kind: node.kind, description: node.description ?? '', plain: node.plain ?? '', status: node.status ?? 'built' })}
              />
              <Button label="Delete" variant="destructive" onClick={() => void onDeleteNode(node.id)} />
            </div>
            <p className="muted small">Saving a human edit locks this node so agents cannot overwrite it.</p>
          </>
        ) : (
          <>
            <p className={classNames('node-description', beginner && node.plain && 'plain')}>
              {beginner ? node.plain ?? node.description ?? 'No plain-language note yet.' : node.description ?? 'No description yet.'}
            </p>
            {!beginner && node.plain ? (
              <div className="plain-note">
                <span>Plain language</span>
                <p>{node.plain}</p>
              </div>
            ) : null}

            <div className="inspector-section">
              <Collapsible trigger={<div className="section-title">Code refs</div>} defaultIsOpen>
                {(node.refs ?? []).length ? (
                  (node.refs ?? []).map((ref, index) => (
                    <div key={index} className="ref-view">
                      <button type="button" className="ref-path" onClick={() => void copyText(ref.path)} title="Copy path">
                        <code>{shortPath(ref.path)}</code>
                        {ref.symbol ? <span>#{ref.symbol}</span> : null}
                        {ref.lines ? (
                          <span className="muted">
                            :{ref.lines[0]} to {ref.lines[1]}
                          </span>
                        ) : null}
                      </button>
                      <Button label="Peek" variant="secondary" size="sm" onClick={() => void previewCode(ref)} />
                    </div>
                  ))
                ) : (
                  <p className="muted small">
                    No refs. {node.kind === 'external' || node.kind === 'actor' ? 'Allowed for external systems and people.' : 'Add code refs so this node is verifiable.'}
                  </p>
                )}
                {codeError ? <p className="inline-error">{codeError}</p> : null}
                {code ? (
                  <div className="code-peek">
                    <div className="code-peek-head">
                      <code>{code.path}</code>
                      <IconButton label="Close code preview" icon={<Icon name="close" />} variant="ghost" size="sm" onClick={() => setCode(null)} />
                    </div>
                    <pre>{code.content}</pre>
                  </div>
                ) : null}
              </Collapsible>
            </div>

            <div className="inspector-section">
              <Collapsible trigger={<div className="section-title">Connections</div>} defaultIsOpen>
                {connections.incoming.length + connections.outgoing.length === 0 ? <p className="muted small">No connections yet.</p> : null}
                {connections.incoming.length + connections.outgoing.length > 0 ? (
                  <List density="compact" hasDividers>
                    {connections.incoming.map(({ edge, node: other }) => (
                      <ListItem
                        key={`in-${edge.from}-${edge.to}-${edge.kind}`}
                        onClick={() => other && onSelectNode(other.id)}
                        startContent={
                          <span className="conn-dir">
                            <Icon name="arrowLeft" size={14} />
                          </span>
                        }
                        label={other?.label ?? edge.from}
                        endContent={<Badge tone="neutral">{edge.kind}</Badge>}
                      />
                    ))}
                    {connections.outgoing.map(({ edge, node: other }) => (
                      <ListItem
                        key={`out-${edge.from}-${edge.to}-${edge.kind}`}
                        onClick={() => other && onSelectNode(other.id)}
                        startContent={
                          <span className="conn-dir">
                            <Icon name="arrowRight" size={14} />
                          </span>
                        }
                        label={other?.label ?? edge.to}
                        endContent={<Badge tone="neutral">{edge.kind}</Badge>}
                      />
                    ))}
                  </List>
                ) : null}
              </Collapsible>
            </div>

            <div className="inspector-section">
              <Collapsible trigger={<div className="section-title">History</div>} defaultIsOpen>
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
              </Collapsible>
            </div>

            {node.drill ? (
              <div className="inspector-section">
                <div className="section-title">Drill down</div>
                <code className="small">{node.drill}</code>
              </div>
            ) : null}

            <div className="inspector-actions">
              <Button label="Ask your agent to explain" variant="primary" onClick={() => void askAgent()} />
              <Button label={isLocked ? 'Unlock node' : 'Lock node'} variant="secondary" onClick={() => void onLock(node.id, !isLocked)} />
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
