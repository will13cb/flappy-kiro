// Feature: flappy-kiro, Property 17: Invincibility timer and blink
// **Validates: Requirements 7.8, 7.11, 7.12, 7.13**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DEFAULT_CONFIG as cfg, arbDt } from '../helpers/arbitraries.js';
import { arbGameState, buildState } from '../helpers/game-arbs.js';
import { rng } from '../helpers/arbitraries.js';

import { update } from '../../src/game.js';
import { ghostHidden } from '../../src/renderer.js';

const { INVINCIBILITY_MS, BLINK_MS } = cfg.timing;
const arbDts = fc.array(arbDt(cfg), { minLength: 1, maxLength: 120 });

describe('Property 17: invincibility timer and blink', () => {
  it('never increases, reaches 0 once INVINCIBILITY_MS elapsed, and is 0 in Game_Over', () => {
    fc.assert(
      fc.property(arbGameState(cfg, 'Playing'), arbDts, fc.integer({ min: 1, max: 1000 }), (state, dts, seed) => {
        const deps = { rng: rng(seed) };
        state.invincibleMs = INVINCIBILITY_MS;
        let elapsed = 0;
        for (const dt of dts) {
          const wasPlaying = state.mode === 'Playing';
          const before = state.invincibleMs;
          update(state, dt, deps);
          if (!wasPlaying) break;
          elapsed += dt * 1000;
          expect(state.invincibleMs).toBeLessThanOrEqual(before);
          if (state.mode === 'Playing' && elapsed >= INVINCIBILITY_MS + 1e-6) {
            expect(state.invincibleMs).toBe(0);
          }
          if (state.mode === 'Game_Over') {
            expect(state.invincibleMs).toBe(0);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('keeps invincibility at 0 through the whole Game_Over phase', () => {
    fc.assert(
      fc.property(arbGameState(cfg, 'Game_Over'), arbDts, (state, dts) => {
        for (const dt of dts) {
          update(state, dt, { rng: rng(1) });
          expect(state.invincibleMs).toBe(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('hides the ghost by the parity of the BLINK_MS interval index while active, shows it at 0', () => {
    fc.assert(
      fc.property(
        arbGameState(cfg, 'Playing'),
        fc.double({ min: 0, max: INVINCIBILITY_MS, noNaN: true, noDefaultInfinity: true }),
        (state, remaining) => {
          state.invincibleMs = remaining;
          if (remaining > 0) {
            const index = Math.floor((INVINCIBILITY_MS - remaining) / BLINK_MS);
            expect(ghostHidden(state)).toBe(index % 2 === 1);
          } else {
            expect(ghostHidden(state)).toBe(false);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('starts visible and alternates once per BLINK_MS interval', () => {
    const state = buildState(cfg, 'Playing', { invincibleMs: INVINCIBILITY_MS });
    const intervals = Math.floor(INVINCIBILITY_MS / BLINK_MS);
    for (let i = 0; i < intervals; i++) {
      state.invincibleMs = INVINCIBILITY_MS - (i * BLINK_MS + BLINK_MS / 2);
      if (state.invincibleMs <= 0) break;
      expect(ghostHidden(state)).toBe(i % 2 === 1);
    }
  });

  it('applies pipe collisions only after the timer reaches 0', () => {
    fc.assert(
      fc.property(
        arbDt(cfg),
        fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
        (dt, frac) => {
          const make = (invincibleMs) => {
            // Ghost mid-screen, pipe cap over the ghost column with its gap far above.
            const state = buildState(cfg, 'Playing', {
              invincibleMs,
              ghost: { y: cfg.world.MENU_GHOST_Y, vy: 0 },
              pipes: [{ x: cfg.ghost.X - cfg.pipes.CAP_WIDTH / 2, gapCenter: cfg.pipes.GAP_CENTER_MIN, scored: false }],
            });
            return state;
          };

          const active = make(INVINCIBILITY_MS * (0.5 + frac / 2) + dt * 1000);
          const events = update(active, dt, { rng: rng(1) });
          expect(active.mode).toBe('Playing');
          expect(events.some((e) => e.type === 'gameOver')).toBe(false);

          const expired = make(0);
          const over = update(expired, dt, { rng: rng(1) });
          expect(expired.mode).toBe('Game_Over');
          expect(over.some((e) => e.type === 'gameOver')).toBe(true);
          expect(expired.invincibleMs).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('a collision does not start a new invincibility period', () => {
    fc.assert(
      fc.property(arbGameState(cfg, 'Playing'), arbDts, (state, dts) => {
        state.invincibleMs = 0;
        for (const dt of dts) {
          update(state, dt, { rng: rng(1) });
          if (state.mode === 'Game_Over') break;
        }
        if (state.mode === 'Game_Over') expect(state.invincibleMs).toBe(0);
      }),
      { numRuns: 100 }
    );
  });
});
