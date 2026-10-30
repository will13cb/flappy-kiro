// Feature: flappy-kiro, Property 30: Flap frame selection and return to idle
// **Validates: Requirements 18.2, 18.4**
// Animation-module part only: the restart of the flap on every jump lives in game.js handleInput
// (Property 31).
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbAnyConfig } from '../helpers/arbitraries.js';

import { flapFrame, idleFrame } from '../../src/animation.js';

const arbVy = fc.double({ min: -1500, max: 1500, noNaN: true, noDefaultInfinity: true });

// Index found by walking the cumulative durations, written independently of frameAt.
function walk(frames, t) {
  let acc = 0;
  for (let i = 0; i < frames.length; i++) {
    acc += frames[i].ms;
    if (t < acc) return i;
  }
  return -1;
}

describe('Property 30: flap frame selection and return to idle', () => {
  it('picks the flap frame found by walking the cumulative durations', () => {
    fc.assert(
      fc.property(arbAnyConfig, fc.double({ min: 0, max: 1, noNaN: true }), arbVy, (cfg, u, vy) => {
        const a = cfg.animation;
        const t = Math.min(u * a.FLAP_TOTAL_MS, a.FLAP_TOTAL_MS - 1e-6);
        const expected = walk(a.FLAP_FRAMES, t);
        const f = flapFrame(cfg, t, vy);
        expect(expected).toBeGreaterThanOrEqual(0);
        expect(f.anim).toBe('flap');
        expect(f.index).toBe(expected);
        expect(f.scaleX).toBe(a.FLAP_FRAMES[expected].scaleX);
        expect(f.scaleY).toBe(a.FLAP_FRAMES[expected].scaleY);
      }),
      { numRuns: 100 }
    );
  });

  it('selects each frame at its start boundary', () => {
    fc.assert(
      fc.property(arbAnyConfig, (cfg) => {
        let start = 0;
        cfg.animation.FLAP_FRAMES.forEach((fr, i) => {
          expect(flapFrame(cfg, start, 0).index).toBe(walk(cfg.animation.FLAP_FRAMES, start));
          expect(walk(cfg.animation.FLAP_FRAMES, start)).toBe(i);
          start += fr.ms;
        });
      }),
      { numRuns: 100 }
    );
  });

  it('returns idle frame 0 at or after FLAP_TOTAL_MS', () => {
    fc.assert(
      fc.property(arbAnyConfig, fc.double({ min: 0, max: 10000, noNaN: true }), arbVy, (cfg, extra, vy) => {
        const t = cfg.animation.FLAP_TOTAL_MS + extra;
        const f = flapFrame(cfg, t, vy);
        expect(f).toEqual(idleFrame(cfg, 0, vy));
        expect(f.anim).toBe('idle');
        expect(f.index).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('returns idle frame 0 when no jump has happened', () => {
    fc.assert(
      fc.property(arbAnyConfig, arbVy, fc.constantFrom(null, undefined), (cfg, vy, none) => {
        const f = flapFrame(cfg, none, vy);
        expect(f).toEqual(idleFrame(cfg, 0, vy));
        expect(f.anim).toBe('idle');
        expect(f.index).toBe(0);
      }),
      { numRuns: 100 }
    );
  });
});
