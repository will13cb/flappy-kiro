// Feature: flappy-kiro, Property 7: Spawn rule
// **Validates: Requirements 4.2**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createRequire } from 'module';
import { arbConfig, arbPipes, rng } from '../helpers/arbitraries.js';

const require = createRequire(import.meta.url);
const { shouldSpawn, spawnPair } = require('../../src/pipes.js');

const arbCase = arbConfig.chain((cfg) =>
  fc.record({
    cfg: fc.constant(cfg),
    pairs: arbPipes(cfg, 8),
  })
);

describe('Property 7: spawn rule', () => {
  it('is true iff the last pair has its left edge at or left of WIDTH - PIPE_SPACING', () => {
    fc.assert(
      fc.property(arbCase, ({ cfg, pairs }) => {
        const threshold = cfg.world.WIDTH - cfg.pipes.PIPE_SPACING;
        const expected = pairs.length === 0 ? true : pairs[pairs.length - 1].x <= threshold;
        expect(shouldSpawn(cfg, pairs)).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  it('is true at the boundary and false just right of it', () => {
    fc.assert(
      fc.property(arbConfig, fc.integer(), (cfg, seed) => {
        const threshold = cfg.world.WIDTH - cfg.pipes.PIPE_SPACING;
        const [first] = spawnPair(cfg, [], rng(seed));
        expect(shouldSpawn(cfg, [{ ...first, x: threshold }])).toBe(true);
        expect(shouldSpawn(cfg, [{ ...first, x: threshold + 1e-6 }])).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('only the last pair matters, and a freshly spawned pair blocks the next spawn', () => {
    fc.assert(
      fc.property(arbCase, fc.integer(), ({ cfg, pairs }, seed) => {
        if (pairs.length > 0) {
          const threshold = cfg.world.WIDTH - cfg.pipes.PIPE_SPACING;
          const last = pairs[pairs.length - 1];
          const rest = pairs.slice(0, -1).map((p) => ({ ...p, x: threshold - 1 }));
          expect(shouldSpawn(cfg, [...rest, last])).toBe(last.x <= threshold);
        }
        const spawned = spawnPair(cfg, pairs, rng(seed));
        expect(shouldSpawn(cfg, spawned)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
