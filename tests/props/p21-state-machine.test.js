// Feature: flappy-kiro, Property 21: State machine only takes permitted transitions
// **Validates: Requirements 10.6, 12.3, 14.1, 14.2, 14.8, 15.2, 15.3, 15.4, 15.5, 15.8, 15.9, 17.5, 17.6**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DEFAULT_CONFIG as cfg, rng } from '../helpers/arbitraries.js';
import {
  arbAnyGameState,
  arbGameState,
  arbSteps,
  arbPointerInput,
  buildState,
  controlRects,
  runSteps,
} from '../helpers/game-arbs.js';

import { handleInput } from '../../src/game.js';

const PERMITTED = new Set([
  'Main_Menu>Playing',
  'Playing>Paused',
  'Paused>Playing',
  'Playing>Game_Over',
  'Game_Over>Playing',
  'Game_Over>Main_Menu',
]);

const send = (state, input) => handleInput(state, input, { rng: rng(1) });
const center = (name) => {
  const r = controlRects(cfg).find((c) => c.name === name);
  return { kind: 'pointer', x: r.x + r.w / 2, y: r.y + r.h / 2 };
};
const arbPause = fc.constantFrom({ kind: 'pause' });
const arbJump = fc.oneof(
  fc.constantFrom('space', 'enter', 'up', 'down', 'hidden').map((kind) => ({ kind })),
  arbPointerInput(cfg).filter((p) => {
    const hit = controlRects(cfg).some(
      (r) => (r.name === 'MUTE' || r.name === 'PAUSE') && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h
    );
    return !hit;
  })
);

describe('Property 21: state machine only takes permitted transitions', () => {
  it('every observed mode change is one of the six permitted transitions', () => {
    fc.assert(
      fc.property(arbAnyGameState(cfg), arbSteps(cfg, 40), fc.integer({ min: 1, max: 1000 }), (state, steps, seed) => {
        const { transitions } = runSteps(state, steps, seed);
        for (const t of transitions) {
          expect(PERMITTED.has(`${t.from}>${t.to}`)).toBe(true);
        }
      }),
      { numRuns: 20 }
    );
  });

  it('ignores Pause_Input in Main_Menu and Game_Over', () => {
    for (const mode of ['Main_Menu', 'Game_Over']) {
      fc.assert(
        fc.property(arbGameState(cfg, mode), arbPause, (state, input) => {
          const before = structuredClone(state);
          send(state, input);
          expect(state).toEqual(before);
        }),
        { numRuns: 20 }
      );
    }
  });

  it('ignores Jump_Input in Paused', () => {
    fc.assert(
      fc.property(arbGameState(cfg, 'Paused'), arbJump, (state, input) => {
        const before = structuredClone(state);
        const events = send(state, input);
        expect(state).toEqual(before);
        expect(events ?? []).toEqual([]);
      }),
      { numRuns: 20 }
    );
  });

  it('changes Playing to Paused on a hidden tab and keeps Paused on a hidden tab', () => {
    fc.assert(
      fc.property(arbGameState(cfg, 'Playing'), (state) => {
        send(state, { kind: 'hidden' });
        expect(state.mode).toBe('Paused');
        send(state, { kind: 'hidden' });
        expect(state.mode).toBe('Paused');
      }),
      { numRuns: 20 }
    );
  });

  it('opens and closes the High_Scores_Panel without changing the mode', () => {
    const openers = [{ kind: 'space' }, { kind: 'enter' }, center('HIGH_SCORES')];
    const closers = [{ kind: 'space' }, { kind: 'enter' }, center('BACK')];
    fc.assert(
      fc.property(fc.constantFrom(...openers), fc.constantFrom(...closers), (open, close) => {
        const state = buildState(cfg, 'Main_Menu', { selected: 'HIGH_SCORES' });
        send(state, open);
        expect(state.mode).toBe('Main_Menu');
        expect(state.menu.panelOpen).toBe(true);
        send(state, close);
        expect(state.mode).toBe('Main_Menu');
        expect(state.menu.panelOpen).toBe(false);
      }),
      { numRuns: 20 }
    );
  });
});
