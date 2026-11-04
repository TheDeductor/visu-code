import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { NodeKind, NodeStatus, ProjectConfig } from '@core/types';
import { EDGE_KINDS, NODE_KINDS, NODE_STATUSES } from '@core/types';
import { api, type ProjectInfo, type SearchResult } from '../api';
import { Modal, Badge, Spinner } from './ui';
import { classNames, copyText } from '../util';

export function NewMapModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (body: { id: string; title: string; type: string; level: string }) => Promise<void>;
}): React.ReactElement {
  const [id, setId] = useState('feature/new-flow');
  const [title, setTitle] = useState('New flow');
  const [type, setType] = useState('graph');
  const [level, setLevel] = useState('feature');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = /^[a-z0-9][a-z0-9/_-]*$/.test(id) && !id.includes('..');
  return (
    <Modal
      title="New map"
      subtitle="Create a small map. Keep it to one feature or flow."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn subtle" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!valid || busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              void onCreate({ id, title: title || id, type, level })
                .then(onClose)
                .catch((err) => setError((err as Error).message))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? 'Creating…' : 'Create map'}
          </button>
        </>
      }
    >
      <label className="field">
        <span>Map id</span>
        <input value={id} onChange={(event) => setId(event.target.value)} placeholder="auth/login-flow" />
        <small className={valid ? 'muted' : 'inline-error'}>{valid ? 'Lowercase, kebab-case, folders allowed.' : 'Use lowercase letters, numbers, -, _ and /.'}</small>
      </label>
      <label className="field">
        <span>Title</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Type</span>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="graph">Graph</option>
            <option value="sequence">Sequence</option>
            <option value="erd">ERD</option>
            <option value="mermaid">Mermaid</option>
          </select>
        </label>
        <label className="field">
          <span>Level</span>
          <select value={level} onChange={(event) => setLevel(event.target.value)}>
            <option value="overview">Overview</option>
            <option value="feature">Feature</option>
            <option value="detail">Detail</option>
          </select>
        </label>
      </div>
      {error ? <p className="inline-error">{error}</p> : null}
    </Modal>
  );
}

export function AddNodeModal({
  startConnect,
  onClose,
  onCreate,
}: {
  startConnect?: string | null;
  onClose: () => void;
  onCreate: (node: { label: string; kind: NodeKind; status: NodeStatus; description?: string }) => Promise<void>;
}): React.ReactElement {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<NodeKind>('component');
  const [status, setStatus] = useState<NodeStatus>('planned');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      title={startConnect ? `Connect from ${startConnect}` : 'Add a node'}
      subtitle="Human-added nodes start planned and have no refs until you or an agent verify them."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn subtle" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!label.trim() || busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              void onCreate({ label: label.trim(), kind, status, description: description.trim() || undefined })
                .then(onClose)
                .catch((err) => setError((err as Error).message))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? 'Adding…' : 'Add node'}
          </button>
        </>
      }
    >
      <label className="field">
        <span>Label</span>
        <input autoFocus value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Session store" />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Kind</span>
          <select value={kind} onChange={(event) => setKind(event.target.value as NodeKind)}>
            {NODE_KINDS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as NodeStatus)}>
            {NODE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Description (optional)</span>
        <textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      {error ? <p className="inline-error">{error}</p> : null}
    </Modal>
  );
}

export function EdgeModal({
  from,
  to,
  onClose,
  onCreate,
}: {
  from: string;
  to: string;
  onClose: () => void;
  onCreate: (edge: { from: string; to: string; label?: string; kind: string }) => Promise<void>;
}): React.ReactElement {
  const [kind, setKind] = useState('flow');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      title="Connect nodes"
      subtitle={`${from} → ${to}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn subtle" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              void onCreate({ from, to, label: label.trim() || undefined, kind })
                .then(onClose)
                .catch((err) => setError((err as Error).message))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? 'Connecting…' : 'Add edge'}
          </button>
        </>
      }
    >
      <div className="field-row">
        <label className="field">
          <span>Kind</span>
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            {EDGE_KINDS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Label</span>
          <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="calls" />
        </label>
      </div>
      {error ? <p className="inline-error">{error}</p> : null}
    </Modal>
  );
}

export function StickyModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (text: string) => Promise<void>;
}): React.ReactElement {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title="Add sticky note"
      subtitle="Sticky notes live in the human-owned layout sidecar. Agents never touch them."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn subtle" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!text.trim() || busy}
            onClick={() => {
              setBusy(true);
              void onCreate(text.trim()).then(onClose).finally(() => setBusy(false));
            }}
          >
            {busy ? 'Adding…' : 'Add note'}
          </button>
        </>
      }
    >
      <label className="field">
        <span>Text</span>
        <textarea autoFocus rows={4} value={text} onChange={(event) => setText(event.target.value)} placeholder="This is where the confusing part starts…" />
      </label>
    </Modal>
  );
}

export function SettingsModal({
  project,
  onClose,
  onSave,
}: {
  project: ProjectInfo;
  onClose: () => void;
  onSave: (body: { mode?: string; granularity?: string }) => Promise<void>;
}): React.ReactElement {
  const [mode, setMode] = useState<ProjectConfig['tracking']['mode']>(project.config.tracking.mode);
  const [granularity, setGranularity] = useState<ProjectConfig['tracking']['granularity']>(project.config.tracking.granularity);
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title="Settings"
      subtitle="Changes are written to .vibemap/config.yaml and rules files are regenerated."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn subtle" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void onSave({ mode, granularity }).finally(() => {
                setBusy(false);
                onClose();
              });
            }}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="settings-section">
        <h3>Tracking</h3>
        <div className="field-row">
          <label className="field">
            <span>Mode</span>
            <select value={mode} onChange={(event) => setMode(event.target.value as ProjectConfig['tracking']['mode'])}>
              <option value="every-change">every-change</option>
              <option value="per-phase">per-phase</option>
              <option value="manual">manual</option>
              <option value="off">off</option>
            </select>
          </label>
          <label className="field">
            <span>Granularity</span>
            <select value={granularity} onChange={(event) => setGranularity(event.target.value as ProjectConfig['tracking']['granularity'])}>
              <option value="overview">overview</option>
              <option value="feature">feature</option>
              <option value="detail">detail</option>
            </select>
          </label>
        </div>
        <p className="muted small">The agent guide is rewritten when you save. Hooks remind agents to update maps.</p>
      </div>
      <div className="settings-section">
        <h3>Agents</h3>
        <div className="chip-list">
          {project.config.agents.map((agent) => (
            <Badge key={agent} tone="info">
              {agent}
            </Badge>
          ))}
          {!project.config.agents.length ? <span className="muted">None configured.</span> : null}
        </div>
        <p className="muted small">Run <code>vibemap agents sync</code> to rewrite rules files.</p>
      </div>
      <div className="settings-section">
        <h3>Theme</h3>
        <div className="kv">
          <span>Font</span>
          <strong>{project.theme.font}</strong>
        </div>
        <div className="kv">
          <span>Roughness</span>
          <strong>{project.theme.roughness}</strong>
        </div>
        <div className="kv">
          <span>Gap</span>
          <strong>{project.theme.gap}px</strong>
        </div>
        <p className="muted small">Edit .vibemap/theme.yaml to customise; the viewer reloads it live.</p>
      </div>
      <div className="settings-section">
        <h3>Privacy</h3>
        <div className="kv">
          <span>LLM</span>
          <strong>{project.config.privacy.llm}</strong>
        </div>
        <div className="kv">
          <span>Telemetry</span>
          <strong>{project.config.privacy.telemetry ? 'on' : 'off'}</strong>
        </div>
        <div className="kv">
          <span>Server</span>
          <code>{project.server.host}:{project.server.port}</code>
        </div>
        <p className="muted small">Local-only. No network calls except this localhost server.</p>
      </div>
    </Modal>
  );
}

export function ShortcutsModal({ onClose }: { onClose: () => void }): React.ReactElement {
  const rows = [
    ['Ctrl / ⌘ + K', 'Search maps, nodes, changes and notes'],
    ['G then M / C / T / P / N / V', 'Switch sections'],
    ['E', 'Toggle edit mode'],
    ['B', 'Toggle beginner mode'],
    ['F', 'Fit canvas to screen'],
    ['[ / ]', 'Previous / next diff change'],
    ['Space', 'Play / pause walkthrough'],
    ['← / →', 'Step walkthrough'],
    ['Esc', 'Clear selection / close'],
    ['?', 'This dialog'],
  ];
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose}>
      <table className="shortcut-table">
        <tbody>
          {rows.map(([key, action]) => (
            <tr key={key}>
              <td>
                <kbd>{key}</kbd>
              </td>
              <td>{action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

export function TourModal({ onClose }: { onClose: () => void }): React.ReactElement {
  const [step, setStep] = useState(0);
  const steps = [
    ['Your map tree', 'Every folder under .vibemap/maps/ appears here. Red badges mean validation errors; a blue dot means drift is pending.'],
    ['The canvas', 'The agent describes nodes and edges; VibeMap computes the layout, shapes and colours. Dashed nodes are declared but not verifiable.'],
    ['The inspector', 'Click a node to see its code refs, evidence and connections. In Edit mode you can change labels, pin positions and lock a node.'],
    ['History and changes', 'The Changes tab explains what changed and why. Timeline lets you scrub every commit and local snapshot.'],
    ['Coverage', 'Coverage shows which code is still unmapped. Copy a prompt into your agent to close the gap.'],
  ];
  const current = steps[step]!;
  return (
    <Modal
      title={`Welcome to VibeMap — ${step + 1}/${steps.length}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn subtle" onClick={onClose}>
            Skip
          </button>
          {step > 0 ? (
            <button type="button" className="btn subtle" onClick={() => setStep(step - 1)}>
              Back
            </button>
          ) : null}
          <button type="button" className="btn primary" onClick={() => (step === steps.length - 1 ? onClose() : setStep(step + 1))}>
            {step === steps.length - 1 ? 'Start mapping' : 'Next'}
          </button>
        </>
      }
    >
      <div className="tour-step">
        <span className="eyebrow">Step {step + 1}</span>
        <h3>{current[0]}</h3>
        <p>{current[1]}</p>
      </div>
    </Modal>
  );
}

export function PromptModal({
  title,
  prompt,
  onClose,
  onCopied,
}: {
  title: string;
  prompt: string;
  onClose: () => void;
  onCopied: () => void;
}): React.ReactElement {
  return (
    <Modal
      title={title}
      subtitle="Copy this into your coding agent. It is self-contained but points at the canonical guide."
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn subtle" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              void copyText(prompt).then(onCopied);
            }}
          >
            Copy prompt
          </button>
        </>
      }
    >
      <pre className="prompt-preview">{prompt}</pre>
    </Modal>
  );
}

export function SearchModal({
  initial,
  onClose,
  onPick,
}: {
  initial: string;
  onClose: () => void;
  onPick: (result: SearchResult) => void;
}): React.ReactElement {
  const [query, setQuery] = useState(initial);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    timer.current = window.setTimeout(() => {
      setLoading(true);
      api
        .search(query)
        .then((value) => {
          setResults(value.results);
          setActive(0);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 140);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [query]);

  return (
    <Modal title="Search" onClose={onClose} wide>
      <input
        autoFocus
        className="search-big"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((index) => Math.min(results.length - 1, index + 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((index) => Math.max(0, index - 1));
          } else if (event.key === 'Enter' && results[active]) {
            onPick(results[active]!);
          }
        }}
        placeholder="Search maps, nodes, changes, notes…"
      />
      <div className="search-results">
        {loading ? <Spinner label="Searching…" /> : null}
        {!loading && query && !results.length ? <p className="muted">No matches.</p> : null}
        {results.map((result, index) => (
          <button key={`${result.type}-${result.id}`} type="button" className={classNames('search-result', active === index && 'active')} onClick={() => onPick(result)} onMouseEnter={() => setActive(index)}>
            <Badge tone={result.type === 'node' ? 'info' : result.type === 'change' ? 'ok' : 'neutral'}>{result.type}</Badge>
            <span>{result.label}</span>
            <span className="muted">{result.map ?? result.id}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
