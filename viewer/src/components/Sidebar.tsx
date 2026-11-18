import React, { useMemo } from 'react';
import { IconButton } from '@astryxdesign/core/IconButton';
import { TextInput } from '@astryxdesign/core/TextInput';
import type { MapSummary } from '@core/types';
import { ProgressBar } from './ui';
import { classNames, mapFolder, mapLeaf } from '../util';
import { Icon, mapTypeIcon } from './icons';

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
  onCollapse,
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
  onCollapse?: () => void;
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
        <TextInput label="Filter maps" isLabelHidden value={filter} onChange={(val) => onFilter(val)} placeholder="Filter maps" hasClear size="sm" />
        <IconButton label="New map" tooltip="New map" icon={<Icon name="plus" />} variant="ghost" size="sm" onClick={onNewMap} />
        {onCollapse ? (
          <IconButton label="Collapse map list" tooltip="Collapse map list" icon={<Icon name="panelLeftClose" />} variant="ghost" size="sm" onClick={onCollapse} />
        ) : null}
      </div>

      <div className="map-tree" role="tree" aria-label="Maps">
        {groups.map(([folder, items]) => (
          <div key={folder || '(root)'} className="map-group" role="group" aria-label={folder || 'Maps'}>
            <div className="group-label">{folder || 'maps'}</div>
            {items.map((map) => {
              const active = selectedId === map.id;
              return (
                <button
                  key={map.id}
                  type="button"
                  role="treeitem"
                  aria-level={1}
                  aria-selected={active}
                  className={classNames('map-row', active && 'active')}
                  onClick={() => onSelect(map.id)}
                  title={map.summary ?? map.title}
                >
                  <span className="map-icon" aria-hidden="true">
                    <Icon name={mapTypeIcon(map.type, map.level)} size={16} />
                  </span>
                  <span className="map-copy">
                    <span className="map-title">
                      {mapLeaf(map.id)}
                      {map.stale ? <span className="stale-dot" title="Invalid file, showing the last good version" /> : null}
                    </span>
                    <span className="map-meta">
                      {map.type !== 'graph' ? `${map.type} · ` : ''}
                      {map.nodeCount} nodes
                      {map.drift ? <span className="drift-dot" title="Code changed since this map was updated" /> : null}
                    </span>
                  </span>
                  <span className="map-badges">
                    {map.errors ? <span className="count-badge is-error" title={`${map.errors} validation errors`}>{map.errors}</span> : null}
                    {!map.errors && map.warnings ? <span className="count-badge" title={`${map.warnings} warnings`}>{map.warnings}</span> : null}
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
              <button type="button" className="ghost-link" onClick={onBootstrap}>
                Copy agent prompt
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="sidebar-foot">
        <div className="coverage-mini">
          <div className="coverage-mini-head">
            <span>Coverage</span>
            <strong>{coverage === undefined ? 'n/a' : `${coverage}%`}</strong>
          </div>
          <ProgressBar percent={coverage ?? 0} tone="info" />
        </div>
        <button type="button" className="ghost-link" onClick={onBootstrap}>
          Copy agent prompt
        </button>
        <span className="version">VisuCode {version ?? ''}</span>
      </div>
    </aside>
  );
}
