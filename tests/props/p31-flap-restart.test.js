// Feature: flappy-kiro, Property 31: Flap restarts on every jump
// **Validates: Requirements 18.3**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createRequire } from 'module';
import { DEFAULT_CONFIG as cfg, rng } from '../helpers/arbitraries.js';
import { arbGameState } from '../helpers/game-arbs.js';

const require = createRequire(import.meta.url);
const { handleInput, startRound } = require('../../src/game.js');
const { currentFrame } = require('../../src/animation.js');

const arbFlapMs = fc.oneof(
  fc.constant(null),
  fc.double({ min: 0, max: cfg.animation.FLAP_TOTAL_MS * 2, noNaN: true })
);

describe('Property 31: flap restarts on every jump', () => {
  it('a space jump in Playing resets flapMs to 0 and shows flap frame 0', () => {
    fc.assert(
      fc.property(arbGameState(cfg, 'Playing'), arbFlapMs, (state, flapMs) => {
        state.flapMs = flapMs;
        const events = handleInput(state, { kind: 'space' }, { rng: rng(1) });
        expect(events).toEqual([{ type: 'jump' }]);
        expect(state.flapMs).toBe(0);
        const frame = currentFrame(state, false);
        expect(frame.anim).toBe('flap');
        expect(frame.index).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('starting a round resets flapMs to 0 and shows flap frame 0', () => {
    fc.assert(
      fc.property(arbGameState(cfg, 'Game_Over'), arbFlapMs, (state, flapMs) => {
        state.flapMs = flapMs;
        startRound(state, rng(1));
        expect(state.mode).toBe('Playing');
        expect(state.flapMs).toBe(0);
        const frame = currentFrame(state, false);
        expect(frame.anim).toBe('flap');
        expect(frame.index).toBe(0);
      }),
      { numRuns: 100 }
    );
  });
});
