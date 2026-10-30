// Feature: flappy-kiro, Property 6: Pipe pair geometry
// **Validates: Requirements 4.3, 4.4, 6.2**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createRequire } from 'module';
import { arbConfig, arbPipe } from '../helpers/arbitraries.js';

const require = createRequire(import.meta.url);
const { pipeRects } = require('../../src/pipes.js');

const arbCfgAndPipe = arbConfig.chain((cfg) => fc.tuple(fc.constant(cfg), arbPipe(cfg)));

describe('Property 6: pipe pair geometry', () => {
  it('builds bodies and caps around a gap of exactly GAP_HEIGHT', () => {
    fc.assert(
      fc.property(arbCfgAndPipe, ([cfg, pair]) => {
        const p = cfg.pipes;
        const [topBody, topCap, bottomBody, bottomCap] = pipeRects(cfg, pair);

        // Body and cap dimensions.
        expect(topBody.w).toBe(p.PIPE_WIDTH);
        expect(bottomBody.w).toBe(p.PIPE_WIDTH);
        [topCap, bottomCap].forEach((c) => {
          expect(c.w).toBe(p.CAP_WIDTH);
          expect(c.h).toBe(p.CAP_HEIGHT);
          expect(c.x).toBe(pair.x);
        });

        // Bodies sit inside the cap's horizontal extent.
        [topBody, bottomBody].forEach((b) => {
          expect(b.x).toBe(pair.x + p.CAP_INSET);
          expect(b.x).toBeGreaterThanOrEqual(pair.x);
          expect(b.x + b.w).toBeLessThanOrEqual(pair.x + p.CAP_WIDTH + 1e-9);
        });

        // The gap between the caps is exactly GAP_HEIGHT, centered on gapCenter.
        const gapTop = topCap.y + topCap.h;
        const gapBottom = bottomCap.y;
        expect(gapBottom - gapTop).toBeCloseTo(p.GAP_HEIGHT, 9);
        expect((gapTop + gapBottom) / 2).toBeCloseTo(pair.gapCenter, 9);

        // Bodies are attached to the outer edges of the caps.
        if (topCap.y >= 0) {
          expect(topBody.y).toBe(0);
          expect(topBody.y + topBody.h).toBe(topCap.y);
        }
        expect(bottomBody.y).toBe(bottomCap.y + bottomCap.h);
        if (bottomBody.h > 0) {
          expect(bottomBody.y + bottomBody.h).toBe(cfg.world.GROUND_TOP);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('keeps GAP_HEIGHT greater than 2 * HITBOX_RADIUS', () => {
    fc.assert(
      fc.property(arbConfig, (cfg) => {
        expect(cfg.pipes.GAP_HEIGHT).toBeGreaterThan(2 * cfg.ghost.HITBOX_RADIUS);
      }),
      { numRuns: 100 }
    );
  });

  it('hitbox of each pipe is the union of its body and cap (4 rects, none inside the gap)', () => {
    fc.assert(
      fc.property(arbCfgAndPipe, ([cfg, pair]) => {
        const rects = pipeRects(cfg, pair);
        expect(rects).toHaveLength(4);
        const gapTop = pair.gapCenter - cfg.pipes.GAP_HEIGHT / 2;
        const gapBottom = pair.gapCenter + cfg.pipes.GAP_HEIGHT / 2;
        // Top pipe (body + cap) ends at gapTop; bottom pipe (body + cap) starts at gapBottom.
        [rects[0], rects[1]].forEach((r) => expect(r.y + r.h).toBeLessThanOrEqual(gapTop + 1e-9));
        [rects[2], rects[3]].forEach((r) => expect(r.y).toBeGreaterThanOrEqual(gapBottom - 1e-9));
      }),
      { numRuns: 100 }
    );
  });
});
