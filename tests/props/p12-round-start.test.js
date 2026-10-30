// Feature: flappy-kiro, Property 12: Round start resets the round
// **Validates: Requirements 2.2, 4.9, 4.14, 5.3, 7.7, 8.2, 17.4**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createRequire } from 'module';
import { arbConfig, rng } from '../helpers/arbitraries.js';
import { arbGameState, arbPointerInput, controlRects, runInputs } from '../helpers/game-arbs.js';

const require = createRequire(import.meta.url);
const physics = require('../../src/physics.js');

const inside = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

// Config, a start-capable state (Main_Menu with closed panel, or Game_Over past lockout)
// and every input that starts a round from that state.
const arbCase = arbConfig.chain((cfg) =>
  fc
    .constantFrom('Main_Menu', 'Game_Over')
    .chain((mode) =>
      arbGameState(cfg, mode).map((state) => {
        if (mode === 'Main_Menu') {
          state.menu = { selected: 'PLAY', panelOpen: false };
        } else {
          state.lockoutMs = 0;
        }
        return state;
      })
    )
    .chain((state) => {
      const rects = controlRects(cfg);
      const play = rects.find((r) => r.name === 'PLAY');
      const playPoint = { kind: 'pointer', x: play.x + play.w / 2, y: play.y + play.h / 2 };
      const paths = [{ kind: 'space' }, { kind: 'enter' }];
      if (state.mode === 'Main_Menu') {
        paths.push(playPoint);
        return fc
          .tuple(arbPointerInput(cfg).filter((p) => !rects.some((r) => inside(r, p.x, p.y))))
          .map(([empty]) => ({ cfg, state, inputs: paths.concat([empty]) }));
      }
      return arbPointerInput(cfg).map((p) => ({ cfg, state, inputs: paths.concat([p]) }));
    })
);

describe('Property 12: round start resets the round', () => {
  it('every start path yields the same fresh Playing state and a jump event', () => {
    fc.assert(
      fc.property(arbCase, fc.integer({ min: 1, max: 1000 }), ({ cfg, state, inputs }, seed) => {
        const results = inputs.map((input) => {
          const s = structuredClone(state);
          const { events } = runInputs(s, [input], seed);
          return { s, events };
        });

        for (const { s, events } of results) {
          expect(s.mode).toBe('Playing');
          expect(s.score).toBe(0);
          expect(s.speed).toBe(cfg.speed.INITIAL_SPEED);
          expect(s.pipes).toEqual([]);
          expect(s.invincibleMs).toBe(cfg.timing.INVINCIBILITY_MS);
          expect(s.ghost.vy).toBe(physics.applyJump(cfg, { y: 0, vy: 0 }).vy);
          expect(s.ghost.vy).toBe(cfg.ghost.JUMP_VELOCITY);
          expect(s.flapMs).toBe(0);
          expect(s.menu.panelOpen).toBe(false);
          expect(events).toEqual([{ type: 'jump' }]);
        }

        for (const { s } of results.slice(1)) {
          expect(s).toEqual(results[0].s);
        }
      }),
      { numRuns: 100 }
    );
  });
});
