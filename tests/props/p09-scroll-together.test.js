// Feature: flappy-kiro, Property 9: Pipes and ground scroll together
// **Validates: Requirements 4.8, 4.11, 9.6**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbAnyConfig, arbDt, rng } from '../helpers/arbitraries.js';
import { arbGameState } from '../helpers/game-arbs.js';

import { update } from '../../src/game.js';

const EPS = 1e-6;

const arbCase = arbAnyConfig.chain((cfg) =>
  fc.record({
    cfg: fc.constant(cfg),
    state: arbGameState(cfg, 'Playing'),
    speed: fc.double({ min: 0.1, max: cfg.speed.MAX_SPEED, noNaN: true, noDefaultInfinity: true }),
    dt: arbDt(cfg),
    seed: fc.integer({ min: 1, max: 2 ** 31 }),
  })
);

describe('Property 9: pipes and ground scroll together', () => {
  it('moves every pipe pair and the ground left by exactly speed * dt', () => {
    fc.assert(
      fc.property(arbCase, ({ cfg, state, speed, dt, seed }) => {
        state.speed = speed;
        const before = structuredClone(state.pipes);
        const groundBefore = state.groundOffset;
        const d = speed * dt;

        update(state, dt, { rng: rng(seed) });

        // Ground advanced by exactly speed * dt.
        expect(Math.abs(state.groundOffset - groundBefore - d)).toBeLessThanOrEqual(EPS);

        // Every old pair either moved left by exactly d, or was removed after leaving the screen.
        let j = 0;
        for (const old of before) {
          const expectedX = old.x - d;
          const cur = state.pipes[j];
          if (cur && cur.gapCenter === old.gapCenter && Math.abs(cur.x - expectedX) <= EPS) {
            j++;
          } else {
            expect(expectedX + cfg.pipes.CAP_WIDTH).toBeLessThan(EPS);
          }
        }
      }),
      { numRuns: 20 }
    );
  });
});
