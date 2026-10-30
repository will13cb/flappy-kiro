// Feature: flappy-kiro, Property 13: Scoring counts each passed pair once
// **Validates: Requirements 5.1, 5.4, 5.5**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbConfig, arbPipes, arbDt, rng } from '../helpers/arbitraries.js';
import { buildState } from '../helpers/game-arbs.js';

import { update } from '../../src/game.js';

const arbCase = arbConfig.chain((cfg) =>
  fc.record({
    cfg: fc.constant(cfg),
    pipes: arbPipes(cfg),
    invincible: fc.boolean(),
    dts: fc.array(arbDt(cfg), { minLength: 1, maxLength: 40 }),
    seed: fc.integer({ min: 1, max: 2 ** 31 }),
  })
);

describe('Property 13: scoring counts each passed pair once', () => {
  it('adds exactly 1 per newly passed pair and never scores a pair twice', () => {
    fc.assert(
      fc.property(arbCase, ({ cfg, pipes, invincible, dts, seed }) => {
        // Tag each initial pair so it can be followed across updates.
        const tagged = pipes.map((p, id) => ({ ...p, id }));
        const state = buildState(cfg, 'Playing', {
          pipes: tagged,
          invincibleMs: invincible ? 1e9 : 0,
          ghost: { y: (cfg.world.GROUND_TOP) / 2, vy: 0 },
          rng: rng(seed),
        });
        const random = rng(seed);
        const everScored = new Set(tagged.filter((p) => p.scored).map((p) => p.id));

        for (const dt of dts) {
          if (state.mode !== 'Playing') break;
          const scoreBefore = state.score;
          const scoredBefore = new Set(everScored);
          const events = update(state, dt, { rng: random });

          // Pairs that flipped to scored during this update (tagged or spawned).
          const flipped = state.pipes.filter(
            (p) => p.scored && (p.id === undefined || !scoredBefore.has(p.id))
          );
          const scoredEvents = events.filter((e) => e.type === 'scored').length;

          expect(state.score - scoreBefore).toBe(flipped.length);
          expect(scoredEvents).toBe(flipped.length);

          for (const p of flipped) {
            // Only pairs whose right edge the ghost center has passed score.
            expect(p.x + cfg.pipes.CAP_WIDTH).toBeLessThan(cfg.ghost.X);
            if (p.id !== undefined) everScored.add(p.id);
          }
          // Every surviving pair that has been passed is scored (nothing missed).
          for (const p of state.pipes) {
            if (p.x + cfg.pipes.CAP_WIDTH < cfg.ghost.X) expect(p.scored).toBe(true);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('does not score again when updating with pairs already scored', () => {
    fc.assert(
      fc.property(arbConfig, fc.integer({ min: 0, max: 20 }), (cfg, score) => {
        const pipes = [{ x: -cfg.pipes.CAP_WIDTH - 1 + 0.5 * 0, gapCenter: cfg.pipes.GAP_CENTER_MIN, scored: true }];
        const state = buildState(cfg, 'Playing', {
          pipes,
          score,
          invincibleMs: 1e9,
          ghost: { y: cfg.world.GROUND_TOP / 2, vy: 0 },
        });
        const events = update(state, 0.001, { rng: rng(1) });
        expect(events.filter((e) => e.type === 'scored')).toHaveLength(0);
        expect(state.score).toBe(score);
      }),
      { numRuns: 100 }
    );
  });
});
