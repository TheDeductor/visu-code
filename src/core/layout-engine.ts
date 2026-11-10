import type { LayoutResult, Theme, VibeMap } from './types.js';
import { layoutMap, type LayoutOptions } from './layout.js';

export type LayoutEngineName = 'legacy' | 'elk';

export interface LayoutEngine {
  name: LayoutEngineName;
  layout(map: VibeMap, theme: Theme, options?: LayoutOptions): Promise<LayoutResult>;
}

export interface AsyncLayoutOptions extends LayoutOptions {
  engine?: LayoutEngineName;
}

export const legacyEngine: LayoutEngine = {
  name: 'legacy',
  async layout(map, theme, options = {}) {
    return layoutMap(map, theme, options);
  },
};

/**
 * Engine-aware layout. The default stays `legacy`; ELK is opt-in until the
 * comparison numbers are approved. The import is lazy so the viewer bundle
 * does not include elkjs unless the ELK engine is actually requested.
 */
export async function getLayoutEngine(name: LayoutEngineName = 'legacy'): Promise<LayoutEngine> {
  if (name === 'elk') {
    const { elkEngine } = await import('./layout-elk.js');
    return elkEngine;
  }
  return legacyEngine;
}

export async function layoutMapAsync(
  map: VibeMap,
  theme: Theme,
  options: AsyncLayoutOptions = {},
): Promise<LayoutResult> {
  const { engine = 'legacy', ...layoutOptions } = options;
  const resolved = await getLayoutEngine(engine);
  return resolved.layout(map, theme, layoutOptions);
}
