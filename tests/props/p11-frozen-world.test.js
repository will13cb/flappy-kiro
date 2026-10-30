// Feature: flappy-kiro, Property 11: World is frozen outside Playing
// **Validates: Requirements 2.3, 4.13, 7.3, 13.8, 14.4, 14.6, 14.7**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createRequire } from 'module';
import { DEFAULT_CONFIG as cfg, arbDt, rng } from '../helpers/arbitraries.js';
import { arbGameState } from '../helpers/game-arbs.js';

const require = createRequire(import.meta.url);
const { update, handleInput } = require('../../src/game.js');

const arbDts = fc.array(arbDt(cfg), { minLength: 1, maxLength: 30 });

const world = (s) =>
  structuredClone({
    pipes: s.pipes,
    groundOffset: s.groundOffset,
    clouds: s.clouds,
    score: s.score,
    speed: s.speed,
  });

const runUpdates = (state, dts, seed = 1) => {
  const deps = { rng: rng(seed) };
  for (const dt of dts) update(state, dt, deps);
};

describe('Property 11: world is frozen outside Playing', () => {
  for (const mode of ['Main_Menu', 'Paused', 'Game_Over']) {
    it(`keeps pipes, ground, clouds, score and speed unchanged in ${mode}`, () => {
      fc.assert(
        fc.property(arbGameState(cfg, mode), arbDts, (state, dts) => {
          const before = world(state);
          runUpdates(state, dts);
          expect(state.mode).toBe(mode);
          expect(world(state)).toEqual(before);
        }),
        { numRuns: 100 }
      );
    });
  }

  it('keeps the ghost at MENU_GHOST_Y in Main_Menu', () => {
    fc.assert(
      fc.property(arbGameState(cfg, 'Main_Menu'), arbDts, (state, dts) => {
        runUpdates(state, dts);
        expect(state.ghost.y).toBe(cfg.world.MENU_GHOST_Y);
      }),
      { numRuns: 100 }
    );
  });

  it('keeps ghost, invincibility, flap timer and animation clock unchanged in Paused', () => {
    fc.assert(
      fc.property(arbGameState(cfg, 'Paused'), arbDts, (state, dts) => {
        const before = structuredClone({
          ghost: state.ghost,
          invincibleMs: state.invincibleMs,
          flapMs: state.flapMs,
          animClockMs: state.animClockMs,
        });
        runUpdates(state, dts);
        expect({
          ghost: state.ghost,
          invincibleMs: state.invincibleMs,
          flapMs: state.flapMs,
          animClockMs: state.animClockMs,
        }).toEqual(before);
      }),
      { numRuns: 100 }
    );
  });

  it('pausing then resuming leaves the state equal to the state before the pause', () => {
    fc.assert(
      fc.property(arbGameState(cfg, 'Playing'), arbDts, (state, dts) => {
        const before = structuredClone(state);
        handleInput(state, { kind: 'pause' }, { rng: rng(1) });
        expect(state.mode).toBe('Paused');
        runUpdates(state, dts);
        handleInput(state, { kind: 'pause' }, { rng: rng(1) });
        expect(state).toEqual(before);
      }),
      { numRuns: 100 }
    );
  });
});
