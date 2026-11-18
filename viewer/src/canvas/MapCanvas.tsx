import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ErdLayout,
  GraphLayout,
  LayoutBox,
  LayoutEdge,
  LayoutResult,
  SequenceLayout,
  Theme,
  VibeAnnotation,
  VibeMap,
} from '@core/types';
import { shapeForKind, labelFontSize, wrapText } from '@core/theme';
import { layoutEdgePath } from '@core/geometry';
import { Button } from '@astryxdesign/core/Button';
import type { MapDetail } from '../api';
import { Icon } from '../components/icons';
import { fillForKindToken, strokeForEvidence } from './palette';

interface DragNode {
  id: string;
  startClientX: number;
  startClientY: number;
  box: LayoutBox;
  dx: number;
  dy: number;
}

interface DragAnnotation {
  id: string;
  startClientX: number;
  startClientY: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

interface CanvasProps {
  detail: MapDetail;
  layout: LayoutResult;
  mode: 'view' | 'edit';
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onMoveNode: (id: string, x: number, y: number, w: number, h: number) => void;
  onMoveAnnotation: (id: string, x: number, y: number) => void;
  onRemoveAnnotation?: (id: string) => void;
  connectMode: boolean;
  connectStart: string | null;
  onConnectNode: (id: string) => void;
  walkthroughFocus?: string[] | null;
  beginner: boolean;
  fitNonce: number;
  diff?: { states: Record<string, 'added' | 'removed' | 'modified'>; ghosts: LayoutBox[] } | null;
  readOnly?: boolean;
  onZoom?: (zoom: number) => void;
}

const NODE_RADIUS = 8;

function roundedRectPath(box: LayoutBox, radius = NODE_RADIUS): string {
  const { x, y, w, h } = box;
  const r = Math.min(radius, w / 2, h / 2);
  return `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
}

function NodeShape({
  box,
  shape,
  fill,
  stroke,
  dash,
  strokeWidth,
}: {
  box: LayoutBox;
  shape: string;
  fill: string;
  stroke: string;
  dash?: string;
  strokeWidth: number;
}): React.ReactElement {
  const common = {
    fill,
    stroke,
    strokeWidth,
    strokeDasharray: dash,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  };
  if (shape === 'ellipse') {
    return <ellipse cx={box.x + box.w / 2} cy={box.y + box.h / 2} rx={box.w / 2} ry={box.h / 2} {...common} />;
  }
  if (shape === 'diamond') {
    return (
      <polygon
        points={`${box.x + box.w / 2},${box.y} ${box.x + box.w},${box.y + box.h / 2} ${box.x + box.w / 2},${box.y + box.h} ${box.x},${box.y + box.h / 2}`}
        {...common}
      />
    );
  }
  if (shape === 'parallelogram') {
    return (
      <polygon
        points={`${box.x + 12},${box.y} ${box.x + box.w},${box.y} ${box.x + box.w - 12},${box.y + box.h} ${box.x},${box.y + box.h}`}
        {...common}
      />
    );
  }
  if (shape === 'sticky') {
    return <path d={`M ${box.x} ${box.y} H ${box.x + box.w - 14} L ${box.x + box.w} ${box.y + 14} V ${box.y + box.h} H ${box.x} Z`} {...common} />;
  }
  if (shape === 'rect') {
    return <rect x={box.x} y={box.y} width={box.w} height={box.h} {...common} />;
  }
  return <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={NODE_RADIUS} {...common} />;
}

function EdgeView({ edge, dimmed, markerId }: { edge: LayoutEdge; dimmed: boolean; markerId: string }): React.ReactElement {
  return (
    <g opacity={dimmed ? 0.2 : 1} className="edge">
      <path
        d={layoutEdgePath(edge, 8)}
        fill="none"
        stroke="var(--cnv-edge)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        markerEnd={`url(#${markerId})`}
      />
    </g>
  );
}

function EdgeLabelView({ edge, dimmed }: { edge: LayoutEdge; dimmed: boolean }): React.ReactElement | null {
  if (!edge.label || !edge.labelLines.length) return null;
  return (
    <g opacity={dimmed ? 0.2 : 1} className="edge-label">
      <title>{edge.label}</title>
      <text
        x={edge.labelPos.x}
        y={edge.labelPos.y - (edge.labelLines.length - 1) * 7}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={11.5}
        fill="var(--cnv-edge-label)"
        stroke="var(--canvas-bg)"
        strokeWidth={3}
        paintOrder="stroke"
        strokeLinejoin="round"
      >
        {edge.labelLines.map((line, index) => (
          <tspan key={index} x={edge.labelPos.x} dy={index === 0 ? 0 : 15}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function NodeText({
  box,
  node,
  theme,
  beginner,
}: {
  box: LayoutBox;
  node: Extract<VibeMap, { type: 'graph' }>['nodes'][number];
  theme: Theme;
  beginner: boolean;
}): React.ReactElement {
  const fontSize = labelFontSize(theme);
  const lines = box.labelLines;
  const plainLines = beginner && node.plain ? wrapText(node.plain, Math.max(80, box.w - 24), 10.5).slice(0, 2) : [];
  const totalHeight = (lines.length - 1) * (fontSize + 3) + (plainLines.length ? plainLines.length * 12 + 4 : 0);
  const startY = box.y + box.h / 2 - totalHeight / 2 + fontSize * 0.52;
  return (
    <g pointerEvents="none">
      <text
        x={box.x + box.w / 2}
        y={startY}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--cnv-ink)"
        fontSize={fontSize}
        fontWeight={node.status === 'deprecated' ? 500 : 600}
        opacity={node.status === 'deprecated' ? 0.65 : 1}
        textDecoration={node.status === 'deprecated' ? 'line-through' : undefined}
      >
        {lines.map((line, index) => (
          <tspan key={index} x={box.x + box.w / 2} dy={index === 0 ? 0 : fontSize + 3}>
            {line}
          </tspan>
        ))}
      </text>
      {plainLines.length ? (
        <text
          x={box.x + box.w / 2}
          y={startY + lines.length * (fontSize + 3) + 1}
          textAnchor="middle"
          fontSize={10.5}
          fill="var(--cnv-ink)"
          opacity={0.7}
        >
          {plainLines.map((line, index) => (
            <tspan key={index} x={box.x + box.w / 2} dy={index === 0 ? 0 : 12}>
              {line}
            </tspan>
          ))}
        </text>
      ) : null}
    </g>
  );
}

/** Small lock glyph drawn as SVG so it never depends on an emoji font. */
function LockBadge({ x, y }: { x: number; y: number }): React.ReactElement {
  return (
    <g pointerEvents="none" transform={`translate(${x} ${y})`}>
      <rect x="0" y="0" width="12" height="12" rx="3" fill="var(--accent)" />
      <path d="M3.2 5.4V4.4a2.8 2.8 0 0 1 5.6 0v1" fill="none" stroke="var(--panel)" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="3" y="5.4" width="6" height="4.4" rx="1" fill="var(--panel)" opacity="0.92" />
    </g>
  );
}

function EvidenceMark({ x, y, kind }: { x: number; y: number; kind: 'stale' | 'declared' }): React.ReactElement {
  return (
    <svg
      x={x}
      y={y}
      width={8}
      height={8}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--panel)"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      pointerEvents="none"
    >
      {kind === 'stale' ? (
        <>
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.4 9a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.2-2.6 3.6" />
          <path d="M12 17h.01" />
        </>
      )}
    </svg>
  );
}

export function MapCanvas(props: CanvasProps): React.ReactElement {
  const {
    detail,
    layout,
    mode,
    selectedNodeId,
    onSelectNode,
    onMoveNode,
    onMoveAnnotation,
    onRemoveAnnotation,
    connectMode,
    connectStart,
    onConnectNode,
    walkthroughFocus,
    beginner,
    fitNonce,
    diff,
    readOnly,
    onZoom,
  } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ x: 30, y: 20, zoom: 1 });
  const [draggingNode, setDraggingNode] = useState<DragNode | null>(null);
  const [draggingAnnotation, setDraggingAnnotation] = useState<DragAnnotation | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; title: string; text: string } | null>(null);
  const markerId = useMemo(() => `vm-arrow-${Math.random().toString(36).slice(2)}`, []);
  const theme = detail.theme;
  const parentMap = detail.map;
  const graphMap = parentMap.type === 'graph' ? parentMap : null;
  const nodeById = useMemo(() => new Map<string, import('@core/types').VibeNode>((graphMap?.nodes ?? []).map((node) => [node.id, node] as const)), [graphMap]);
  const focusSet = walkthroughFocus ? new Set(walkthroughFocus) : null;

  const [floorApplied, setFloorApplied] = useState(false);
  const lastLayoutSizeRef = useRef<{ w: number; h: number }>({ w: layout.width, h: layout.height });

  const fit = useCallback(
    (ignoreFloor = false) => {
      const element = wrapRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const naturalZoom = Math.min((rect.width - 72) / Math.max(1, layout.width), (rect.height - 72) / Math.max(1, layout.height));
      const shouldApplyFloor = !ignoreFloor && naturalZoom < 0.7;
      const zoom = shouldApplyFloor ? Math.max(0.7, Math.min(1.2, naturalZoom)) : Math.max(0.2, Math.min(1.2, naturalZoom));

      setFloorApplied(shouldApplyFloor);

      if (shouldApplyFloor) {
        let rootNode: { x: number; y: number; w: number; h: number } | undefined;
        if (layout.type === 'graph' && layout.nodes.length > 0) rootNode = layout.nodes[0];
        else if (layout.type === 'erd' && layout.entities.length > 0) rootNode = layout.entities[0];
        else if (layout.type === 'sequence' && layout.participants.length > 0) rootNode = layout.participants[0];

        if (rootNode) {
          setViewport({
            zoom,
            x: rect.width / 2 - (rootNode.x + rootNode.w / 2) * zoom,
            y: rect.height / 2 - (rootNode.y + rootNode.h / 2) * zoom,
          });
        } else {
          setViewport({
            zoom,
            x: Math.max(20, (rect.width - layout.width * zoom) / 2),
            y: Math.max(20, (rect.height - layout.height * zoom) / 2),
          });
        }
      } else {
        setViewport({
          zoom,
          x: Math.max(20, (rect.width - layout.width * zoom) / 2),
          y: Math.max(20, (rect.height - layout.height * zoom) / 2),
        });
      }

      onZoom?.(zoom);
    },
    [layout, onZoom],
  );

  useEffect(() => {
    lastLayoutSizeRef.current = { w: layout.width, h: layout.height };
    fit(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.id, fitNonce]);

  useEffect(() => {
    const prev = lastLayoutSizeRef.current;
    const dw = Math.abs(layout.width - prev.w) / Math.max(1, prev.w);
    const dh = Math.abs(layout.height - prev.h) / Math.max(1, prev.h);
    if (dw > 0.15 || dh > 0.15) {
      lastLayoutSizeRef.current = { w: layout.width, h: layout.height };
      fit(false);
    }
  }, [layout.width, layout.height, fit]);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      setViewport((current) => {
        const nextZoom = Math.max(0.2, Math.min(2.6, current.zoom * Math.exp(-event.deltaY * 0.0014)));
        const worldX = (px - current.x) / current.zoom;
        const worldY = (py - current.y) / current.zoom;
        const next = { zoom: nextZoom, x: px - worldX * nextZoom, y: py - worldY * nextZoom };
        onZoom?.(nextZoom);
        return next;
      });
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [onZoom]);

  const zoomBy = (factor: number): void => {
    setViewport((current) => {
      const nextZoom = Math.max(0.2, Math.min(2.6, current.zoom * factor));
      onZoom?.(nextZoom);
      return { ...current, zoom: nextZoom };
    });
  };

  const onBackgroundPointerDown = (event: React.PointerEvent<SVGSVGElement>): void => {
    if (event.button !== 0) return;
    const target = event.target as Element;
    if (target.closest('.vm-node') || target.closest('.vm-annotation') || target.closest('.vm-diff-ghost')) return;
    onSelectNode(null);
    setPanning({ startX: event.clientX, startY: event.clientY, x: viewport.x, y: viewport.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>): void => {
    if (panning) {
      setViewport((current) => ({ ...current, x: panning.x + event.clientX - panning.startX, y: panning.y + event.clientY - panning.startY }));
      return;
    }
    if (draggingNode) {
      setDraggingNode({ ...draggingNode, dx: (event.clientX - draggingNode.startClientX) / viewport.zoom, dy: (event.clientY - draggingNode.startClientY) / viewport.zoom });
      return;
    }
    if (draggingAnnotation) {
      setDraggingAnnotation({ ...draggingAnnotation, dx: (event.clientX - draggingAnnotation.startClientX) / viewport.zoom, dy: (event.clientY - draggingAnnotation.startClientY) / viewport.zoom });
    }
  };

  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>): void => {
    if (draggingNode) {
      onMoveNode(draggingNode.id, Math.round(draggingNode.box.x + draggingNode.dx), Math.round(draggingNode.box.y + draggingNode.dy), draggingNode.box.w, draggingNode.box.h);
      setDraggingNode(null);
    }
    if (draggingAnnotation) {
      onMoveAnnotation(draggingAnnotation.id, Math.round(draggingAnnotation.x + draggingAnnotation.dx), Math.round(draggingAnnotation.y + draggingAnnotation.dy));
      setDraggingAnnotation(null);
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // pointer already released
      }
    }
    if (panning) {
      setPanning(null);
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // pointer already released
      }
    }
  };

  const nodePointerDown = (event: React.PointerEvent<SVGGElement>, box: LayoutBox): void => {
    event.stopPropagation();
    setHover(null);
    onSelectNode(box.id);
    if (connectMode) {
      onConnectNode(box.id);
      return;
    }
    if (mode !== 'edit' || readOnly) return;
    setDraggingNode({ id: box.id, startClientX: event.clientX, startClientY: event.clientY, box, dx: 0, dy: 0 });
    (event.currentTarget.ownerSVGElement as SVGSVGElement | null)?.setPointerCapture(event.pointerId);
  };

  const annotationPointerDown = (event: React.PointerEvent<SVGGElement>, annotation: VibeAnnotation): void => {
    event.stopPropagation();
    if (readOnly) return;
    setDraggingAnnotation({
      id: annotation.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      x: annotation.x,
      y: annotation.y,
      dx: 0,
      dy: 0,
    });
    (event.currentTarget.ownerSVGElement as SVGSVGElement | null)?.setPointerCapture(event.pointerId);
  };

  const zoomText = `${Math.round(viewport.zoom * 100)}%`;

  if (layout.type === 'mermaid') {
    return (
      <div className="mermaid-wrap" ref={wrapRef}>
        <div className="mermaid-toolbar">
          <span>Mermaid source (read only)</span>
          <Button label="Copy source" size="sm" variant="secondary" onClick={() => void navigator.clipboard?.writeText(layout.source)} />
        </div>
        <pre className="mermaid-source">{layout.source}</pre>
        <p className="muted small">Mermaid maps are an escape hatch. Edit the source file; the viewer shows it once validated.</p>
      </div>
    );
  }

  const annotationDrag = draggingAnnotation;
  const nodeDrag = draggingNode;
  const graph = layout.type === 'graph' ? layout : null;
  const sequence = layout.type === 'sequence' ? layout : null;
  const erd = layout.type === 'erd' ? layout : null;

  return (
    <div className="canvas-wrap" ref={wrapRef} data-mode={mode}>
      <svg
        className="vm-svg"
        width="100%"
        height="100%"
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHover(null)}
        role="group"
        aria-label={`${parentMap.title} diagram`}
      >
        <defs>
          <marker id={markerId} markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
            <path d="M0,0 L9,3.5 L0,7 Z" fill="var(--cnv-edge)" />
          </marker>
        </defs>
        <rect className="canvas-bg" width="100%" height="100%" fill="var(--canvas-bg)" />
        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
          {graph
            ? graph.groups.map((group) => (
                <g key={group.id} className="vm-group">
                  <rect
                    x={group.x}
                    y={group.y}
                    width={group.w}
                    height={group.h}
                    rx={10}
                    fill="var(--cnv-group-fill)"
                    stroke="var(--cnv-group-stroke)"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                  <text x={group.x + 12} y={group.y + 20} fontSize={11} fontWeight={600} letterSpacing="0.04em" fill="var(--cnv-group-label)">
                    {group.label}
                  </text>
                </g>
              ))
            : null}
          {graph
            ? graph.edges.map((edge) => <EdgeView key={edge.id} edge={edge} markerId={markerId} dimmed={!!focusSet && !(focusSet.has(edge.from) && focusSet.has(edge.to))} />)
            : null}
          {sequence ? <SequenceScene layout={sequence} markerId={markerId} dimmed={!!focusSet} /> : null}
          {erd ? <ErdScene layout={erd} markerId={markerId} /> : null}
          {graph
            ? graph.nodes.map((box) => {
                const node = nodeById.get(box.id);
                if (!node) return null;
                const evidence = detail.evidence[box.id]?.status;
                const style = strokeForEvidence(evidence, node.status === 'planned', node.kind);
                const fill = fillForKindToken(node.kind);
                const dx = nodeDrag?.id === box.id ? nodeDrag.dx : 0;
                const dy = nodeDrag?.id === box.id ? nodeDrag.dy : 0;
                const moved = { ...box, x: box.x + dx, y: box.y + dy };
                const selected = selectedNodeId === box.id;
                const focused = !focusSet || focusSet.has(box.id);
                const locked = detail.locked.includes(box.id);
                const diffState = diff?.states[box.id];
                const stroke = selected
                  ? 'var(--cnv-node-stroke-selected)'
                  : diffState === 'added'
                    ? 'var(--cnv-added)'
                    : diffState === 'modified'
                      ? 'var(--cnv-modified)'
                      : connectStart === box.id
                        ? 'var(--accent)'
                        : style.stroke;
                const strokeWidth = selected || diffState || connectStart === box.id ? 2 : 1.5;
                return (
                  <g
                    key={box.id}
                    className={`vm-node${selected ? ' selected' : ''}${locked ? ' locked' : ''}`}
                    opacity={focused ? style.opacity : 0.2}
                    onPointerDown={(event) => nodePointerDown(event, box)}
                    onPointerEnter={(event) => {
                      if (mode === 'edit' || connectMode) return;
                      setHover({
                        x: event.clientX,
                        y: event.clientY,
                        title: `${node.label} · ${node.status ?? 'built'}`,
                        text: `${node.plain ?? node.description ?? 'No description yet.'}${node.refs?.length ? `\n${node.refs.map((r) => `${r.path}${r.symbol ? `#${r.symbol}` : ''}`).join('\n')}` : ''}`,
                      });
                    }}
                    onPointerMove={(event) => {
                      if (mode === 'edit' || connectMode) return;
                      if (hover) setHover((current) => (current ? { ...current, x: event.clientX, y: event.clientY } : current));
                    }}
                    onPointerLeave={() => setHover(null)}
                    style={{ cursor: mode === 'edit' ? 'grab' : connectMode ? 'crosshair' : 'pointer' }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectNode(box.id);
                      }
                    }}
                    aria-label={`${node.label}, ${node.kind}${node.status ? `, ${node.status}` : ''}`}
                  >
                    <title>{`${node.label}\n${node.description ?? node.plain ?? ''}`}</title>
                    <NodeShape box={moved} shape={shapeForKind(node.kind)} fill={fill} stroke={stroke} dash={style.dash} strokeWidth={strokeWidth} />
                    <NodeText box={moved} node={node} theme={theme} beginner={beginner} />
                    {locked ? <LockBadge x={moved.x + 7} y={moved.y + 7} /> : null}
                    {evidence && evidence !== 'verified' && evidence !== 'planned' ? (
                      <g pointerEvents="none">
                        <circle cx={moved.x + moved.w - 11} cy={moved.y + 11} r={7} fill={evidence === 'stale' ? 'var(--cnv-stale)' : 'var(--cnv-declared)'} />
                        <EvidenceMark
                          x={moved.x + moved.w - 15}
                          y={moved.y + 7}
                          kind={evidence === 'stale' ? 'stale' : 'declared'}
                        />
                      </g>
                    ) : null}
                    {diffState === 'added' || diffState === 'modified' ? (
                      <rect
                        x={moved.x - 4}
                        y={moved.y - 4}
                        width={moved.w + 8}
                        height={moved.h + 8}
                        rx={NODE_RADIUS + 4}
                        fill="none"
                        stroke={diffState === 'added' ? 'var(--cnv-added)' : 'var(--cnv-modified)'}
                        strokeWidth={1}
                        opacity={0.5}
                        strokeDasharray="3 3"
                      />
                    ) : null}
                  </g>
                );
              })
            : null}
          {diff?.ghosts.map((box) => (
            <g key={`ghost-${box.id}`} className="vm-diff-ghost" opacity={0.6}>
              <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={NODE_RADIUS} fill="none" stroke="var(--cnv-removed)" strokeWidth={1.5} strokeDasharray="5 4" />
              <text x={box.x + box.w / 2} y={box.y + box.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="var(--cnv-removed)" textDecoration="line-through">
                {box.labelLines.join(' ')}
              </text>
            </g>
          ))}
          {detail.layout?.annotations?.map((annotation: VibeAnnotation) => {
            const dx = annotationDrag?.id === annotation.id ? annotationDrag.dx : 0;
            const dy = annotationDrag?.id === annotation.id ? annotationDrag.dy : 0;
            const x = annotation.x + dx;
            const y = annotation.y + dy;
            if (annotation.type === 'sticky' || annotation.type === 'text') {
              const w = annotation.w ?? 160;
              const h = annotation.h ?? 92;
              const isDraggingThis = annotationDrag?.id === annotation.id;
              return (
                <g
                  key={annotation.id}
                  className="vm-annotation"
                  onPointerDown={(event) => annotationPointerDown(event, annotation)}
                  onDoubleClick={() => onSelectNode(null)}
                  style={{ cursor: readOnly ? 'default' : isDraggingThis ? 'grabbing' : 'grab' }}
                >
                  {annotation.type === 'sticky' ? (
                    <>
                      <rect x={x} y={y} width={w} height={h} rx={4} fill="var(--cnv-fill-note)" stroke="var(--cnv-node-stroke)" strokeWidth={1} />
                      {!readOnly && onRemoveAnnotation ? (
                        <g
                          className="vm-annotation-close"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemoveAnnotation(annotation.id);
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                          style={{ cursor: 'pointer' }}
                        >
                          <circle cx={x + w - 11} cy={y + 11} r={7} fill="var(--canvas-bg)" stroke="var(--line-strong)" strokeWidth={1} />
                          <path d={`M ${x + w - 14} ${y + 8} L ${x + w - 8} ${y + 14} M ${x + w - 8} ${y + 8} L ${x + w - 14} ${y + 14}`} stroke="var(--cnv-edge)" strokeWidth={1.4} strokeLinecap="round" />
                        </g>
                      ) : null}
                    </>
                  ) : null}
                  <text x={x + 10} y={y + 20} fontSize={11.5} fill="var(--cnv-ink)" style={{ userSelect: 'none', pointerEvents: 'none' }}>
                    {wrapText(annotation.text ?? '', w - 20, 11.5)
                      .slice(0, 5)
                      .map((line, index) => (
                        <tspan key={index} x={x + 10} dy={index === 0 ? 0 : 15}>
                          {line}
                        </tspan>
                      ))}
                  </text>
                </g>
              );
            }
            if (annotation.type === 'arrow' && annotation.points?.length === 2) {
              const [a, b] = annotation.points;
              return <line key={annotation.id} x1={a[0] + dx} y1={a[1] + dy} x2={b[0] + dx} y2={b[1] + dy} stroke="var(--cnv-edge)" strokeWidth={1.5} markerEnd={`url(#${markerId})`} className="vm-annotation" />;
            }
            if (annotation.type === 'freehand' && annotation.points?.length) {
              const d = annotation.points.map(([px, py], index) => `${index === 0 ? 'M' : 'L'} ${px + dx} ${py + dy}`).join(' ');
              return <path key={annotation.id} d={d} fill="none" stroke="var(--cnv-edge)" strokeWidth={1.5} className="vm-annotation" />;
            }
            return null;
          })}
          {graph
            ? graph.edges.map((edge) => <EdgeLabelView key={`label-${edge.id}`} edge={edge} dimmed={!!focusSet && !(focusSet.has(edge.from) && focusSet.has(edge.to))} />)
            : null}
        </g>
      </svg>
      <div className="canvas-tools" role="toolbar" aria-label="Canvas zoom">
        <button type="button" className="canvas-tool" onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out">
          <Icon name="zoomOut" />
        </button>
        <span className="zoom-label tabular">{zoomText}</span>
        <button type="button" className="canvas-tool" onClick={() => zoomBy(1.2)} aria-label="Zoom in">
          <Icon name="zoomIn" />
        </button>
        <button type="button" className="canvas-tool wide" onClick={() => fit(false)} aria-label="Fit diagram" title="Fit (F)">
          <Icon name="fit" />
          <span>Fit</span>
        </button>
        <button type="button" className="canvas-tool wide" onClick={() => fit(true)} aria-label="Fit entire diagram" title="Fit entire diagram">
          <span>All</span>
        </button>
      </div>
      {floorApplied ? (
        <div className="canvas-hint zoom-readability-hint">
          <span>Zoomed so labels stay readable.</span>
          <button type="button" className="inline-link" onClick={() => fit(true)}>
            Show the whole map
          </button>
        </div>
      ) : null}
      {diff ? (
        <div className="diff-legend" role="status">
          <span className="legend-added">added</span>
          <span className="legend-removed">removed</span>
          <span className="legend-modified">modified</span>
        </div>
      ) : null}
      {hover && mode === 'view' ? (
        <div className="node-tooltip" style={{ left: Math.min(window.innerWidth - 320, hover.x + 14), top: Math.min(window.innerHeight - 150, hover.y + 14) }}>
          <strong>{hover.title}</strong>
          <p>{hover.text}</p>
        </div>
      ) : null}
      {connectMode ? <div className="canvas-hint">Click a source node, then a target. Esc cancels.</div> : null}
    </div>
  );
}

function SequenceScene({ layout, markerId, dimmed }: { layout: SequenceLayout; markerId: string; dimmed: boolean }): React.ReactElement {
  const participants = new Map(layout.participants.map((participant) => [participant.id, participant]));
  return (
    <g opacity={dimmed ? 0.2 : 1}>
      {layout.fragments.map((fragment) => (
        <g key={fragment.index}>
          <rect x={fragment.x} y={fragment.y} width={fragment.w} height={fragment.h} rx={6} fill="var(--cnv-group-fill)" stroke="var(--cnv-group-stroke)" strokeWidth={1} strokeDasharray="4 4" />
          <text x={fragment.x + 8} y={fragment.y + 15} fontSize={10} fontWeight={600} fill="var(--cnv-group-label)">
            {fragment.kind}
            {fragment.label && fragment.label !== fragment.kind ? ` [${fragment.label}]` : ''}
          </text>
        </g>
      ))}
      {layout.participants.map((participant) => {
        const labelY = participant.y + participant.h / 2 - ((participant.lines.length - 1) * 8) / 2;
        return (
          <g key={participant.id} className="vm-node sequence-participant">
            <rect x={participant.x} y={participant.y} width={participant.w} height={participant.h} rx={NODE_RADIUS} fill="var(--cnv-fill-neutral)" stroke="var(--cnv-node-stroke)" strokeWidth={1.5} />
            {participant.lines.map((line, index) => (
              <text
                key={index}
                x={participant.x + participant.w / 2}
                y={labelY + index * 16}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={12.5}
                fontWeight={600}
                fill="var(--cnv-ink)"
              >
                {line}
              </text>
            ))}
            <line
              x1={participant.x + participant.w / 2}
              y1={participant.y + participant.h}
              x2={participant.x + participant.w / 2}
              y2={participant.lifelineBottom}
              stroke="var(--cnv-group-stroke)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          </g>
        );
      })}
      {layout.steps.map((step) => {
        const from = participants.get(step.from);
        const to = participants.get(step.to);
        if (!from || !to) return null;
        const x1 = from.x + from.w / 2;
        const x2 = to.x + to.w / 2;
        return (
          <g key={step.index}>
            {step.from === step.to ? (
              <path
                d={`M ${x1} ${step.y} C ${x1 + 48} ${step.y - 26}, ${x1 + 48} ${step.y + 18}, ${x1} ${step.y + 7}`}
                fill="none"
                stroke="var(--cnv-edge)"
                strokeWidth={1.5}
                markerEnd={`url(#${markerId})`}
              />
            ) : (
              <line x1={x1} y1={step.y} x2={x2} y2={step.y} stroke="var(--cnv-edge)" strokeWidth={1.5} markerEnd={`url(#${markerId})`} />
            )}
            <text
              x={step.labelX ?? (x1 + x2) / 2}
              y={step.y - 10}
              textAnchor="middle"
              fontSize={11.5}
              fill="var(--cnv-edge-label)"
              stroke="var(--canvas-bg)"
              strokeWidth={3}
              paintOrder="stroke"
              strokeLinejoin="round"
            >
              {step.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function ErdScene({ layout, markerId }: { layout: ErdLayout; markerId: string }): React.ReactElement {
  return (
    <g>
      {layout.relations.map((relation) => (
        <EdgeView key={relation.id} edge={relation} dimmed={false} markerId={markerId} />
      ))}
      {layout.entities.map((entity) => (
        <g key={entity.id} className="vm-node erd-entity">
          <rect x={entity.x} y={entity.y} width={entity.w} height={entity.h} rx={NODE_RADIUS} fill="var(--cnv-fill-data)" stroke="var(--cnv-node-stroke)" strokeWidth={1.5} />
          <path d={`M ${entity.x} ${entity.y + 34} H ${entity.x + entity.w}`} stroke="var(--cnv-node-stroke)" strokeWidth={1} />
          <text x={entity.x + entity.w / 2} y={entity.y + 22} textAnchor="middle" dominantBaseline="middle" fontSize={12.5} fontWeight={600} fill="var(--cnv-ink)">
            {entity.labelLines[0] ?? entity.id}
          </text>
          {entity.fields.map((field, index) => {
            const y = entity.y + 54 + index * 20;
            const marker = field.key === 'pk' ? 'PK' : field.key === 'fk' ? 'FK' : field.key === 'unique' ? 'UQ' : '';
            return (
              <g key={field.name}>
                {marker ? (
                  <text x={entity.x + 12} y={y} fontSize={9} fontWeight={700} letterSpacing="0.04em" fill="var(--cnv-edge-label)">
                    {marker}
                  </text>
                ) : null}
                <text x={entity.x + (marker ? 38 : 12)} y={y} fontSize={11.5} fill="var(--cnv-ink)" fontWeight={field.key ? 600 : 400}>
                  {field.name}
                </text>
                <text x={entity.x + entity.w - 12} y={y} textAnchor="end" fontSize={10.5} fill="var(--cnv-edge-label)">
                  {field.type}
                </text>
              </g>
            );
          })}
        </g>
      ))}
      {layout.relations.map((relation) => (
        <EdgeLabelView key={`label-${relation.id}`} edge={relation} dimmed={false} />
      ))}
    </g>
  );
}
