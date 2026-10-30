// Feature: flappy-kiro, Property 25: Cloud movement and wrap
// **Validates: Requirements 13.6, 13.7, 13.11**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createRequire } from 'module';
import { arbAnyConfig, arbDt, rng } from '../helpers/arbitraries.js';

const require = createRequire(import.meta.url);
const { createClouds, moveClouds } = require('../../src/clouds.js');

// A config, a dt, and clouds whose x is spread from well off the left edge to off the right edge.
const arbCase = arbAnyConfig.chain((cfg) =>
  fc.record({
    cfg: fc.constant(cfg),
    dt: arbDt(cfg),
    seed: fc.integer(),
    xs: fc.array(fc.double({ min: -300, max: cfg.world.WIDTH + 100, noNaN: true }), {
      minLength: 8,
      maxLength: 8,
    }),
  })
);

function makeClouds(cfg, seed, xs) {
  return createClouds(cfg, rng(seed)).map((c, i) => ({ ...c, x: xs[i % xs.length] }));
}

describe('Property 25: cloud movement and wrap', () => {
  it('moves each cloud left by speed * dt, or wraps it to the right edge, keeping y and other fields', () => {
    fc.assert(
      fc.property(arbCase, ({ cfg, dt, seed, xs }) => {
        const clouds = makeClouds(cfg, seed, xs);
        const before = structuredClone(clouds);
        const after = moveClouds(cfg, clouds, dt);

        expect(clouds).toEqual(before); // input not mutated
        expect(after).toHaveLength(before.length);
        after.forEach((c, i) => {
          const b = before[i];
          const moved = b.x - b.speed * dt;
          if (moved + b.width < 0) {
            expect(c.x).toBe(cfg.world.WIDTH);
          } else {
            expect(c.x).toBeCloseTo(moved, 9);
            expect(c.x).toBeLessThanOrEqual(b.x);
          }
          expect(c.y).toBe(b.y);
          expect(c.width).toBe(b.width);
          expect(c.speed).toBe(b.speed);
          expect(c.alpha).toBe(b.alpha);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('wraps a cloud that is completely beyond the left edge', () => {
    fc.assert(
      fc.property(arbAnyConfig, fc.integer(), (cfg, seed) => {
        const [c] = createClouds(cfg, rng(seed));
        const gone = { ...c, x: -c.width - 1 };
        const [out] = moveClouds(cfg, [gone], 0.0001);
        expect(out.x).toBe(cfg.world.WIDTH);
        expect(out.y).toBe(gone.y);
      }),
      { numRuns: 100 }
    );
  });
});
