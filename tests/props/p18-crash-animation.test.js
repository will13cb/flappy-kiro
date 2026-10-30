// Feature: flappy-kiro, Property 18: Crash animation stays above the ground
// **Validates: Requirements 7.2, 7.4**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createRequire } from 'module';
import { DEFAULT_CONFIG as cfg, arbDt, rng } from '../helpers/arbitraries.js';
import { buildState } from '../helpers/game-arbs.js';

const require = createRequire(import.meta.url);
const { update } = require('../../src/game.js');

const floorY = cfg.world.GROUND_TOP - cfg.ghost.HITBOX_RADIUS;
const arbDts = fc.array(arbDt(cfg), { minLength: 1, maxLength: 60 });
const arbY = fc.double({ min: 0, max: floorY, noNaN: true });
const arbVy = fc.double({ min: -1000, max: 1000, noNaN: true });

const crashed = (y, vy) =>
  buildState(cfg, 'Game_Over', {
    ghost: { y, vy },
    crashMs: cfg.timing.CRASH_MS,
    lockoutMs: cfg.timing.LOCKOUT_MS,
    deathMs: 0,
  });

describe('Property 18: crash animation stays above the ground', () => {
  it('never moves the circle bottom below GROUND_TOP and ends the crash after CRASH_MS', () => {
    fc.assert(
      fc.property(arbY, arbVy, arbDts, (y, vy, dts) => {
        const state = crashed(y, vy);
        const deps = { rng: rng(1) };
        let elapsed = 0;
        for (const dt of dts) {
          update(state, dt, deps);
          elapsed += dt * 1000;
          expect(state.mode).toBe('Game_Over');
          expect(state.ghost.y + cfg.ghost.HITBOX_RADIUS).toBeLessThanOrEqual(cfg.world.GROUND_TOP + 1e-9);
          expect(state.crashMs).toBeGreaterThanOrEqual(0);
          if (elapsed >= cfg.timing.CRASH_MS + 1e-6) expect(state.crashMs).toBe(0);
          if (elapsed < cfg.timing.CRASH_MS - 1e-6) expect(state.crashMs).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('after a real ground collision in Playing, the crash starts at CRASH_MS and stays above the ground', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), arbDts, (seed, dts) => {
        const state = buildState(cfg, 'Playing', {
          rng: rng(seed),
          ghost: { y: floorY, vy: 500 },
          pipes: [],
          invincibleMs: 0,
        });
        const deps = { rng: rng(seed) };
        update(state, 0.016, deps);
        if (state.mode !== 'Game_Over') return; // no hit this frame; nothing to assert
        expect(state.crashMs).toBe(cfg.timing.CRASH_MS);
        expect(state.deathMs).toBe(0);
        for (const dt of dts) {
          update(state, dt, deps);
          expect(state.ghost.y + cfg.ghost.HITBOX_RADIUS).toBeLessThanOrEqual(cfg.world.GROUND_TOP + 1e-9);
        }
      }),
      { numRuns: 50 }
    );
  });
});
