import React, { useMemo } from 'react';
import { IconButton } from '@astryxdesign/core/IconButton';
import { TextInput } from '@astryxdesign/core/TextInput';
import type { MapSummary } from '@core/types';
import { Badge } from './ui';
import { classNames, mapFolder, mapIcon, mapLeaf } from '../util';

export function Sidebar({
  maps,
  selectedId,
  onSelect,
  filter,
  onFilter,
  coverage,
  onNewMap,
  onBootstrap,
  version,
}: {
  maps: MapSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filter: string;
  onFilter: (value: string) => void;
  coverage: number | undefined;
  onNewMap: () => void;
  onBootstrap: () => void;
  version?: string;
}): React.ReactElement {
  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return maps;
    return maps.filter((map) => `${map.id} ${map.title} ${map.summary ?? ''}`.toLowerCase().includes(needle));
  }, [maps, filter]);
  const groups = useMemo(() => {
    const map = new Map<string, MapSummary[]>();
    for (const item of filtered) {
      const folder = mapFolder(item.id);
      const bucket = map.get(folder) ?? [];
      bucket.push(item);
      map.set(folder, bucket);
    }
    return [...map.entries()].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)));
  }, [filtered]);

  return (
    <aside className="sidebar" aria-label="Map navigator">
      <div className="sidebar-head">
        <TextInput label="Filter maps" isLabelHidden value={filter} onChange={(val) => onFilter(val)} placeholder="Filter maps…" hasClear size="sm" />
        <IconButton label="New map" tooltip="New map" icon={<span aria-hidden="true">+</span>} variant="ghost" size="sm" onClick={onNewMap} />
      </div>
      <div className="map-tree" role="tree">
        {groups.map(([folder, items]) => (
          <div key={folder || '(root)'} className="map-group">
            <div className="group-label">{folder || 'maps'}</div>
            {items.map((map) => {
              const active = selectedId === map.id;
              return (
                <button
                  key={map.id}
                  type="button"
                  role="treeitem"
                  aria-selected={active}
                  className={classNames('map-row', active && 'active')}
                  onClick={() => onSelect(map.id)}
                  title={map.summary ?? map.title}
                >
                  <span className="map-icon" aria-hidden="true">
                    {mapIcon(map)}
                  </span>
                  <span className="map-copy">
                    <span className="map-title">
                      {mapLeaf(map.id)}
                      {map.stale ? <span className="stale-dot" title="Invalid file; showing last good version" /> : null}
                    </span>
                    <span className="map-meta">
                      {map.type !== 'graph' ? `${map.type} · ` : ''}
                      {map.nodeCount} nodes
                      {map.drift ? <span className="drift-dot" title="Drift pending" /> : null}
                    </span>
                  </span>
                  <span className="map-badges">
                    {map.errors ? <Badge tone="error">{map.errors}</Badge> : null}
                    {!map.errors && map.warnings ? <Badge tone="warn">{map.warnings}</Badge> : null}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
        {!filtered.length ? (
          <div className="sidebar-empty">
            <p>{maps.length ? 'No maps match this filter.' : 'No maps yet.'}</p>
            {!maps.length ? (
              <button type="button" className="btn small" onClick={onBootstrap}>
                Bootstrap prompt
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="sidebar-foot">
        <div className="coverage-mini">
          <div className="coverage-mini-head">
            <span>Coverage</span>
            <strong>{coverage === undefined ? '—' : `${coverage}%`}</strong>
          </div>
          <div className="progress">
            <span className="progress-fill progress-info" style={{ width: `${coverage ?? 0}%` }} />
          </div>
        </div>
        <button type="button" className="ghost-link" onClick={onBootstrap}>
          Paste bootstrap prompt into an agent
        </button>
        <span className="version">VibeMap {version ?? ''}</span>
      </div>
    </aside>
  );
}
