import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import rough from 'roughjs';
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
import { contrastInk, fillForKind, kindLabel, labelFontSize, shapeForKind, wrapText } from '@core/theme';
import { layoutEdgePath } from '@core/geometry';
import type { MapDetail } from '../api';

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

const pathCache = new Map<string, Array<{ d: string; stroke: string; fill: string; strokeWidth: number }>>();

function hashSeed(text: string): number {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return Math.abs(hash) || 1;
}

function roundedPath(box: LayoutBox, radius = 14): string {
  const { x, y, w, h } = box;
  const r = Math.min(radius, w / 2, h / 2);
  return `M ${x + r} ${y} L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} L ${x + w} ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} L ${x + r} ${y + h} Q ${x} ${y + h} ${x} ${y + h - r} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
}

function roughPaths(box: LayoutBox, shape: string, fill: string, stroke: string, theme: Theme, seedKey: string, dash?: string): React.ReactNode {
  const key = `${seedKey}:${box.x}:${box.y}:${box.w}:${box.h}:${shape}:${fill}:${stroke}:${theme.roughness}`;
  let paths = pathCache.get(key);
  if (!paths) {
    const generator = rough.generator();
    const options = {
      seed: hashSeed(seedKey),
      roughness: theme.roughness,
      stroke,
      strokeWidth: theme.strokeWidth,
      fill,
      fillStyle: 'solid' as const,
      hachureGap: 8,
      preserveVertices: true,
    };
    let drawable;
    if (shape === 'ellipse') {
      drawable = generator.ellipse(box.x + box.w / 2, box.y + box.h / 2, box.w, box.h, options);
    } else if (shape === 'diamond') {
      drawable = generator.polygon(
        [
          [box.x + box.w / 2, box.y],
          [box.x + box.w, box.y + box.h / 2],
          [box.x + box.w / 2, box.y + box.h],
          [box.x, box.y + box.h / 2],
        ],
        options,
      );
    } else if (shape === 'parallelogram') {
      drawable = generator.polygon(
        [
          [box.x + 16, box.y],
          [box.x + box.w, box.y],
          [box.x + box.w - 16, box.y + box.h],
          [box.x, box.y + box.h],
        ],
        options,
      );
    } else if (shape === 'sticky') {
      drawable = generator.path(
        `M ${box.x} ${box.y} L ${box.x + box.w - 16} ${box.y} L ${box.x + box.w} ${box.y + 16} L ${box.x + box.w} ${box.y + box.h} L ${box.x} ${box.y + box.h} Z`,
        options,
      );
    } else if (shape === 'rounded') {
      drawable = generator.path(roundedPath(box), options);
    } else {
      drawable = generator.rectangle(box.x, box.y, box.w, box.h, options);
    }
    paths = generator.toPaths(drawable).map((path) => ({
      d: path.d,
      stroke: String(path.stroke ?? stroke),
      fill: String(path.fill ?? 'none'),
      strokeWidth: Number(path.strokeWidth ?? theme.strokeWidth),
    }));
    if (pathCache.size > 600) pathCache.clear();
    pathCache.set(key, paths);
  }
  return paths.map((path, index) => (
    <path
      key={index}
      d={path.d}
      fill={path.fill || 'none'}
      stroke={path.stroke}
      strokeWidth={path.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={dash}
    />
  ));
}

function evidenceStyle(status: string | undefined, kind: string, planned: boolean): { stroke: string; dash?: string; opacity: number } {
  if (status === 'stale') return { stroke: '#e03131', opacity: 1 };
  if (status === 'declared') return { stroke: '#868e96', dash: '4 4', opacity: 1 };
  if (planned) return { stroke: '#868e96', dash: '7 5', opacity: 0.6 };
  if (kind === 'external') return { stroke: '#343a40', dash: '7 5', opacity: 1 };
  return { stroke: '#343a40', opacity: 1 };
}

function EdgeView({ edge, theme, dimmed, markerId }: { edge: LayoutEdge; theme: Theme; dimmed: boolean; markerId: string }) {
  return (
    <g opacity={dimmed ? 0.18 : 1} className="edge">
      <path d={layoutEdgePath(edge, 10)} fill="none" stroke="#495057" strokeWidth={theme.strokeWidth} markerEnd={`url(#${markerId})`} />
      {edge.label && edge.labelLines.length ? (
        <g>
          <title>{edge.label}</title>
          <text
            x={edge.labelPos.x}
            y={edge.labelPos.y - (edge.labelLines.length - 1) * 8.5}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={12.5}
            fill="#495057"
            stroke="var(--canvas-bg, #fff)"
            strokeWidth={4}
            paintOrder="stroke"
            strokeLinejoin="round"
          >
            {edge.labelLines.map((line, index) => (
              <tspan key={index} x={edge.labelPos.x} dy={index === 0 ? 0 : 17}>
                {line}
              </tspan>
            ))}
          </text>
        </g>
      ) : null}
    </g>
  );
}

function NodeText({ box, node, theme, beginner }: { box: LayoutBox; node: Extract<VibeMap, { type: 'graph' }>['nodes'][number]; theme: Theme; beginner: boolean }) {
  const fontSize = labelFontSize(theme);
  const lines = box.labelLines;
  const plainLines = beginner && node.plain ? wrapText(node.plain, Math.max(80, box.w - 26), 11).slice(0, 2) : [];
  const totalHeight = (lines.length - 1) * (fontSize + 4) + (plainLines.length ? plainLines.length * 13 + 5 : 0);
  const startY = box.y + box.h / 2 - totalHeight / 2 + fontSize * 0.55;
  return (
    <g pointerEvents="none">
      <text
        x={box.x + box.w / 2}
        y={startY}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={node.status === 'deprecated' ? '#868e96' : contrastInk(fillForKind(node.kind, theme))}
        fontSize={fontSize}
        fontWeight={600}
        textDecoration={node.status === 'deprecated' ? 'line-through' : undefined}
      >
        {lines.map((line, index) => (
          <tspan key={index} x={box.x + box.w / 2} dy={index === 0 ? 0 : fontSize + 4}>
            {line}
          </tspan>
        ))}
      </text>
      {plainLines.length ? (
        <text x={box.x + box.w / 2} y={startY + lines.length * (fontSize + 4) + 2} textAnchor="middle" fontSize={10.5} fill="#495057" opacity={0.85}>
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

export function MapCanvas(props: CanvasProps): React.ReactElement {
  const {
    detail,
    layout,
    mode,
    selectedNodeId,
    onSelectNode,
    onMoveNode,
    onMoveAnnotation,
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

  const fit = useCallback((ignoreFloor = false) => {
    const element = wrapRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const naturalZoom = Math.min((rect.width - 70) / Math.max(1, layout.width), (rect.height - 70) / Math.max(1, layout.height));
    const shouldApplyFloor = !ignoreFloor && naturalZoom < 0.7;
    const zoom = shouldApplyFloor
      ? Math.max(0.7, Math.min(1.25, naturalZoom))
      : Math.max(0.2, Math.min(1.25, naturalZoom));

    setFloorApplied(shouldApplyFloor);

    if (shouldApplyFloor) {
      let rootNode: { x: number; y: number; w: number; h: number } | undefined;
      if (layout.type === 'graph' && layout.nodes.length > 0) rootNode = layout.nodes[0];
      else if (layout.type === 'erd' && layout.entities.length > 0) rootNode = layout.entities[0];
      else if (layout.type === 'sequence' && layout.participants.length > 0) rootNode = layout.participants[0];

      if (rootNode) {
        const rootCenterX = rootNode.x + rootNode.w / 2;
        const rootCenterY = rootNode.y + rootNode.h / 2;
        setViewport({
          zoom,
          x: rect.width / 2 - rootCenterX * zoom,
          y: rect.height / 2 - rootCenterY * zoom,
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
  }, [layout, onZoom]);

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
      const dx = (event.clientX - draggingNode.startClientX) / viewport.zoom;
      const dy = (event.clientY - draggingNode.startClientY) / viewport.zoom;
      setDraggingNode({ ...draggingNode, dx, dy });
      return;
    }
    if (draggingAnnotation) {
      const dx = (event.clientX - draggingAnnotation.startClientX) / viewport.zoom;
      const dy = (event.clientY - draggingAnnotation.startClientY) / viewport.zoom;
      setDraggingAnnotation({ ...draggingAnnotation, dx, dy });
    }
  };

  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>): void => {
    if (draggingNode) {
      const x = Math.round(draggingNode.box.x + draggingNode.dx);
      const y = Math.round(draggingNode.box.y + draggingNode.dy);
      onMoveNode(draggingNode.id, x, y, draggingNode.box.w, draggingNode.box.h);
      setDraggingNode(null);
    }
    if (draggingAnnotation) {
      onMoveAnnotation(draggingAnnotation.id, Math.round(draggingAnnotation.x + draggingAnnotation.dx), Math.round(draggingAnnotation.y + draggingAnnotation.dy));
      setDraggingAnnotation(null);
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
    if (mode !== 'edit' || readOnly) return;
    setDraggingAnnotation({
      id: annotation.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      x: annotation.x,
      y: annotation.y,
      dx: 0,
      dy: 0,
    });
  };

  const zoomText = `${Math.round(viewport.zoom * 100)}%`;

  if (layout.type === 'mermaid') {
    return (
      <div className="mermaid-wrap" ref={wrapRef}>
        <div className="mermaid-toolbar">
          <span>Mermaid source (read-only canvas)</span>
          <button
            type="button"
            className="btn small"
            onClick={() => {
              void navigator.clipboard?.writeText(layout.source);
            }}
          >
            Copy source
          </button>
        </div>
        <pre className="mermaid-source">{layout.source}</pre>
        <p className="muted">Mermaid maps are an escape hatch. Edit the source text in the file; the viewer shows it verbatim once validated.</p>
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
        role="application"
        aria-label={`${parentMap.title} canvas`}
      >
        <defs>
          <marker id={markerId} markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <path d="M0,0 L10,4 L0,8 z" fill="#495057" />
          </marker>
          <pattern id="vm-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1.2" cy="1.2" r="1.2" fill="var(--grid-dot)" />
          </pattern>
        </defs>
        <rect className="canvas-bg" width="100%" height="100%" fill="url(#vm-grid)" />
        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
          {graph
            ? graph.groups.map((group) => (
                <g key={group.id} className="vm-group">
                  {roughPaths({ id: group.id, x: group.x, y: group.y, w: group.w, h: group.h, labelLines: [group.label], kind: 'group' }, 'rect', 'rgba(233,236,239,0.12)', '#adb5bd', { ...theme, roughness: 0, strokeWidth: 1.5 }, `group-${group.id}`, '6 5')}
                  <text x={group.x + 14} y={group.y + 23} fontSize={13} fontWeight={700} fill="#495057">
                    {group.label}
                  </text>
                </g>
              ))
            : null}
          {graph
            ? graph.edges.map((edge) => (
                <EdgeView
                  key={edge.id}
                  edge={edge}
                  theme={theme}
                  markerId={markerId}
                  dimmed={!!focusSet && !(focusSet.has(edge.from) && focusSet.has(edge.to))}
                />
              ))
            : null}
          {sequence ? <SequenceScene layout={sequence} theme={theme} markerId={markerId} dimmed={!!focusSet} /> : null}
          {erd ? <ErdScene layout={erd} theme={theme} markerId={markerId} /> : null}
          {graph
            ? graph.nodes.map((box) => {
                const node = nodeById.get(box.id);
                if (!node) return null;
                const evidence = detail.evidence[box.id]?.status;
                const style = evidenceStyle(evidence, node.kind, node.status === 'planned');
                const fill = fillForKind(node.kind, theme);
                const dx = nodeDrag?.id === box.id ? nodeDrag.dx : 0;
                const dy = nodeDrag?.id === box.id ? nodeDrag.dy : 0;
                const moved = { ...box, x: box.x + dx, y: box.y + dy };
                const selected = selectedNodeId === box.id;
                const focused = !focusSet || focusSet.has(box.id);
                const locked = detail.locked.includes(box.id);
                const diffState = diff?.states[box.id];
                const stroke = diffState === 'added' ? '#2f9e44' : diffState === 'modified' ? '#e67700' : selected ? '#1971c2' : connectStart === box.id ? '#f08c00' : style.stroke;
                return (
                  <g
                    key={box.id}
                    className={`vm-node${selected ? ' selected' : ''}${locked ? ' locked' : ''}`}
                    opacity={focused ? style.opacity : 0.18}
                    onPointerDown={(event) => nodePointerDown(event, box)}
                    onPointerEnter={(event) => {
                      if (mode === 'edit' || connectMode) return;
                      setHover({
                        x: event.clientX,
                        y: event.clientY,
                        title: `${node.label} · ${kindLabel(node.kind)}${node.status ? ` · ${node.status}` : ''}`,
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
                    aria-label={`${node.label}, ${kindLabel(node.kind)}${node.status ? `, ${node.status}` : ''}`}
                  >
                    {roughPaths(moved, shapeForKind(node.kind), fill, stroke, theme, `node-${box.id}`, style.dash)}
                    <NodeText box={moved} node={node} theme={theme} beginner={beginner} />
                    {locked ? (
                      <g pointerEvents="none">
                        <rect x={moved.x + 6} y={moved.y + 6} width={17} height={17} rx={5} fill="#1971c2" />
                        <text x={moved.x + 14.5} y={moved.y + 18.5} textAnchor="middle" fontSize={10} fill="#fff">
                          🔒
                        </text>
                      </g>
                    ) : null}
                    {evidence && evidence !== 'verified' && evidence !== 'planned' ? (
                      <g pointerEvents="none">
                        <circle cx={moved.x + moved.w - 12} cy={moved.y + 12} r={9} fill={evidence === 'stale' ? '#e03131' : '#868e96'} />
                        <text x={moved.x + moved.w - 12} y={moved.y + 16} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">
                          {evidence === 'stale' ? '!' : '?'}
                        </text>
                      </g>
                    ) : null}
                    {diffState === 'added' || diffState === 'modified' ? (
                      <rect x={moved.x - 5} y={moved.y - 5} width={moved.w + 10} height={moved.h + 10} rx={16} fill="none" stroke={diffState === 'added' ? '#2f9e44' : '#e67700'} strokeWidth={3} opacity={0.75} />
                    ) : null}
                    <title>{`${node.label}\n${node.description ?? node.plain ?? ''}`}</title>
                  </g>
                );
              })
            : null}
          {diff?.ghosts.map((box) => (
            <g key={`ghost-${box.id}`} className="vm-diff-ghost" opacity={0.55}>
              <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={12} fill="rgba(224,49,49,0.05)" stroke="#e03131" strokeWidth={2} strokeDasharray="8 6" />
              <text x={box.x + box.w / 2} y={box.y + box.h / 2} textAnchor="middle" fontSize={13} fill="#e03131" textDecoration="line-through">
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
              return (
                <g key={annotation.id} className="vm-annotation" onPointerDown={(event) => annotationPointerDown(event, annotation)} onDoubleClick={() => onSelectNode(null)} style={{ cursor: mode === 'edit' ? 'grab' : 'default' }}>
                  {annotation.type === 'sticky' ? <rect x={x} y={y} width={w} height={h} rx={3} fill="#fff3bf" stroke="#f08c00" strokeWidth={1.5} /> : null}
                  <text x={x + 10} y={y + 22} fontSize={12.5} fill="#3b2f00">
                    {wrapText(annotation.text ?? '', w - 20, 12.5)
                      .slice(0, 5)
                      .map((line, index) => (
                        <tspan key={index} x={x + 10} dy={index === 0 ? 0 : 17}>
                          {line}
                        </tspan>
                      ))}
                  </text>
                </g>
              );
            }
            if (annotation.type === 'arrow' && annotation.points?.length === 2) {
              const [a, b] = annotation.points;
              return <line key={annotation.id} x1={a[0] + dx} y1={a[1] + dy} x2={b[0] + dx} y2={b[1] + dy} stroke="#495057" strokeWidth={2} markerEnd={`url(#${markerId})`} className="vm-annotation" />;
            }
            if (annotation.type === 'freehand' && annotation.points?.length) {
              const d = annotation.points.map(([px, py], index) => `${index === 0 ? 'M' : 'L'} ${px + dx} ${py + dy}`).join(' ');
              return <path key={annotation.id} d={d} fill="none" stroke="#495057" strokeWidth={2} className="vm-annotation" />;
            }
            return null;
          })}
        </g>
      </svg>
      <div className="canvas-tools" role="toolbar" aria-label="Canvas zoom">
        <button type="button" className="icon-btn" onClick={() => zoomBy(1.2)} aria-label="Zoom in">
          +
        </button>
        <span className="zoom-label">{zoomText}</span>
        <button type="button" className="icon-btn" onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out">
          −
        </button>
        <button type="button" className="icon-btn wide" onClick={() => fit(false)} aria-label="Fit to screen" title="Fit (F)">
          Fit
        </button>
        <button type="button" className="icon-btn wide" onClick={() => fit(true)} aria-label="Fit all (unrestricted)" title="Fit all">
          Fit all
        </button>
      </div>
      {floorApplied ? (
        <div className="canvas-hint zoom-readability-hint">
          Zoomed to fit readability — <button type="button" style={{ background: 'none', border: 'none', color: 'var(--accent, #1971c2)', cursor: 'pointer', textDecoration: 'underline', font: 'inherit', padding: '0 4px' }} onClick={() => fit(true)}>Fit all</button>
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
      {connectMode ? <div className="canvas-hint">Connect mode: click a source node, then a target node. Esc cancels.</div> : null}
    </div>
  );
}

function SequenceScene({ layout, theme, markerId, dimmed }: { layout: SequenceLayout; theme: Theme; markerId: string; dimmed: boolean }) {
  const participants = new Map(layout.participants.map((p) => [p.id, p]));
  return (
    <g opacity={dimmed ? 0.2 : 1}>
      {layout.fragments.map((fragment) => (
        <g key={fragment.index}>
          <rect x={fragment.x} y={fragment.y} width={fragment.w} height={fragment.h} fill="#fff9db" fillOpacity={0.55} stroke="#f08c00" strokeWidth={1.4} strokeDasharray="5 4" />
          <rect x={fragment.x} y={fragment.y - 16} width={Math.max(24, fragment.kind.length * 8 + 16)} height={20} fill="#f08c00" />
          <text x={fragment.x + 8} y={fragment.y - 2} fontSize={11} fontWeight={700} fill="#fff">
            {fragment.kind}
          </text>
          {fragment.label && fragment.label !== fragment.kind ? (
            <text x={fragment.x + Math.max(24, fragment.kind.length * 8 + 16) + 8} y={fragment.y - 2} fontSize={11} fill="#7a4b00">
              [{fragment.label}]
            </text>
          ) : null}
        </g>
      ))}
      {layout.participants.map((participant) => {
        const box: LayoutBox = { id: participant.id, x: participant.x, y: participant.y, w: participant.w, h: participant.h, labelLines: participant.lines, kind: 'service' };
        return (
          <g key={participant.id} className="vm-node sequence-participant">
            {roughPaths(box, 'rounded', theme.colors.api, '#343a40', theme, `seq-${participant.id}`)}
            {participant.lines.map((line, index) => (
              <text key={index} x={participant.x + participant.w / 2} y={participant.y + participant.h / 2 - (participant.lines.length - 1) * 9 + index * 18} textAnchor="middle" fontSize={14} fontWeight={600} fill="#1e1e1e">
                {line}
              </text>
            ))}
            <line x1={participant.x + participant.w / 2} y1={participant.y + participant.h} x2={participant.x + participant.w / 2} y2={participant.lifelineBottom} stroke="#adb5bd" strokeWidth={1.5} strokeDasharray="6 6" />
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
              <path d={`M ${x1} ${step.y} C ${x1 + 60} ${step.y - 30}, ${x1 + 60} ${step.y + 20}, ${x1} ${step.y + 8}`} fill="none" stroke="#343a40" strokeWidth={1.8} markerEnd={`url(#${markerId})`} />
            ) : (
              <line x1={x1} y1={step.y} x2={x2} y2={step.y} stroke="#343a40" strokeWidth={1.8} markerEnd={`url(#${markerId})`} />
            )}
            <text
              x={(x1 + x2) / 2}
              y={step.y - 12}
              textAnchor="middle"
              fontSize={12}
              fill="#343a40"
              stroke="var(--canvas-bg, #fff)"
              strokeWidth={4}
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

function ErdScene({ layout, theme, markerId }: { layout: ErdLayout; theme: Theme; markerId: string }) {
  return (
    <g>
      {layout.relations.map((relation) => (
        <EdgeView key={relation.id} edge={relation} theme={theme} dimmed={false} markerId={markerId} />
      ))}
      {layout.entities.map((entity) => (
        <g key={entity.id} className="vm-node erd-entity">
          <rect x={entity.x} y={entity.y} width={entity.w} height={entity.h} rx={7} fill="var(--panel,#fff)" stroke="#343a40" strokeWidth={2} />
          <path d={`M ${entity.x} ${entity.y + 38} L ${entity.x + entity.w} ${entity.y + 38}`} stroke="#343a40" strokeWidth={1.5} />
          <rect x={entity.x} y={entity.y} width={entity.w} height={38} rx={7} fill={theme.colors.database} />
          <text x={entity.x + entity.w / 2} y={entity.y + 24} textAnchor="middle" fontSize={15} fontWeight={700} fill="#1e1e1e">
            {entity.labelLines[0] ?? entity.id}
          </text>
          {entity.fields.map((field, index) => {
            const y = entity.y + 58 + index * 22;
            return (
              <g key={field.name}>
                <text x={entity.x + 12} y={y} fontSize={12} fill="#1e1e1e" fontWeight={field.key ? 600 : 400}>
                  {field.key === 'pk' ? '🔑 ' : field.key === 'fk' ? '↗ ' : field.key === 'unique' ? '✦ ' : ''}
                  {field.name}
                </text>
                <text x={entity.x + entity.w - 12} y={y} textAnchor="end" fontSize={11.5} fill="#6c757d">
                  {field.type}
                </text>
              </g>
            );
          })}
        </g>
      ))}
    </g>
  );
}
