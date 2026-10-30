// Feature: flappy-kiro, Property 33: Frame placement and sheet source rectangles
// **Validates: Requirements 18.6, 18.7**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbConfig, arbGhost } from '../helpers/arbitraries.js';

import { frameDest, sheetSource, idleFrame, flapFrame, deathFrame } from '../../src/animation.js';

const FRAME_COUNT = 10; // idle 0..1, flap 2..4, death 5..9

const arbCase = arbConfig.chain((cfg) =>
  fc.record({ cfg: fc.constant(cfg), ghost: arbGhost(cfg) })
);

describe('Property 33: frame placement and sheet source rectangles', () => {
  it('places a SPRITE_SIZE square centered on (X, y)', () => {
    fc.assert(
      fc.property(arbCase, ({ cfg, ghost }) => {
        const s = cfg.ghost.SPRITE_SIZE;
        const d = frameDest(cfg, ghost);
        expect(d.w).toBe(s);
        expect(d.h).toBe(s);
        expect(d.x + d.w / 2).toBeCloseTo(cfg.ghost.X, 9);
        expect(d.y + d.h / 2).toBeCloseTo(ghost.y, 9);
      }),
      { numRuns: 100 }
    );
  });

  it('gives sheet source rectangles of SPRITE_SIZE inside the strip', () => {
    fc.assert(
      fc.property(arbConfig, fc.integer({ min: 0, max: FRAME_COUNT - 1 }), (cfg, index) => {
        const s = cfg.ghost.SPRITE_SIZE;
        const r = sheetSource(cfg, index);
        expect(r.w).toBe(s);
        expect(r.h).toBe(s);
        expect(r.x).toBe(index * s);
        expect(r.y).toBe(0);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(FRAME_COUNT * s);
      }),
      { numRuns: 100 }
    );
  });

  it('sheet frames have identity transforms and source rectangles inside the strip', () => {
    fc.assert(
      fc.property(
        arbConfig,
        fc.double({ min: 0, max: 5000, noNaN: true }),
        fc.double({ min: -1000, max: 1000, noNaN: true }),
        (cfg, t, vy) => {
          const frames = [idleFrame(cfg, t, vy, true), flapFrame(cfg, t % 300, vy, true), deathFrame(cfg, t, true)];
          for (const f of frames) {
            expect(f.offsetY).toBe(0);
            expect(f.scaleX).toBe(1);
            expect(f.scaleY).toBe(1);
            expect(f.tint).toBe(false);
            expect(f.sheetIndex).toBeGreaterThanOrEqual(0);
            expect(f.sheetIndex).toBeLessThan(FRAME_COUNT);
            const r = sheetSource(cfg, f.sheetIndex);
            expect(r.x + r.w).toBeLessThanOrEqual(FRAME_COUNT * cfg.ghost.SPRITE_SIZE);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
