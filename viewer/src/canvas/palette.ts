/**
 * Canvas palette, resolved through CSS custom properties so a single diagram
 * reads correctly in both themes. Kept separate from theme.yaml (which still
 * drives CLI exports) so the viewer can stay quiet and legible.
 */

export function fillForKindToken(kind: string): string {
  switch (kind) {
    case 'ui':
    case 'page':
    case 'component':
      return 'var(--cnv-fill-ui)';
    case 'api':
    case 'service':
    case 'module':
      return 'var(--cnv-fill-api)';
    case 'database':
    case 'cache':
    case 'storage':
      return 'var(--cnv-fill-data)';
    case 'external':
      return 'var(--cnv-fill-external)';
    case 'queue':
    case 'decision':
      return 'var(--cnv-fill-queue)';
    case 'note':
      return 'var(--cnv-fill-note)';
    default:
      return 'var(--cnv-fill-neutral)';
  }
}

export type EvidenceState = 'verified' | 'declared' | 'stale' | 'planned' | undefined;

export function strokeForEvidence(status: EvidenceState, planned: boolean, kind: string): { stroke: string; dash?: string; opacity: number } {
  if (status === 'stale') return { stroke: 'var(--cnv-stale)', opacity: 1 };
  if (status === 'declared') return { stroke: 'var(--cnv-declared)', dash: '4 3', opacity: 1 };
  if (planned) return { stroke: 'var(--cnv-declared)', dash: '6 4', opacity: 0.7 };
  if (kind === 'external') return { stroke: 'var(--cnv-declared)', dash: '6 4', opacity: 1 };
  return { stroke: 'var(--cnv-node-stroke)', opacity: 1 };
}

export function markerFill(): string {
  return 'var(--cnv-edge)';
}
