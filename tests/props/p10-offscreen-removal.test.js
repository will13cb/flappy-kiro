// Feature: flappy-kiro, Property 10: Off-screen pairs are removed
// **Validates: Requirements 4.12**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbConfig } from '../helpers/arbitraries.js';

import { removeOffscreen, movePairs } from '../../src/pipes.js';

// Pairs with x spread around the removal threshold so both branches are hit.
const arbPair = (cfg) =>
  fc.record({
    x: fc.oneof(
      fc.double({ min: -cfg.pipes.CAP_WIDTH * 3, max: cfg.world.WIDTH, noNaN: true }),
      fc.constantFrom(-cfg.pipes.CAP_WIDTH, -cfg.pipes.CAP_WIDTH - 1e-6, -cfg.pipes.CAP_WIDTH + 1e-6, 0)
    ),
    gapCenter: fc.double({
      min: cfg.pipes.GAP_CENTER_MIN,
      max: cfg.pipes.GAP_CENTER_MAX,
      noNaN: true,
    }),
    scored: fc.boolean(),
  });

const arbCase = arbConfig.chain((cfg) =>
  fc.record({
    cfg: fc.constant(cfg),
    pairs: fc.array(arbPair(cfg), { maxLength: 12 }),
  })
);

describe('Property 10: off-screen pairs are removed', () => {
  it('drops exactly the pairs with x + CAP_WIDTH < 0 and keeps the rest unchanged', () => {
    fc.assert(
      fc.property(arbCase, ({ cfg, pairs }) => {
        const snapshot = structuredClone(pairs);
        const out = removeOffscreen(cfg, pairs);
        const expected = pairs.filter((p) => !(p.x + cfg.pipes.CAP_WIDTH < 0));
        expect(out).toEqual(expected);
        out.forEach((p, i) => expect(p).toBe(expected[i]));
        // Input is not mutated and a new array is returned.
        expect(out).not.toBe(pairs);
        expect(pairs).toEqual(snapshot);
      }),
      { numRuns: 20 }
    );
  });

  it('keeps a pair whose right edge is exactly 0 and removes one just past it', () => {
    fc.assert(
      fc.property(arbConfig, (cfg) => {
        const keep = { x: -cfg.pipes.CAP_WIDTH, gapCenter: cfg.pipes.GAP_CENTER_MIN, scored: false };
        const drop = { x: -cfg.pipes.CAP_WIDTH - 1, gapCenter: cfg.pipes.GAP_CENTER_MIN, scored: true };
        expect(removeOffscreen(cfg, [drop, keep])).toEqual([keep]);
      }),
      { numRuns: 20 }
    );
  });

  it('removes a pair once movement carries it fully off the left edge', () => {
    fc.assert(
      fc.property(
        arbConfig,
        fc.double({ min: 1, max: 600, noNaN: true }),
        fc.double({ min: 0.001, max: 0.05, noNaN: true }),
        (cfg, speed, dt) => {
          const pair = { x: 0, gapCenter: cfg.pipes.GAP_CENTER_MIN, scored: false };
          let pairs = [pair];
          let steps = 0;
          while (removeOffscreen(cfg, pairs).length > 0 && steps < 100000) {
            pairs = movePairs(pairs, speed, dt);
            steps++;
          }
          expect(removeOffscreen(cfg, pairs)).toEqual([]);
          expect(pairs[0].x + cfg.pipes.CAP_WIDTH).toBeLessThan(0);
        }
      ),
      { numRuns: 20 }
    );
  });
});
