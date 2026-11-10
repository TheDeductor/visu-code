export interface LayoutPoint {
  x: number;
  y: number;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** SVG path for a polyline with rounded interior corners. */
export function polylinePath(points: LayoutPoint[], radius = 10): string {
  if (points.length === 0) return '';
  const first = points[0]!;
  if (points.length === 1) return `M ${round(first.x)} ${round(first.y)}`;
  if (points.length === 2) {
    const last = points[1]!;
    return `M ${round(first.x)} ${round(first.y)} L ${round(last.x)} ${round(last.y)}`;
  }

  const r = Math.max(0, radius);
  let d = `M ${round(first.x)} ${round(first.y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    const next = points[i + 1]!;
    const lenPrev = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const lenNext = Math.hypot(next.x - cur.x, next.y - cur.y);
    if (lenPrev < 0.001 || lenNext < 0.001) {
      d += ` L ${round(cur.x)} ${round(cur.y)}`;
      continue;
    }
    const rr = Math.min(r, lenPrev / 2, lenNext / 2);
    const inX = cur.x + ((prev.x - cur.x) / lenPrev) * rr;
    const inY = cur.y + ((prev.y - cur.y) / lenPrev) * rr;
    const outX = cur.x + ((next.x - cur.x) / lenNext) * rr;
    const outY = cur.y + ((next.y - cur.y) / lenNext) * rr;
    d += ` L ${round(inX)} ${round(inY)} Q ${round(cur.x)} ${round(cur.y)} ${round(outX)} ${round(outY)}`;
  }
  const last = points[points.length - 1]!;
  d += ` L ${round(last.x)} ${round(last.y)}`;
  return d;
}

/**
 * Edge path that supports both legacy cubic Béziers (`M … C …`) and
 * polyline engines (ELK). Legacy edges keep their curve; polylines get
 * rounded corners.
 */
export function layoutEdgePath(edge: { path: string; points: LayoutPoint[] }, radius = 10): string {
  if (edge.path.includes('C')) return edge.path;
  if (edge.points.length >= 2) return polylinePath(edge.points, radius);
  return edge.path;
}
