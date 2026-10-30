// Feature: flappy-kiro, Property 32: Death frames cover the crash and then hold
// **Validates: Requirements 7.2, 7.14, 18.5**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createRequire } from 'module';
import { arbAnyConfig } from '../helpers/arbitraries.js';

const require = createRequire(import.meta.url);
const { deathFrame } = require('../../src/animation.js');

const DEG = Math.PI / 180;
const arbElapsed = fc.double({ min: -100, max: 5000, noNaN: true, noDefaultInfinity: true });

describe('Property 32: death frames cover the crash and then hold', () => {
  it('uses floor(elapsed / DEATH_FRAME_MS) while below the timed frame count, then the final frame', () => {
    fc.assert(
      fc.property(arbAnyConfig, arbElapsed, fc.boolean(), (cfg, t, useSheet) => {
        const a = cfg.animation;
        const n = a.DEATH_FRAMES.length;
        const raw = Math.floor(Math.max(t, 0) / cfg.timing.DEATH_FRAME_MS);
        const f = deathFrame(cfg, t, useSheet);
        expect(f.anim).toBe('death');
        if (raw < n) {
          expect(f.index).toBe(raw);
          if (!useSheet) {
            expect(f.rotation).toBeCloseTo(a.DEATH_FRAMES[raw].rotation * DEG, 12);
            expect(f.tint).toBe(!!a.DEATH_FRAMES[raw].tint);
          }
        } else {
          expect(f.index).toBe(n);
          if (!useSheet) {
            expect(f.rotation).toBeCloseTo(a.DEATH_FINAL.rotation * DEG, 12);
            expect(f.tint).toBe(!!a.DEATH_FINAL.tint);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('never decreases the frame index as elapsed time grows', () => {
    fc.assert(
      fc.property(arbAnyConfig, arbElapsed, arbElapsed, (cfg, t1, t2) => {
        const [lo, hi] = t1 <= t2 ? [t1, t2] : [t2, t1];
        expect(deathFrame(cfg, hi).index).toBeGreaterThanOrEqual(deathFrame(cfg, lo).index);
      }),
      { numRuns: 100 }
    );
  });

  it('holds the final frame until the next round', () => {
    fc.assert(
      fc.property(arbAnyConfig, fc.double({ min: 0, max: 100000, noNaN: true }), (cfg, extra) => {
        const n = cfg.animation.DEATH_FRAMES.length;
        const t = n * cfg.timing.DEATH_FRAME_MS + extra;
        expect(deathFrame(cfg, t).index).toBe(n);
        expect(deathFrame(cfg, t).rotation).toBeCloseTo(cfg.animation.DEATH_FINAL.rotation * DEG, 12);
      }),
      { numRuns: 100 }
    );
  });

  it('covers the crash with timed frames and flashes white on alternating CRASH_FLASH_MS intervals', () => {
    fc.assert(
      fc.property(arbAnyConfig, (cfg) => {
        const a = cfg.animation;
        const n = a.DEATH_FRAMES.length;
        // Timed frames fit inside the crash window.
        expect(a.DEATH_TOTAL_MS).toBeLessThanOrEqual(cfg.timing.CRASH_MS);
        expect(a.DEATH_TOTAL_MS).toBeCloseTo(n * cfg.timing.DEATH_FRAME_MS, 9);
        // Frame length is the flash interval, and tint alternates frame to frame.
        expect(cfg.timing.DEATH_FRAME_MS).toBe(cfg.timing.CRASH_FLASH_MS);
        for (let i = 0; i < n; i++) {
          const mid = (i + 0.5) * cfg.timing.DEATH_FRAME_MS;
          expect(deathFrame(cfg, mid).tint).toBe(i % 2 === 0);
        }
      }),
      { numRuns: 100 }
    );
  });
});
