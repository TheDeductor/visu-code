import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Token } from '@astryxdesign/core/Token';
import { List, ListItem } from '@astryxdesign/core/List';
import type { ChangeEntry, CheckReport, CoverageReport, HistoryPoint, Issue, Phase, Suggestion } from '@core/types';
import { api, type NoteEntry, type PhaseProgress } from '../api';
import { Badge, EmptyState, ProgressBar, Spinner } from './ui';
import { Icon } from './icons';
import { classNames, copyText, formatDate, issueLocation, mapIdFromIssueFile, parseBodySections, promptForFile, relativeTime } from '../util';

export function ChangesPanel({
  changes,
  loading,
  onOpenMap,
  onDiff,
}: {
  changes: ChangeEntry[];
  loading: boolean;
  onOpenMap: (id: string) => void;
  onDiff: (change: ChangeEntry) => void;
}): React.ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = changes.find((change) => change.id === selectedId) ?? changes[0];
  if (loading && !changes.length) return <Spinner label="Loading change log" />;
  if (!changes.length) {
    return (
      <EmptyState icon="history" title="No changes recorded yet">
        <p>
          Ask your agent to run <code>vibemap change add</code> after updating maps. Each entry gets a plain-language What, Why and How.
        </p>
        <p>In Claude Code, the stop hook can remind it automatically.</p>
      </EmptyState>
    );
  }
  return (
    <div className="changes-layout">
      <div className="change-list">
        <List density="compact" hasDividers>
          {changes.map((change) => (
            <ListItem
              key={change.id}
              isSelected={selected?.id === change.id}
              onClick={() => setSelectedId(change.id)}
              label={
                <div className="change-card-top">
                  <strong>{change.title}</strong>
                  <span className="muted small">{relativeTime(change.date)}</span>
                </div>
              }
              description={
                <>
                  <div className="change-badges">
                    <Badge tone="neutral">{change.type}</Badge>
                    {change.phase ? <Badge tone="info">{change.phase}</Badge> : null}
                    {change.commit ? <Badge tone="ok">Committed</Badge> : <Badge tone="warn">Not committed</Badge>}
                  </div>
                  <div className="delta-chips">
                    <Token label={`+${change.delta.added_nodes.length}`} color="green" size="sm" />
                    <Token label={`~${change.delta.modified_nodes.length}`} color="orange" size="sm" />
                    <Token label={`-${change.delta.removed_nodes.length}`} color="red" size="sm" />
                    <span className="muted small">{change.maps.join(', ')}</span>
                  </div>
                </>
              }
            />
          ))}
        </List>
      </div>
      {selected ? (
        <article className="change-detail">
          <header>
            <div>
              <h2>{selected.title}</h2>
              <div className="change-meta">
                <span>{formatDate(selected.date)}</span>
                <span>by {selected.author}</span>
                {selected.commit ? <code>{selected.commit}</code> : <span>Not committed</span>}
              </div>
            </div>
            <div className="change-detail-actions">
              <Button label="View diff" variant="secondary" size="sm" onClick={() => onDiff(selected)} />
              {selected.maps[0] ? <Button label="Open map" variant="ghost" size="sm" onClick={() => onOpenMap(selected.maps[0]!)} /> : null}
            </div>
          </header>
          {parseBodySections(selected.body).map((section) => (
            <section key={section.heading} className="change-section">
              <h3>{section.heading}</h3>
              <p>{section.body}</p>
            </section>
          ))}
          <div className="change-detail-actions">
            {selected.maps.map((map) => (
              <Token key={map} label={map} color="blue" size="sm" onClick={() => onOpenMap(map)} />
            ))}
          </div>
        </article>
      ) : null}
    </div>
  );
}

export function TimelinePanel({
  history,
  loading,
  selectedRev,
  currentMap,
  onSelect,
  onDiff,
  onBack,
}: {
  history: HistoryPoint[];
  loading: boolean;
  selectedRev: string | null;
  currentMap: string | null;
  onSelect: (point: HistoryPoint) => void;
  onDiff: (point: HistoryPoint) => void;
  onBack: () => void;
}): React.ReactElement {
  if (!currentMap) return <EmptyState icon="clock" title="Open a map to see its timeline" />;
  if (loading && !history.length) return <Spinner label="Loading history" />;
  if (!history.length) {
    return (
      <EmptyState icon="clock" title="No history for this map yet">
        <p>Commit the project or save the map to start a timeline. VisuCode keeps local journal points, so you can look back before the first commit.</p>
      </EmptyState>
    );
  }
  return (
    <div className="timeline-panel">
      <div className="page-head">
        <div>
          <h2>{currentMap}</h2>
          <div className="page-head-meta">
            <span>Filled ticks are commits, thin ticks are local journal points.</span>
          </div>
        </div>
        {selectedRev ? (
          <div className="timeline-actions">
            <Button label="Compare with now" variant="secondary" size="sm" onClick={() => onDiff(history.find((point) => point.rev === selectedRev) ?? history[0]!)} />
            <Button label="Back to now" variant="ghost" size="sm" onClick={onBack} />
          </div>
        ) : null}
      </div>
      <div className="timeline-rail">
        <input
          type="range"
          min={0}
          max={Math.max(0, history.length - 1)}
          value={Math.max(0, history.findIndex((point) => point.rev === selectedRev))}
          onChange={(event) => onSelect(history[Number(event.target.value)] ?? history[0]!)}
          aria-label="Select a history point"
        />
        <div className="timeline-ticks">
          {history.slice(0, 40).map((point) => (
            <button
              key={point.id}
              type="button"
              className={classNames('tick', point.kind, selectedRev === point.rev && 'active')}
              onClick={() => onSelect(point)}
              title={`${formatDate(point.ts)} · ${point.summary}`}
              aria-label={`${point.summary} at ${formatDate(point.ts)}`}
            />
          ))}
        </div>
      </div>
      <div className="timeline-list">
        {history.map((point) => (
          <button key={point.id} type="button" className={classNames('timeline-row', selectedRev === point.rev && 'active')} onClick={() => onSelect(point)}>
            <span className={classNames('timeline-dot', point.kind)} />
            <span className="timeline-copy">
              <strong>{point.summary}</strong>
              <span className="muted">
                {formatDate(point.ts)} · {point.kind === 'git' ? `commit ${point.commit?.slice(0, 8)}` : point.origin ?? 'journal'}
              </span>
            </span>
            {selectedRev === point.rev ? <Badge tone="info">Viewing</Badge> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PhasesPanel({
  phases,
  loading,
  onStart,
  onDone,
  onFilter,
  onSnapshot,
  onCreate,
}: {
  phases: PhaseProgress[];
  loading: boolean;
  onStart: (id: string) => void;
  onDone: (id: string) => void;
  onFilter: (id: string | null) => void;
  onSnapshot: (phase: Phase) => void;
  onCreate: (title: string) => Promise<void>;
}): React.ReactElement {
  const [title, setTitle] = useState('');
  if (loading && !phases.length) return <Spinner label="Loading phases" />;
  return (
    <div className="phases-panel">
      <div className="page-head">
        <div>
          <h2>Phases</h2>
          <div className="page-head-meta">
            <span>Plan first, then build. Planned nodes are outlined on the canvas; finishing a phase snapshots the maps.</span>
          </div>
        </div>
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim()) return;
            void onCreate(title.trim()).then(() => setTitle(''));
          }}
        >
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="New phase title" aria-label="New phase title" />
          <Button label="Add phase" type="submit" variant="secondary" size="sm" />
        </form>
      </div>
      {!phases.length ? (
        <EmptyState icon="circleDot" title="No phases yet">
          <p>Create a phase to group work, or ask your agent to plan one.</p>
        </EmptyState>
      ) : null}
      <div className="phase-grid">
        {phases.map((phase) => {
          const percent = phase.total ? Math.round((phase.built / phase.total) * 100) : 0;
          return (
            <div key={phase.id} className={classNames('phase-card', `phase-${phase.status}`)}>
              <header>
                <div>
                  <h3>{phase.title}</h3>
                  <div className="page-head-meta">
                    <span>{phase.id}</span>
                  </div>
                </div>
                <Badge tone={phase.status === 'done' ? 'ok' : phase.status === 'active' ? 'info' : 'neutral'}>{phase.status}</Badge>
              </header>
              <p>{phase.goal ?? 'No goal set.'}</p>
              <ProgressBar percent={percent} tone={percent === 100 ? 'ok' : 'info'} />
              <div className="phase-meta">
                <span>
                  {phase.built}/{phase.total} built
                </span>
                <span>{phase.planned} planned</span>
              </div>
              <div className="phase-actions">
                {phase.status !== 'active' && phase.status !== 'done' ? <Button label="Start" variant="secondary" size="sm" onClick={() => onStart(phase.id)} /> : null}
                {phase.status !== 'done' ? <Button label="Finish" variant="ghost" size="sm" onClick={() => onDone(phase.id)} /> : null}
                {phase.snapshot ? <Button label="View snapshot" variant="ghost" size="sm" onClick={() => onSnapshot(phase)} /> : null}
                <Button label="Filter canvas" variant="ghost" size="sm" onClick={() => onFilter(phase.id)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Markdown({ body, onOpenNode }: { body: string; onOpenNode: (map: string, node: string) => void }): React.ReactElement {
  const lines = body.split('\n');
  const nodes: React.ReactNode[] = [];
  let list: string[] = [];
  let code: string[] = [];
  let inCode = false;
  const flushList = (): void => {
    if (!list.length) return;
    nodes.push(
      <ul key={`list-${nodes.length}`}>
        {list.map((item, index) => (
          <li key={index}>{inline(item, onOpenNode)}</li>
        ))}
      </ul>,
    );
    list = [];
  };
  const flushCode = (): void => {
    if (!code.length) return;
    nodes.push(
      <pre key={`code-${nodes.length}`}>
        <code>{code.join('\n')}</code>
      </pre>,
    );
    code = [];
  };
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) flushCode();
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushList();
      const level = heading[1]!.length;
      const text = heading[2]!;
      const element = level === 1 ? <h1 key={`h-${nodes.length}`}>{text}</h1> : level === 2 ? <h2 key={`h-${nodes.length}`}>{text}</h2> : level === 3 ? <h3 key={`h-${nodes.length}`}>{text}</h3> : <h4 key={`h-${nodes.length}`}>{text}</h4>;
      nodes.push(element);
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      list.push(bullet[1]!);
      continue;
    }
    flushList();
    if (!line.trim()) {
      nodes.push(<div key={`sp-${nodes.length}`} className="md-space" />);
    } else {
      nodes.push(<p key={`p-${nodes.length}`}>{inline(line, onOpenNode)}</p>);
    }
  }
  flushList();
  flushCode();
  return <div className="markdown">{nodes}</div>;
}

function inline(text: string, onOpenNode: (map: string, node: string) => void): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\[\[([^\]]+)\]\])|`([^`]+)`|\*\*([^*]+)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = regex.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[2]) {
      const [map, node] = match[2].split('#');
      if (node && map) {
        parts.push(
          <button key={`link-${index++}`} type="button" className="inline-link" onClick={() => onOpenNode(map, node)}>
            {match[2]}
          </button>,
        );
      } else {
        parts.push(<code key={`wikilink-${index++}`}>{match[2]}</code>);
      }
    } else if (match[3]) {
      parts.push(<code key={`code-${index++}`}>{match[3]}</code>);
    } else if (match[4]) {
      parts.push(<strong key={`strong-${index++}`}>{match[4]}</strong>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function NotesPanel({
  notes,
  loading,
  onOpenNode,
  onRefresh,
}: {
  notes: NoteEntry[];
  loading: boolean;
  onOpenNode: (map: string, node: string) => void;
  onRefresh: () => void;
}): React.ReactElement {
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState<NoteEntry | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const current = selected ?? notes[0]?.path ?? null;

  useEffect(() => {
    if (!current) {
      setNote(null);
      return;
    }
    let active = true;
    api
      .note(current)
      .then((value) => {
        if (!active) return;
        setNote(value);
        setDraft(value.raw);
        setEditing(false);
      })
      .catch((err) => active && setError((err as Error).message));
    return () => {
      active = false;
    };
  }, [current, notes.length]);

  const createNote = async (): Promise<void> => {
    const title = newTitle.trim();
    if (!title) return;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'note';
    const body = `---\nschema: 1\ntitle: ${title}\nmaps: []\nnodes: []\n---\n\n# ${title}\n\n`;
    try {
      const created = await api.saveNote(`${slug}.md`, body);
      onRefresh();
      setSelected(created.path);
      setCreating(false);
      setNewTitle('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const save = async (): Promise<void> => {
    if (!note) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.saveNote(note.path, draft);
      setNote(updated);
      setEditing(false);
      onRefresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !notes.length) return <Spinner label="Loading notes" />;

  return (
    <div className="notes-layout">
      <div className="notes-list">
        <div className="notes-list-head">
          <span>Notes</span>
          <IconButton label="New note" tooltip="New note" icon={<Icon name="plus" />} variant="ghost" size="sm" onClick={() => setCreating((value) => !value)} />
        </div>
        {creating ? (
          <form
            className="inline-form note-new"
            onSubmit={(event) => {
              event.preventDefault();
              void createNote();
            }}
          >
            <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Note title" aria-label="Note title" autoFocus />
            <Button label="Add" type="submit" size="sm" variant="secondary" />
          </form>
        ) : null}
        {notes.map((item) => (
          <button key={item.path} type="button" className={classNames('note-row', current === item.path && 'active')} onClick={() => setSelected(item.path)}>
            <strong>{item.title}</strong>
            <span className="muted">{item.path.replace('.vibemap/notes/', '')}</span>
          </button>
        ))}
        {!notes.length ? <p className="muted small">No notes yet.</p> : null}
      </div>
      <div className="note-detail">
        {note ? (
          <>
            <header>
              <div>
                <h2>{note.title}</h2>
                <div className="page-head-meta">
                  <span>{note.path.replace('.vibemap/notes/', '')}</span>
                </div>
              </div>
              <div className="change-detail-actions">
                {editing ? (
                  <>
                    <Button label={busy ? 'Saving' : 'Save'} variant="primary" size="sm" isDisabled={busy} onClick={() => void save()} />
                    <Button label="Cancel" variant="ghost" size="sm" onClick={() => setEditing(false)} />
                  </>
                ) : (
                  <Button label="Edit" variant="secondary" size="sm" onClick={() => setEditing(true)} />
                )}
              </div>
            </header>
            {error ? <p className="inline-error">{error}</p> : null}
            {note.maps.length || note.nodes.length ? (
              <div className="note-links">
                {note.maps.map((map) => (
                  <Badge key={map} tone="neutral">
                    {map}
                  </Badge>
                ))}
                {note.nodes.map((node) => (
                  <Badge key={node} tone="info">
                    {node}
                  </Badge>
                ))}
              </div>
            ) : null}
            {editing ? <textarea className="note-editor" value={draft} onChange={(event) => setDraft(event.target.value)} spellCheck={false} /> : <Markdown body={note.body} onOpenNode={onOpenNode} />}
          </>
        ) : (
          <EmptyState icon="pencil" title="No note selected">
            <p>Notes hold the longer explanations that would make a node description too long.</p>
          </EmptyState>
        )}
      </div>
    </div>
  );
}

export function CoveragePanel({
  coverage,
  suggestions,
  loading,
  onOpenNode,
  onCopy,
}: {
  coverage: CoverageReport | null;
  suggestions: Suggestion[];
  loading: boolean;
  onOpenNode: (map: string, node: string) => void;
  onCopy: (text: string, message?: string) => void;
}): React.ReactElement {
  if (loading && !coverage) return <Spinner label="Computing coverage" />;
  if (!coverage) return <EmptyState icon="inbox" title="Coverage is not available" />;
  return (
    <div className="coverage-panel">
      <div className="page-head">
        <div>
          <h2>Coverage</h2>
          <div className="page-head-meta">
            <span>
              {coverage.coveredFiles} of {coverage.totalFiles} source files are referenced by at least one map. Target {coverage.target}%.
            </span>
          </div>
        </div>
      </div>

      <div className="coverage-summary">
        <strong className="tabular">{coverage.percent}%</strong>
        <div className="coverage-bar">
          <ProgressBar percent={coverage.percent} tone={coverage.percent >= coverage.target ? 'ok' : 'warn'} />
        </div>
        <span>{coverage.unmapped.length} files unmapped</span>
      </div>

      <div className="coverage-grid">
        <section>
          <h3>By directory</h3>
          {coverage.byDirectory.map((dir) => (
            <div key={dir.dir} className="dir-row">
              <div className="dir-label">
                <code>{dir.dir}</code>
                <span className="muted tabular">
                  {dir.covered}/{dir.total}
                </span>
              </div>
              <ProgressBar percent={dir.percent} tone={dir.percent >= coverage.target ? 'ok' : dir.percent ? 'warn' : 'error'} />
            </div>
          ))}
        </section>
        <section>
          <h3>Gaps worth mapping</h3>
          {suggestions.length ? (
            suggestions.slice(0, 8).map((suggestion) => (
              <div key={`${suggestion.kind}-${suggestion.title}`} className="suggestion-row">
                <div>
                  <strong>{suggestion.title}</strong>
                  {suggestion.file ? (
                    <code>
                      {suggestion.file}
                      {suggestion.line ? `:${suggestion.line}` : ''}
                    </code>
                  ) : null}
                </div>
                <Button label="Copy prompt" variant="secondary" size="sm" onClick={() => onCopy(suggestion.prompt, 'Prompt copied')} />
              </div>
            ))
          ) : (
            <p className="muted small">No obvious gaps.</p>
          )}
        </section>
      </div>

      <section>
        <h3>Declared, stale and planned nodes</h3>
        {coverage.unverified.length ? (
          <div className="chip-list">
            {coverage.unverified.map((item) => (
              <Token
                key={`${item.map}-${item.node}`}
                label={`${item.map}#${item.node} (${item.status})`}
                color={item.status === 'stale' ? 'red' : item.status === 'planned' ? 'purple' : 'yellow'}
                size="sm"
                onClick={() => onOpenNode(item.map, item.node)}
              />
            ))}
          </div>
        ) : (
          <p className="muted small">Everything is verified or intentionally planned.</p>
        )}
      </section>

      <section>
        <h3>Unmapped files ({coverage.unmapped.length})</h3>
        <div className="unmapped-list">
          <List density="compact" hasDividers>
            {coverage.unmapped.slice(0, 120).map((file) => (
              <ListItem
                key={file}
                label={<code>{file}</code>}
                endContent={<Button label="Copy prompt" variant="secondary" size="sm" onClick={() => onCopy(promptForFile(file), 'Prompt copied')} />}
              />
            ))}
          </List>
        </div>
      </section>
    </div>
  );
}

export function ProblemsPanel({ report, onOpenIssue, onRunCheck }: { report: CheckReport | null; onOpenIssue: (issue: Issue) => void; onRunCheck: () => void }): React.ReactElement {
  if (!report) return <Spinner label="Validating" />;
  const issues = [...report.errors, ...report.warnings];
  return (
    <div className="problems-panel">
      <div className="problems-head">
        <div>
          <strong>
            {report.errors.length} errors, {report.warnings.length} warnings
          </strong>
          <span className="muted small">
            {report.stats.nodes} nodes, {report.stats.verified} verified
          </span>
        </div>
        <div>
          <Button label="Run check" variant="secondary" size="sm" onClick={onRunCheck} />
          <Button label="Copy JSON" variant="ghost" size="sm" onClick={() => void copyText(JSON.stringify(report, null, 2))} />
        </div>
      </div>
      {!issues.length ? (
        <p className="problems-empty">
          <Icon name="check" size={16} />
          No problems. Maps are valid and evidence resolves.
        </p>
      ) : null}
      <div className="issue-list">
        <List density="compact" hasDividers>
          {issues.map((issue) => (
            <ListItem
              key={`${issue.code}-${issue.file}-${issue.line}-${issue.message}`}
              onClick={() => onOpenIssue(issue)}
              startContent={<Badge tone={issue.severity === 'error' ? 'error' : 'warn'}>{issue.code}</Badge>}
              label={<strong>{issue.message}</strong>}
              description={
                <span className="muted small">
                  {issueLocation(issue)}
                  {issue.hint ? ` · ${issue.hint}` : ''}
                </span>
              }
            />
          ))}
        </List>
      </div>
    </div>
  );
}

export function ActivityPanel({ changes, onOpenMap }: { changes: ChangeEntry[]; onOpenMap: (id: string) => void }): React.ReactElement {
  return (
    <div className="activity-panel">
      {!changes.length ? <p className="muted small">No activity yet.</p> : null}
      {changes.map((change) => (
        <div key={change.id} className="activity-row">
          <span className="activity-dot" />
          <div>
            <strong>{change.title}</strong>
            <span className="muted">
              {relativeTime(change.date)} · {change.author}
            </span>
          </div>
          <div className="activity-maps">
            {change.maps.slice(0, 2).map((map) => (
              <Token key={map} label={map} color="blue" size="sm" onClick={() => onOpenMap(map)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
