// Feature: flappy-kiro, Property 14: Ghost hitbox is a circle centered on the sprite
// **Validates: Requirements 3.4, 6.1**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbAnyConfig, arbGhost } from '../helpers/arbitraries.js';

import { ghostCircle } from '../../src/collision.js';
import { frameDest } from '../../src/animation.js';

const EPS = 1e-9;

const arbCase = arbAnyConfig.chain((cfg) =>
  fc.record({ cfg: fc.constant(cfg), ghost: arbGhost(cfg) })
);

describe('Property 14: ghost hitbox is a circle centered on the sprite', () => {
  it('is centered on (X, y) with radius HITBOX_RADIUS', () => {
    fc.assert(
      fc.property(arbCase, ({ cfg, ghost }) => {
        const c = ghostCircle(cfg, ghost);
        expect(c.cx).toBe(cfg.ghost.X);
        expect(c.cy).toBe(ghost.y);
        expect(c.r).toBe(cfg.ghost.HITBOX_RADIUS);
      }),
      { numRuns: 20 }
    );
  });

  it('is centered on the sprite square and fits inside it with the expected margin', () => {
    fc.assert(
      fc.property(arbCase, ({ cfg, ghost }) => {
        const c = ghostCircle(cfg, ghost);
        const s = frameDest(cfg, ghost);
        expect(c.cx).toBeCloseTo(s.x + s.w / 2, 9);
        expect(c.cy).toBeCloseTo(s.y + s.h / 2, 9);

        const margin = cfg.ghost.SPRITE_SIZE / 2 - cfg.ghost.HITBOX_RADIUS;
        expect(c.cx - c.r - s.x).toBeCloseTo(margin, 6);
        expect(s.x + s.w - (c.cx + c.r)).toBeCloseTo(margin, 6);
        expect(c.cy - c.r - s.y).toBeCloseTo(margin, 6);
        expect(s.y + s.h - (c.cy + c.r)).toBeCloseTo(margin, 6);
        expect(c.cx - c.r).toBeGreaterThanOrEqual(s.x - EPS);
        expect(c.cy + c.r).toBeLessThanOrEqual(s.y + s.h + EPS);
      }),
      { numRuns: 20 }
    );
  });
});
