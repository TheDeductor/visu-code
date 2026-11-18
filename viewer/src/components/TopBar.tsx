import React from 'react';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Popover } from '@astryxdesign/core/Popover';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Switch } from '@astryxdesign/core/Switch';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import type { CheckReport, MapSummary, ViewerTab } from '@core/types';
import type { MapDetail, ProjectInfo } from '../api';
import { classNames } from '../util';
import { Icon, VisuCodeMark } from './icons';

const TABS: Array<{ id: ViewerTab; label: string }> = [
  { id: 'maps', label: 'Maps' },
  { id: 'changes', label: 'Changes' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'phases', label: 'Phases' },
  { id: 'notes', label: 'Notes' },
  { id: 'coverage', label: 'Coverage' },
];

const EXPORTS: Array<{ format: string; label: string }> = [
  { format: 'svg', label: 'SVG' },
  { format: 'mermaid', label: 'Mermaid' },
  { format: 'md', label: 'Markdown' },
  { format: 'excalidraw', label: 'Excalidraw' },
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
  onMenu,
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
  onMenu: () => void;
}): React.ReactElement {
  const errors = check?.errors.length ?? 0;
  const warnings = check?.warnings.length ?? 0;
  const statusLabel = errors ? `${errors} error${errors === 1 ? '' : 's'}` : warnings ? `${warnings} warning${warnings === 1 ? '' : 's'}` : 'All checks pass';
  const statusTone = errors ? 'has-errors' : warnings ? 'has-warnings' : 'is-ok';

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <IconButton className="only-mobile" label="Open map list" tooltip="Open map list" icon={<Icon name="menu" />} variant="ghost" size="sm" onClick={onMenu} />
        <span className="brand-mark">
          <VisuCodeMark height={20} />
        </span>
        <div className="brand-copy">
          <strong>{project?.name ?? 'VisuCode'}</strong>
          <span>{detail ? `${detail.id}${summary ? ` · ${summary.nodeCount} nodes` : ''}` : 'Visual project memory'}</span>
        </div>
      </div>

      <div className="topbar-tabs">
        <TabList value={tab} onChange={(val) => onTab(val as ViewerTab)} size="sm">
          {TABS.map((item) => (
            <Tab key={item.id} value={item.id} label={item.label} />
          ))}
        </TabList>
      </div>

      <div className="topbar-actions">
        <IconButton label="Search" tooltip="Search (Ctrl or Cmd + K)" icon={<Icon name="search" />} variant="ghost" size="sm" onClick={onSearch} />

        <Popover
          label="Validation status"
          placement="below"
          alignment="end"
          content={
            <div className="popover-menu">
              <div className="popover-title">
                {errors ? `${errors} error${errors === 1 ? '' : 's'}` : warnings ? `${warnings} warning${warnings === 1 ? '' : 's'}` : 'All checks pass'}
              </div>
              <Button label="View problems" size="sm" variant="secondary" onClick={onProblems} />
            </div>
          }
        >
          <button type="button" className={classNames('status-chip', statusTone)} aria-expanded={problemsOpen}>
            <Icon name={errors || warnings ? 'alert' : 'check'} size={14} />
            <span>{statusLabel}</span>
            <Icon name="chevronDown" size={14} />
          </button>
        </Popover>

        <span className={classNames('conn-state', 'hide-small', live === 'offline' && 'is-offline')} aria-live="polite">
          {live === 'live' ? 'Live' : live === 'connecting' ? 'Connecting' : 'Offline'}
        </span>

        <span className="hide-small">
          <Switch label="Beginner" value={beginner} onChange={(val) => onBeginner(val)} size="sm" />
        </span>

        <SegmentedControl label="Mode" value={mode} onChange={(val) => onMode(val as 'view' | 'edit')} size="sm">
          <SegmentedControlItem value="view" label="View" />
          <SegmentedControlItem value="edit" label="Edit" />
        </SegmentedControl>

        <Popover
          label="Export diagram"
          placement="below"
          alignment="end"
          content={
            <div className="popover-menu">
              {EXPORTS.map((item) => (
                <Button key={item.format} label={item.label} variant="ghost" size="sm" onClick={() => onExport(item.format)} />
              ))}
            </div>
          }
        >
          <IconButton className="hide-small" label="Export diagram" tooltip="Export" icon={<Icon name="download" />} variant="ghost" size="sm" />
        </Popover>

        <IconButton className="hide-small" label="Refresh from disk" tooltip="Refresh from disk" icon={<Icon name="refresh" />} variant="ghost" size="sm" onClick={onRefresh} />
        <IconButton className="hide-small" label="Keyboard shortcuts" tooltip="Keyboard shortcuts (?)" icon={<Icon name="help" />} variant="ghost" size="sm" onClick={onHelp} />
        <IconButton label="Settings" tooltip="Settings" icon={<Icon name="settings" />} variant="ghost" size="sm" onClick={onSettings} />
      </div>
    </header>
  );
}
