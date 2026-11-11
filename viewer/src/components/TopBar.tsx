import React from 'react';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import type { CheckReport, MapSummary, ViewerTab } from '@core/types';
import type { MapDetail, ProjectInfo } from '../api';
import { classNames } from '../util';

const TABS: Array<{ id: ViewerTab; label: string; key: string }> = [
  { id: 'maps', label: 'Maps', key: 'M' },
  { id: 'changes', label: 'Changes', key: 'C' },
  { id: 'timeline', label: 'Timeline', key: 'T' },
  { id: 'phases', label: 'Phases', key: 'P' },
  { id: 'notes', label: 'Notes', key: 'N' },
  { id: 'coverage', label: 'Coverage', key: 'V' },
];

export function TopBar({
  project,
  detail,
  summary,
  check,
  tab,
  onTab,
  mode,
  onMode,
  beginner,
  onBeginner,
  live,
  problemsOpen,
  onProblems,
  onSearch,
  onSettings,
  onHelp,
  onExport,
  onRefresh,
}: {
  project: ProjectInfo | null;
  detail: MapDetail | null;
  summary: MapSummary | undefined;
  check: CheckReport | null;
  tab: ViewerTab;
  onTab: (tab: ViewerTab) => void;
  mode: 'view' | 'edit';
  onMode: (mode: 'view' | 'edit') => void;
  beginner: boolean;
  onBeginner: (value: boolean) => void;
  live: 'connecting' | 'live' | 'offline';
  problemsOpen: boolean;
  onProblems: () => void;
  onSearch: () => void;
  onSettings: () => void;
  onHelp: () => void;
  onExport: (format: string) => void;
  onRefresh: () => void;
}): React.ReactElement {
  const errors = check?.errors.length ?? 0;
  const warnings = check?.warnings.length ?? 0;
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <div className="logo" aria-hidden="true">
          VM
        </div>
        <div className="brand-copy">
          <strong>{project?.name ?? 'VibeMap'}</strong>
          <span className="muted">
            {detail ? (
              <>
                {detail.id}
                {summary ? ` · ${summary.nodeCount} nodes` : ''}
              </>
            ) : (
              'visual project memory'
            )}
          </span>
        </div>
      </div>
      <nav className="tabs" aria-label="Viewer sections">
        {TABS.map((item) => (
          <button key={item.id} type="button" className={classNames('tab', tab === item.id && 'active')} onClick={() => onTab(item.id)} title={`${item.label} (G then ${item.key})`}>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="topbar-actions">
        <IconButton label="Search (Ctrl/Cmd+K)" tooltip="Search (Ctrl/Cmd+K)" icon={<span aria-hidden="true">⌕</span>} variant="ghost" size="sm" onClick={onSearch} />
        <button type="button" className={classNames('check-pill', errors ? 'has-errors' : warnings ? 'has-warnings' : 'is-ok')} onClick={onProblems} title="Validation problems">
          {errors ? `${errors} error${errors === 1 ? '' : 's'}` : warnings ? `${warnings} warning${warnings === 1 ? '' : 's'}` : 'check ok'}
          {problemsOpen ? ' ▾' : ' ▸'}
        </button>
        <span className={`live-dot live-${live}`} title={live === 'live' ? 'Live updates connected' : live === 'connecting' ? 'Connecting…' : 'Disconnected'} />
        <button type="button" className={classNames('chip', beginner && 'active')} onClick={() => onBeginner(!beginner)} title="Beginner mode (B)">
          Beginner
        </button>
        <div className="segmented" role="group" aria-label="Mode">
          <button type="button" className={mode === 'view' ? 'active' : ''} onClick={() => onMode('view')}>
            View
          </button>
          <button type="button" className={mode === 'edit' ? 'active' : ''} onClick={() => onMode('edit')} title="Edit mode (E)">
            Edit
          </button>
        </div>
        <div className="menu-wrap">
          <IconButton label="Export menu" tooltip="Export" icon={<span aria-hidden="true">⇩</span>} variant="ghost" size="sm" />
          <div className="menu">
            <Button label="Export SVG" variant="ghost" size="sm" onClick={() => onExport('svg')} />
            <Button label="Export Mermaid" variant="ghost" size="sm" onClick={() => onExport('mermaid')} />
            <Button label="Export Markdown" variant="ghost" size="sm" onClick={() => onExport('md')} />
            <Button label="Export Excalidraw" variant="ghost" size="sm" onClick={() => onExport('excalidraw')} />
          </div>
        </div>
        <IconButton label="Refresh" tooltip="Refresh from disk" icon={<span aria-hidden="true">↻</span>} variant="ghost" size="sm" onClick={onRefresh} />
        <IconButton label="Help" tooltip="Keyboard shortcuts (?)" icon={<span aria-hidden="true">?</span>} variant="ghost" size="sm" onClick={onHelp} />
        <IconButton label="Settings" tooltip="Settings" icon={<span aria-hidden="true">⚙</span>} variant="ghost" size="sm" onClick={onSettings} />
      </div>
    </header>
  );
}
