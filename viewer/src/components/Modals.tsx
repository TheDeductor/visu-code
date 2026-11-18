import React, { useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { CommandPalette } from '@astryxdesign/core/CommandPalette';
import { Table, TableBody, TableRow, TableCell } from '@astryxdesign/core/Table';
import type { SearchSource, SearchableItem } from '@astryxdesign/core/Typeahead';
import type { NodeKind, NodeStatus, ProjectConfig } from '@core/types';
import { EDGE_KINDS, NODE_KINDS, NODE_STATUSES } from '@core/types';
import { api, type ProjectInfo, type SearchResult } from '../api';
import { Modal, Badge } from './ui';
import { copyText } from '../util';

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
          <Button label="Cancel" variant="ghost" onClick={onClose} />
          <Button
            label={busy ? 'Creating' : 'Create map'}
            variant="primary"
            isDisabled={!valid || busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              void onCreate({ id, title: title || id, type, level })
                .then(onClose)
                .catch((err) => setError((err as Error).message))
                .finally(() => setBusy(false));
            }}
          />
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
      subtitle="Human-added nodes start as planned and have no refs until you or an agent verify them."
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onClick={onClose} />
          <Button
            label={busy ? 'Adding' : 'Add node'}
            variant="primary"
            isDisabled={!label.trim() || busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              void onCreate({ label: label.trim(), kind, status, description: description.trim() || undefined })
                .then(onClose)
                .catch((err) => setError((err as Error).message))
                .finally(() => setBusy(false));
            }}
          />
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
        <span>Description</span>
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
      subtitle={`${from} to ${to}`}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onClick={onClose} />
          <Button
            label={busy ? 'Connecting' : 'Add edge'}
            variant="primary"
            isDisabled={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              void onCreate({ from, to, label: label.trim() || undefined, kind })
                .then(onClose)
                .catch((err) => setError((err as Error).message))
                .finally(() => setBusy(false));
            }}
          />
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

export function StickyModal({ onClose, onCreate }: { onClose: () => void; onCreate: (text: string) => Promise<void> }): React.ReactElement {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title="Add sticky note"
      subtitle="Sticky notes live in the human-owned layout file. Agents never touch them."
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onClick={onClose} />
          <Button
            label={busy ? 'Adding' : 'Add note'}
            variant="primary"
            isDisabled={!text.trim() || busy}
            onClick={() => {
              setBusy(true);
              void onCreate(text.trim()).then(onClose).finally(() => setBusy(false));
            }}
          />
        </>
      }
    >
      <label className="field">
        <span>Text</span>
        <textarea autoFocus rows={4} value={text} onChange={(event) => setText(event.target.value)} placeholder="This is where the confusing part starts." />
      </label>
    </Modal>
  );
}

export function SettingsModal({
  project,
  onClose,
  onSave,
  themeMode,
  onThemeChange,
}: {
  project: ProjectInfo;
  onClose: () => void;
  onSave: (body: { mode?: string; granularity?: string }) => Promise<void>;
  themeMode?: 'light' | 'dark';
  onThemeChange?: (mode: 'light' | 'dark') => void;
}): React.ReactElement {
  const [mode, setMode] = useState<ProjectConfig['tracking']['mode']>(project.config.tracking.mode);
  const [granularity, setGranularity] = useState<ProjectConfig['tracking']['granularity']>(project.config.tracking.granularity);
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title="Settings"
      subtitle="Changes are written to .vibemap/config.yaml and the agent guide is regenerated."
      onClose={onClose}
      footer={
        <>
          <Button label="Close" variant="ghost" onClick={onClose} />
          <Button
            label={busy ? 'Saving' : 'Save'}
            variant="primary"
            isDisabled={busy}
            onClick={() => {
              setBusy(true);
              void onSave({ mode, granularity }).finally(() => {
                setBusy(false);
                onClose();
              });
            }}
          />
        </>
      }
    >
      <div className="settings-section">
        <h3>Tracking</h3>
        <div className="field-row">
          <Selector
            label="Mode"
            value={mode}
            onChange={(val) => setMode(val as ProjectConfig['tracking']['mode'])}
            options={[
              { value: 'every-change', label: 'every change' },
              { value: 'per-phase', label: 'per phase' },
              { value: 'manual', label: 'manual' },
              { value: 'off', label: 'off' },
            ]}
          />
          <Selector
            label="Granularity"
            value={granularity}
            onChange={(val) => setGranularity(val as ProjectConfig['tracking']['granularity'])}
            options={[
              { value: 'overview', label: 'overview' },
              { value: 'feature', label: 'feature' },
              { value: 'detail', label: 'detail' },
            ]}
          />
        </div>
        <p className="muted small">Saving rewrites the agent guide. Hooks remind agents to update maps.</p>
      </div>

      <div className="settings-section">
        <h3>Agents</h3>
        <div className="chip-list">
          {project.config.agents.map((agent) => (
            <Badge key={agent} tone="info">
              {agent}
            </Badge>
          ))}
          {!project.config.agents.length ? <span className="muted small">None configured.</span> : null}
        </div>
        <p className="muted small">
          Run <code>vibemap agents sync</code> to rewrite rules files.
        </p>
      </div>

      <div className="settings-section">
        <h3>Appearance</h3>
        {onThemeChange ? (
          <div className="settings-row">
            <Selector
              label="Interface theme"
              value={themeMode ?? 'light'}
              onChange={(val) => onThemeChange(val as 'light' | 'dark')}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </div>
        ) : null}
        <div className="kv">
          <span>Diagram font</span>
          <strong>{project.theme.font}</strong>
        </div>
        <div className="kv">
          <span>Node gap</span>
          <strong>{project.theme.gap}px</strong>
        </div>
        <p className="muted small">Edit .vibemap/theme.yaml to customise the diagram. The viewer reloads it live.</p>
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
          <code>
            {project.server.host}:{project.server.port}
          </code>
        </div>
        <p className="muted small">Local only. No network calls except this localhost server.</p>
      </div>
    </Modal>
  );
}

export function ShortcutsModal({ onClose }: { onClose: () => void }): React.ReactElement {
  const rows = [
    ['Ctrl or Cmd + K', 'Search maps, nodes, changes and notes'],
    ['G then M / C / T / P / N / V', 'Switch section'],
    ['E', 'Toggle edit mode'],
    ['B', 'Toggle beginner mode'],
    ['F', 'Fit diagram to the screen'],
    ['[ or ]', 'Previous or next changed node'],
    ['Space', 'Play or pause a walkthrough'],
    ['Left or right arrow', 'Step a walkthrough'],
    ['Esc', 'Clear selection or close'],
    ['?', 'This dialog'],
  ];
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose}>
      <Table>
        <TableBody>
          {rows.map(([key, action]) => (
            <TableRow key={key}>
              <TableCell style={{ width: '160px' }}>
                <kbd>{key}</kbd>
              </TableCell>
              <TableCell>{action}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Modal>
  );
}

export function TourModal({ onClose }: { onClose: () => void }): React.ReactElement {
  const [step, setStep] = useState(0);
  const steps = [
    ['Your map list', 'Every folder under .vibemap/maps appears in the left panel. A red badge means validation errors, a blue dot means code drifted since the map was updated.'],
    ['The canvas', 'The agent describes nodes and edges; VisuCode computes the layout. Dashed nodes are declared but not yet verifiable.'],
    ['The inspector', 'Select a node to see its code refs, evidence and connections. Edit mode lets you change labels, pin positions and lock a node.'],
    ['Changes and timeline', 'The Changes tab explains what changed and why. Timeline lets you look at any commit or local snapshot.'],
    ['Coverage', 'Coverage shows which code is not mapped yet. Copy a prompt into your agent to close the gap.'],
  ];
  const current = steps[step]!;
  return (
    <Modal
      title="Welcome to VisuCode"
      onClose={onClose}
      footer={
        <>
          <Button label="Skip" variant="ghost" onClick={onClose} />
          {step > 0 ? <Button label="Back" variant="ghost" onClick={() => setStep(step - 1)} /> : null}
          <Button label={step === steps.length - 1 ? 'Start mapping' : 'Next'} variant="primary" onClick={() => (step === steps.length - 1 ? onClose() : setStep(step + 1))} />
        </>
      }
    >
      <div className="tour-step">
        <span className="tour-step-count">
          Step {step + 1} of {steps.length}
        </span>
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
      subtitle="Copy this into your coding agent. It points at the canonical guide."
      onClose={onClose}
      wide
      footer={
        <>
          <Button label="Close" variant="ghost" onClick={onClose} />
          <Button
            label="Copy prompt"
            variant="secondary"
            size="sm"
            onClick={() => {
              void copyText(prompt).then(onCopied);
            }}
          />
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
  const itemsMap = useRef<Map<string, SearchResult>>(new Map());

  const searchSource = useMemo<SearchSource<SearchableItem<SearchResult>>>(
    () => ({
      search: async (query: string) => {
        if (!query.trim()) return [];
        try {
          const value = await api.search(query);
          return value.results.map((result) => {
            const id = `${result.type}-${result.id}`;
            itemsMap.current.set(id, result);
            return {
              id,
              label: result.label,
              auxiliaryData: result,
            };
          });
        } catch {
          return [];
        }
      },
      bootstrap: () => [],
    }),
    [],
  );

  return (
    <CommandPalette
      isOpen={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      searchSource={searchSource}
      onValueChange={(val) => {
        const result = itemsMap.current.get(val);
        if (result) {
          onPick(result);
          onClose();
        }
      }}
      label="Search"
      emptySearchText="No matches."
      emptyBootstrapText="Type to search maps, nodes, changes and notes."
      width={640}
      renderItem={(item) => (
        <div className="search-result">
          <Badge tone={item.auxiliaryData?.type === 'node' ? 'info' : item.auxiliaryData?.type === 'change' ? 'ok' : 'neutral'}>{item.auxiliaryData?.type ?? 'item'}</Badge>
          <span className="search-result-label">{item.label}</span>
          <span className="muted small">{item.auxiliaryData?.map ?? item.auxiliaryData?.id}</span>
        </div>
      )}
    />
  );
}
