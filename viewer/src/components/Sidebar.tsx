import React, { useMemo } from 'react';
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
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input value={filter} onChange={(event) => onFilter(event.target.value)} placeholder="Filter maps…" aria-label="Filter maps" />
          {filter ? (
            <button type="button" onClick={() => onFilter('')} aria-label="Clear filter">
              ×
            </button>
          ) : null}
        </label>
        <button type="button" className="icon-btn" onClick={onNewMap} title="New map" aria-label="New map">
          +
        </button>
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
