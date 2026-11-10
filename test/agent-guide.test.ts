import { describe, expect, it } from 'vitest';
import { agentGuide } from '../src/agent-kit/guide.js';
import { defaultConfig } from '../src/core/defaults.js';

const config = defaultConfig('demo');

describe('agent guide', () => {
  it('matches the snapshot', () => {
    expect(agentGuide(config)).toMatchSnapshot();
  });

  it('contains the map-type table and the configured limits', () => {
    const guide = agentGuide(config);
    expect(guide).toContain('## Choose the right map type first');
    expect(guide).toContain('| You want to show | Use | Not |');
    expect(guide).toContain('`sequence`');
    expect(guide).toContain('`erd`');
    expect(guide).toContain('Overview ≤ 9 nodes');
    expect(guide).toContain('Feature ≤ 10');
    expect(guide).toContain('Never more than 4 groups');
    expect(guide).toContain('Edges ≤ 1.5 × nodes warn, 2 × nodes error');
    expect(guide).toContain('Treat W120 to W127 as errors');
    expect(guide).toContain('## Things you must never do');
  });

  it('does not keep the old 15/30 limits for overviews', () => {
    const guide = agentGuide(config);
    expect(guide).not.toContain('The overview stays at 15 nodes or fewer');
  });
});
