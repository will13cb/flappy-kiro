// Feature: flappy-kiro, Property 20: Game over input lockout
// **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 15.7**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DEFAULT_CONFIG as cfg, rng } from '../helpers/arbitraries.js';
import { buildState, arbPointerInput, controlRects } from '../helpers/game-arbs.js';

import { update, handleInput } from '../../src/game.js';

const LOCKOUT = cfg.timing.LOCKOUT_MS;
const MAX_DT = cfg.timing.MAX_FRAME_MS; // ms

// Jump_Input: Space, Enter, or any pointer (including RESTART).
const arbJumpInput = fc.oneof(
  fc.constantFrom('space', 'enter').map((kind) => ({ kind })),
  arbPointerInput(cfg)
);
const menuRect = controlRects(cfg).find((r) => r.name === 'MENU');
const onMenu = (p) => p.x >= menuRect.x && p.x < menuRect.x + menuRect.w && p.y >= menuRect.y && p.y < menuRect.y + menuRect.h;
// Inputs that restart once unlocked: everything except a pointer on MENU.
const arbRestartInput = arbJumpInput.filter((i) => i.kind !== 'pointer' || !onMenu(i));

// A Game_Over state that has just begun, aged by `elapsed` whole ms in frames of at most MAX_DT.
const ageGameOver = (seed, elapsed, chunks) => {
  const state = buildState(cfg, 'Game_Over', {
    rng: rng(seed),
    lockoutMs: LOCKOUT,
    crashMs: cfg.timing.CRASH_MS,
  });
  const deps = { rng: rng(seed) };
  let left = elapsed;
  while (left > 0) {
    const dt = Math.min(left, MAX_DT, chunks);
    update(state, dt / 1000, deps); // update takes seconds
    left -= dt;
  }
  return state;
};

const arbSeed = fc.integer({ min: 1, max: 2 ** 31 });
const arbChunk = fc.integer({ min: 1, max: MAX_DT });

describe('Property 20: game over input lockout', () => {
  it('ignores every Jump_Input and emits no event while elapsed < LOCKOUT_MS', () => {
    fc.assert(
      fc.property(
        arbSeed,
        fc.integer({ min: 0, max: LOCKOUT - 1 }),
        arbChunk,
        arbJumpInput,
        (seed, elapsed, chunk, input) => {
          const state = ageGameOver(seed, elapsed, chunk);
          expect(state.mode).toBe('Game_Over');
          const before = structuredClone(state);
          const events = handleInput(state, input, { rng: rng(seed) });
          expect(events || []).toEqual([]);
          expect(state).toEqual(before);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('restarts with exactly one jump event once elapsed >= LOCKOUT_MS', () => {
    fc.assert(
      fc.property(
        arbSeed,
        fc.integer({ min: LOCKOUT, max: LOCKOUT * 3 }),
        arbChunk,
        arbRestartInput,
        (seed, elapsed, chunk, input) => {
          const state = ageGameOver(seed, elapsed, chunk);
          expect(state.mode).toBe('Game_Over');
          const events = handleInput(state, input, { rng: rng(seed) });
          expect(state.mode).toBe('Playing');
          expect(events.filter((e) => e.type === 'jump')).toHaveLength(1);
          expect(events).toHaveLength(1);
        }
      ),
      { numRuns: 20 }
    );
  });
  it('keeps the panel readable: input unlocks after the panel appears', () => {
    expect(cfg.timing.LOCKOUT_MS).toBeGreaterThan(cfg.timing.CRASH_MS);
  });
  it('a pointer on MENU leaves for Main_Menu once unlocked, and is ignored before', () => {
    fc.assert(
      fc.property(arbSeed, arbChunk, (seed, chunk) => {
        const input = { kind: 'pointer', x: menuRect.x + 1, y: menuRect.y + 1 };
        const locked = ageGameOver(seed, LOCKOUT - 1, chunk);
        handleInput(locked, input, { rng: rng(seed) });
        expect(locked.mode).toBe('Game_Over');
        const open = ageGameOver(seed, LOCKOUT, chunk);
        expect(handleInput(open, input, { rng: rng(seed) })).toEqual([]);
        expect(open.mode).toBe('Main_Menu');
      }),
      { numRuns: 20 }
    );
  });
});
