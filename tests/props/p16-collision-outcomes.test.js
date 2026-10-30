// Feature: flappy-kiro, Property 16: Collision outcomes
// **Validates: Requirements 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 7.9, 7.10, 15.6**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createRequire } from 'module';
import { arbConfig, arbDt, arbGhost, arbPipes, rng } from '../helpers/arbitraries.js';
import { arbGameState } from '../helpers/game-arbs.js';

const require = createRequire(import.meta.url);
const collision = require('../../src/collision.js');
const { pipeRects } = require('../../src/pipes.js');
const { update } = require('../../src/game.js');

// Independent oracle for the pipe test.
function expectedPipeHit(cfg, ghost, pairs) {
  const circle = { cx: cfg.ghost.X, cy: ghost.y, r: cfg.ghost.HITBOX_RADIUS };
  return pairs.some((pair) => pipeRects(cfg, pair).some((r) => collision.circleHitsRect(circle, r)));
}

// A config with a ghost, pipes and an invincibility flag.
const arbDetect = arbConfig.chain((cfg) =>
  fc.record({
    cfg: fc.constant(cfg),
    ghost: arbGhost(cfg),
    pairs: arbPipes(cfg),
    invincible: fc.boolean(),
  })
);

// A Playing state, a dt and a seed.
const arbPlaying = arbConfig.chain((cfg) =>
  fc.record({
    cfg: fc.constant(cfg),
    state: arbGameState(cfg, 'Playing'),
    dt: arbDt(cfg),
    seed: fc.integer({ min: 1, max: 2 ** 31 }),
  })
);

describe('Property 16: collision outcomes', () => {
  it('reports ground, ceiling and pipe hits exactly as defined', () => {
    fc.assert(
      fc.property(arbDetect, ({ cfg, ghost, pairs, invincible }) => {
        const r = cfg.ghost.HITBOX_RADIUS;
        const hit = collision.detect(cfg, ghost, pairs, invincible);
        expect(hit.ground).toBe(ghost.y + r >= cfg.world.GROUND_TOP);
        expect(hit.ceiling).toBe(ghost.y - r <= 0);
        expect(hit.pipe).toBe(!invincible && expectedPipeHit(cfg, ghost, pairs));
      }),
      { numRuns: 200 }
    );
  });

  it('reports no collision for a circle inside a gap and clear of both boundaries', () => {
    const arbInGap = arbConfig.chain((cfg) => {
      const r = cfg.ghost.HITBOX_RADIUS;
      const half = cfg.pipes.GAP_HEIGHT / 2;
      return fc.record({
        cfg: fc.constant(cfg),
        gapCenter: fc.double({
          min: cfg.pipes.GAP_CENTER_MIN,
          max: cfg.pipes.GAP_CENTER_MAX,
          noNaN: true,
        }),
        f: fc.double({ min: 0, max: 1, noNaN: true }),
        // Pair placed so the ghost center is anywhere across the pair's horizontal extent.
        px: fc.double({
          min: cfg.ghost.X - cfg.pipes.CAP_WIDTH - 5,
          max: cfg.ghost.X + 5,
          noNaN: true,
        }),
        half: fc.constant(half),
        r: fc.constant(r),
      });
    });
    fc.assert(
      fc.property(arbInGap, ({ cfg, gapCenter, f, px, half, r }) => {
        // Gap interior available to the circle center, excluding the caps.
        // A tiny margin keeps floating point rounding from putting the circle on the edge.
        const lo = gapCenter - half + r + 1e-6;
        const hi = gapCenter + half - r - 1e-6;
        fc.pre(hi >= lo);
        const y = lo + f * (hi - lo);
        const ghost = { y, vy: 0 };
        // Keep only cases clear of both world boundaries.
        fc.pre(y - r > 0 && y + r < cfg.world.GROUND_TOP);
        const hit = collision.detect(cfg, ghost, [{ x: px, gapCenter }], false);
        expect(hit).toEqual({ pipe: false, ground: false, ceiling: false });
      }),
      { numRuns: 200 }
    );
  });

  it('makes update end in Game_Over exactly when detect reports a hit on the post-movement state', () => {
    fc.assert(
      fc.property(arbPlaying, ({ cfg, state, dt, seed }) => {
        const prevInvincible = state.invincibleMs;
        const prevHigh = state.highScore;
        const events = update(state, dt, { rng: rng(seed) });

        // Mirror update's order: the timer is decremented before the collision test.
        const invincible = Math.max(0, prevInvincible - dt * 1000) > 0;
        const expected = collision.detect(cfg, state.ghost, state.pipes, invincible);
        const anyHit = expected.pipe || expected.ground || expected.ceiling;

        const over = events.filter((e) => e.type === 'gameOver');
        if (anyHit) {
          expect(state.mode).toBe('Game_Over');
          expect(over).toHaveLength(1);
          expect(over[0]).toEqual({
            type: 'gameOver',
            score: state.score,
            previousHighScore: prevHigh,
          });
          expect(state.invincibleMs).toBe(0);
          expect(state.deathMs).toBe(0);
          expect(state.crashMs).toBe(cfg.timing.CRASH_MS);
          expect(state.lockoutMs).toBe(cfg.timing.LOCKOUT_MS);
          expect(state.newHighScore).toBe(state.score > prevHigh);
        } else {
          expect(state.mode).toBe('Playing');
          expect(over).toHaveLength(0);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('ignores pipes while invincible but still ends the round on ground or ceiling', () => {
    fc.assert(
      fc.property(arbPlaying, ({ cfg, state, dt, seed }) => {
        state.invincibleMs = cfg.timing.INVINCIBILITY_MS + dt * 1000 + 1;
        update(state, dt, { rng: rng(seed) });
        const g = collision.detect(cfg, state.ghost, state.pipes, true);
        expect(g.pipe).toBe(false);
        expect(state.mode).toBe(g.ground || g.ceiling ? 'Game_Over' : 'Playing');
      }),
      { numRuns: 200 }
    );
  });
});
