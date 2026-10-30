// Feature: flappy-kiro, Property 8: Scroll speed curve
// **Validates: Requirements 4.10**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbAnyConfig, arbScore } from '../helpers/arbitraries.js';

import { speedForScore } from '../../src/pipes.js';

describe('Property 8: scroll speed curve', () => {
  it('equals min(MAX_SPEED, INITIAL_SPEED + SPEED_INCREMENT * floor(score / SPEED_STEP_INTERVAL))', () => {
    fc.assert(
      fc.property(arbAnyConfig, arbScore, (cfg, score) => {
        const p = cfg.speed;
        const expected = Math.min(
          p.MAX_SPEED,
          p.INITIAL_SPEED + p.SPEED_INCREMENT * Math.floor(score / p.SPEED_STEP_INTERVAL)
        );
        expect(speedForScore(cfg, score)).toBeCloseTo(expected, 9);
      }),
      { numRuns: 100 }
    );
  });

  it('never decreases as the score grows and never exceeds MAX_SPEED', () => {
    fc.assert(
      fc.property(arbAnyConfig, arbScore, arbScore, (cfg, a, b) => {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        const sLo = speedForScore(cfg, lo);
        const sHi = speedForScore(cfg, hi);
        expect(sHi).toBeGreaterThanOrEqual(sLo);
        expect(sHi).toBeLessThanOrEqual(cfg.speed.MAX_SPEED);
        expect(sLo).toBeLessThanOrEqual(cfg.speed.MAX_SPEED);
      }),
      { numRuns: 100 }
    );
  });
});
