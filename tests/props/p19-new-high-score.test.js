// Feature: flappy-kiro, Property 19: New high score indication
// **Validates: Requirements 7.6, 17.11**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DEFAULT_CONFIG as cfg, arbScore, arbDt, rng } from '../helpers/arbitraries.js';
import { buildState } from '../helpers/game-arbs.js';

import { update } from '../../src/game.js';

describe('Property 19: new high score indication', () => {
  it('sets newHighScore iff score > previous high score when the ghost crashes', () => {
    fc.assert(
      fc.property(arbScore, arbScore, (score, highScore) => {
        const state = buildState(cfg, 'Playing', {
          score,
          highScore,
          pipes: [],
          ghost: { y: cfg.world.GROUND_TOP - 1, vy: 500 },
          invincibleMs: 0,
        });
        const events = update(state, 0.016, { rng: rng(1) });
        const over = events.find((e) => e.type === 'gameOver');
        expect(state.mode).toBe('Game_Over');
        expect(over).toBeDefined();
        expect(over.previousHighScore).toBe(highScore);
        expect(state.newHighScore).toBe(over.score > highScore);
      }),
      { numRuns: 100 }
    );
  });

  it('never changes newHighScore during Game_Over updates, whatever its starting value', () => {
    fc.assert(
      fc.property(
        arbScore,
        arbScore,
        fc.boolean(),
        fc.array(arbDt(cfg), { minLength: 1, maxLength: 20 }),
        (score, highScore, flag, dts) => {
          const state = buildState(cfg, 'Game_Over', { score, highScore, newHighScore: flag });
          for (const dt of dts) update(state, dt, { rng: rng(1) });
          expect(state.newHighScore).toBe(flag);
        }
      ),
      { numRuns: 100 }
    );
  });
});
