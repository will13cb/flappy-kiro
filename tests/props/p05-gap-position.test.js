// Feature: flappy-kiro, Property 5: Gap position respects margins and shift limit
// **Validates: Requirements 4.5, 4.6**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbConfig, rng } from '../helpers/arbitraries.js';

import { chooseGapCenter, spawnPair } from '../../src/pipes.js';

const EPS = 1e-9;

// A config plus a previous center inside its valid range and a random value in [0, 1].
const arbCase = arbConfig.chain((cfg) =>
  fc.record({
    cfg: fc.constant(cfg),
    prev: fc.double({
      min: cfg.pipes.GAP_CENTER_MIN,
      max: cfg.pipes.GAP_CENTER_MAX,
      noNaN: true,
    }),
    r: fc.double({ min: 0, max: 1, noNaN: true }),
  })
);

describe('Property 5: gap position respects margins and shift limit', () => {
  it('keeps the next gap center in range and within MAX_GAP_SHIFT of the previous one', () => {
    fc.assert(
      fc.property(arbCase, ({ cfg, prev, r }) => {
        const c = chooseGapCenter(cfg, prev, () => r);
        expect(c).toBeGreaterThanOrEqual(cfg.pipes.GAP_CENTER_MIN);
        expect(c).toBeLessThanOrEqual(cfg.pipes.GAP_CENTER_MAX);
        expect(Math.abs(c - prev)).toBeLessThanOrEqual(cfg.pipes.MAX_GAP_SHIFT + EPS);
      }),
      { numRuns: 20 }
    );
  });

  it('places the first gap of a round within the margin range', () => {
    fc.assert(
      fc.property(arbCase, ({ cfg, r }) => {
        const c = chooseGapCenter(cfg, undefined, () => r);
        expect(c).toBeGreaterThanOrEqual(cfg.pipes.GAP_CENTER_MIN);
        expect(c).toBeLessThanOrEqual(cfg.pipes.GAP_CENTER_MAX);

        const [pair] = spawnPair(cfg, [], () => r);
        expect(pair.gapCenter).toBeGreaterThanOrEqual(cfg.pipes.GAP_CENTER_MIN);
        expect(pair.gapCenter).toBeLessThanOrEqual(cfg.pipes.GAP_CENTER_MAX);
      }),
      { numRuns: 20 }
    );
  });

  it('keeps successive spawned pairs within the shift limit', () => {
    fc.assert(
      fc.property(arbConfig, fc.integer(), fc.integer({ min: 2, max: 20 }), (cfg, seed, n) => {
        const random = rng(seed);
        let pairs = [];
        for (let i = 0; i < n; i++) pairs = spawnPair(cfg, pairs, random);
        for (let i = 0; i < pairs.length; i++) {
          const g = pairs[i].gapCenter;
          expect(g).toBeGreaterThanOrEqual(cfg.pipes.GAP_CENTER_MIN);
          expect(g).toBeLessThanOrEqual(cfg.pipes.GAP_CENTER_MAX);
          if (i > 0) {
            expect(Math.abs(g - pairs[i - 1].gapCenter)).toBeLessThanOrEqual(
              cfg.pipes.MAX_GAP_SHIFT + EPS
            );
          }
        }
      }),
      { numRuns: 20 }
    );
  });
});
