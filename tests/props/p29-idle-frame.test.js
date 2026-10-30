// Feature: flappy-kiro, Property 29: Idle frame selection
// **Validates: Requirements 18.1**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbAnyConfig } from '../helpers/arbitraries.js';

import { idleFrame } from '../../src/animation.js';

// Independent implementation: walk the cumulative durations at clock mod total.
function expectedIndex(frames, total, clock) {
  const t = ((clock % total) + total) % total;
  let end = 0;
  for (let i = 0; i < frames.length; i++) {
    end += frames[i].ms;
    if (t < end) return i;
  }
  return frames.length - 1;
}

const arbClock = fc.oneof(
  fc.integer({ min: 0, max: 100000 }),
  fc.double({ min: 0, max: 100000, noNaN: true, noDefaultInfinity: true })
);
const arbVy = fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true });

describe('Property 29: idle frame selection', () => {
  it('matches the cumulative-sum walk at clock mod IDLE_TOTAL_MS', () => {
    fc.assert(
      fc.property(arbAnyConfig, arbClock, arbVy, fc.boolean(), (cfg, clock, vy, useSheet) => {
        const a = cfg.animation;
        const f = idleFrame(cfg, clock, vy, useSheet);
        const i = expectedIndex(a.IDLE_FRAMES, a.IDLE_TOTAL_MS, clock);
        expect(f.anim).toBe('idle');
        expect(f.index).toBe(i);
      }),
      { numRuns: 20 }
    );
  });

  it('loops with period IDLE_TOTAL_MS', () => {
    fc.assert(
      fc.property(arbAnyConfig, fc.double({ min: 0, max: 1, noNaN: true }), fc.integer({ min: 1, max: 5 }), (cfg, u, k) => {
        const a = cfg.animation;
        const t = u * a.IDLE_TOTAL_MS;
        // Skip points within float noise of a frame boundary.
        let end = 0;
        for (const fr of a.IDLE_FRAMES) {
          end += fr.ms;
          fc.pre(Math.abs(t - end) > 1e-6);
        }
        const base = idleFrame(cfg, t, 0).index;
        expect(idleFrame(cfg, t + k * a.IDLE_TOTAL_MS, 0).index).toBe(base);
        expect(idleFrame(cfg, t - k * a.IDLE_TOTAL_MS, 0).index).toBe(base);
      }),
      { numRuns: 20 }
    );
  });

  it('offsets the second frame by IDLE_FRAMES[1].offsetY from the first', () => {
    fc.assert(
      fc.property(arbAnyConfig, arbVy, (cfg, vy) => {
        const a = cfg.animation;
        const first = idleFrame(cfg, 0, vy);
        const second = idleFrame(cfg, a.IDLE_FRAMES[0].ms, vy);
        expect(first.index).toBe(0);
        expect(second.index).toBe(1);
        expect(second.offsetY - first.offsetY).toBe(a.IDLE_FRAMES[1].offsetY - (a.IDLE_FRAMES[0].offsetY || 0));
        expect(a.IDLE_FRAMES[1].offsetY).toBe(-1);
      }),
      { numRuns: 20 }
    );
  });
});
