// Game-level fast-check generators and a runner for Flappy Kiro tests.
// handleInput and update are looked up at call time, so this module loads before they exist.
import fc from 'fast-check';
import { createRequire } from 'module';
import { DEFAULT_CONFIG, arbGhost, arbPipes, arbScore, arbDt, rng } from './arbitraries.js';

const require = createRequire(import.meta.url);
const menu = require('../../src/menu.js');

export const MODES = ['Main_Menu', 'Playing', 'Paused', 'Game_Over'];
export const BUTTON_NAMES = ['PLAY', 'HIGH_SCORES', 'BACK', 'RESTART'];
export const ICON_NAMES = ['MUTE', 'PAUSE'];

// Resolved when called, never at import time.
function gameApi() {
  return require('../../src/game.js');
}

// Every control rectangle from the config: { name, x, y, w, h }.
export function controlRects(cfg = DEFAULT_CONFIG) {
  const rects = BUTTON_NAMES.map((name) => ({ name, ...menu.buttonRect(cfg, name) }));
  return rects.concat(ICON_NAMES.map((name) => ({ name, ...menu.iconRect(cfg, name) })));
}

// Half-open containment, same rule as menu.js.
function inside(r, x, y) {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

// Fractions in [0, 1), so offsets stay strictly inside the half-open rectangle.
const arbFraction = fc.integer({ min: 0, max: 999 }).map((n) => n / 1000);

// Point inside one control rectangle, including its top-left corner.
function arbPointInRect(r) {
  return fc.oneof(
    fc.constant({ x: r.x, y: r.y }),
    fc.tuple(arbFraction, arbFraction).map(([fx, fy]) => ({ x: r.x + fx * r.w, y: r.y + fy * r.h }))
  );
}

// Point outside every control rectangle: edges just beyond a rectangle, or anywhere near the world.
function arbPointOutside(cfg, rects) {
  const edge = fc
    .tuple(fc.constantFrom(...rects), fc.constantFrom('right', 'bottom', 'left', 'top'), arbFraction)
    .map(([r, side, f]) => {
      if (side === 'right') return { x: r.x + r.w, y: r.y + f * r.h };
      if (side === 'bottom') return { x: r.x + f * r.w, y: r.y + r.h };
      if (side === 'left') return { x: r.x - 0.001, y: r.y + f * r.h };
      return { x: r.x + f * r.w, y: r.y - 0.001 };
    });
  const anywhere = fc.record({
    x: fc.double({ min: -50, max: cfg.world.WIDTH + 50, noNaN: true, noDefaultInfinity: true }),
    y: fc.double({ min: -50, max: cfg.world.HEIGHT + 50, noNaN: true, noDefaultInfinity: true }),
  });
  return fc.oneof(edge, anywhere).filter((p) => !rects.some((r) => inside(r, p.x, p.y)));
}

// Pointer input with points inside and outside every control rectangle.
export function arbPointerInput(cfg = DEFAULT_CONFIG) {
  const rects = controlRects(cfg);
  return fc
    .oneof(
      { weight: 3, arbitrary: fc.constantFrom(...rects).chain((r) => arbPointInRect(r)) },
      { weight: 2, arbitrary: arbPointOutside(cfg, rects) }
    )
    .map((p) => ({ kind: 'pointer', x: p.x, y: p.y }));
}

export function arbInput(cfg = DEFAULT_CONFIG) {
  return fc.oneof(
    { weight: 5, arbitrary: fc.constantFrom('space', 'enter', 'up', 'down', 'pause', 'hidden').map((kind) => ({ kind })) },
    { weight: 4, arbitrary: arbPointerInput(cfg) }
  );
}

export function arbInputSequence(cfg = DEFAULT_CONFIG, maxLength = 30) {
  return fc.array(arbInput(cfg), { minLength: 0, maxLength });
}

const arbMs = (max) => fc.double({ min: 0, max, noNaN: true, noDefaultInfinity: true });

// Builds a real state with createGame, then overrides it for the requested mode.
// extra: { rng, highScore, ghost, pipes, score, invincibleMs, crashMs, lockoutMs, deathMs, newHighScore, panelOpen, selected }
export function buildState(cfg, mode, extra = {}) {
  const { createGame } = gameApi();
  const state = createGame(cfg, extra.highScore || 0, extra.rng || rng(1));
  state.mode = mode;
  if (mode === 'Main_Menu') {
    state.menu = { selected: extra.selected || 'PLAY', panelOpen: !!extra.panelOpen };
    return state;
  }
  state.menu = { selected: 'PLAY', panelOpen: false };
  state.ghost = extra.ghost || { y: cfg.world.MENU_GHOST_Y, vy: 0 };
  state.pipes = extra.pipes || [];
  state.score = extra.score || 0;
  state.flapMs = extra.flapMs === undefined ? 0 : extra.flapMs;
  if (mode === 'Playing' || mode === 'Paused') {
    state.invincibleMs = extra.invincibleMs || 0;
  }
  if (mode === 'Game_Over') {
    state.invincibleMs = 0;
    state.crashMs = extra.crashMs || 0;
    state.lockoutMs = extra.lockoutMs || 0;
    state.deathMs = extra.deathMs || 0;
    state.newHighScore = !!extra.newHighScore;
    state.flapMs = null;
  }
  return state;
}

// Game state in the given mode. Ghost and pipes are arbitrary; Game_Over covers lockout active and over.
export function arbGameState(cfg = DEFAULT_CONFIG, mode) {
  const base = fc.record({
    seed: fc.integer({ min: 1, max: 2 ** 31 }),
    highScore: arbScore,
    ghost: arbGhost(cfg),
    pipes: arbPipes(cfg),
    score: arbScore,
  });
  if (mode === 'Main_Menu') {
    return fc
      .tuple(base, fc.boolean(), fc.constantFrom('PLAY', 'HIGH_SCORES'))
      .map(([b, panelOpen, selected]) =>
        buildState(cfg, mode, { rng: rng(b.seed), highScore: b.highScore, panelOpen, selected })
      );
  }
  if (mode === 'Playing' || mode === 'Paused') {
    return fc
      .tuple(base, arbMs(cfg.timing.INVINCIBILITY_MS), arbMs(1000))
      .map(([b, invincibleMs, flapMs]) =>
        buildState(cfg, mode, { ...b, rng: rng(b.seed), invincibleMs, flapMs })
      );
  }
  if (mode === 'Game_Over') {
    const lockout = cfg.timing.LOCKOUT_MS === undefined ? 500 : cfg.timing.LOCKOUT_MS;
    return fc
      .tuple(base, fc.boolean(), arbMs(lockout), arbMs(3000), fc.boolean())
      .map(([b, locked, lockoutMs, deathMs, newHighScore]) =>
        buildState(cfg, mode, {
          ...b,
          rng: rng(b.seed),
          lockoutMs: locked ? Math.max(lockoutMs, 1) : 0,
          crashMs: deathMs,
          deathMs,
          newHighScore,
        })
      );
  }
  throw new Error(`unknown mode: ${mode}`);
}

// A state in any of the four modes.
export function arbAnyGameState(cfg = DEFAULT_CONFIG) {
  return fc.oneof(...MODES.map((m) => arbGameState(cfg, m)));
}

// Steps: { input } or { dt }. Updates only use the clamped dt range.
export function arbStep(cfg = DEFAULT_CONFIG) {
  return fc.oneof(
    { weight: 3, arbitrary: arbInput(cfg).map((input) => ({ input })) },
    { weight: 2, arbitrary: arbDt(cfg).map((dt) => ({ dt })) }
  );
}

export function arbSteps(cfg = DEFAULT_CONFIG, maxLength = 40) {
  return fc.array(arbStep(cfg), { minLength: 0, maxLength });
}

// Applies steps in order through handleInput and update.
// Returns { state, log, transitions, events }:
//   log: one entry per step { step, before, after, events }
//   transitions: mode changes { index, from, to, step }
//   events: every event emitted, in order
export function runSteps(state, steps, seed = 1) {
  const { handleInput, update } = gameApi();
  const deps = { cfg: state.cfg, rng: rng(seed) };
  const log = [];
  const transitions = [];
  const events = [];
  steps.forEach((step, index) => {
    const before = state.mode;
    const emitted =
      'input' in step ? handleInput(state, step.input, deps) : update(state, step.dt, deps);
    const evs = Array.isArray(emitted) ? emitted : [];
    events.push(...evs);
    log.push({ step, before, after: state.mode, events: evs });
    if (state.mode !== before) transitions.push({ index, from: before, to: state.mode, step });
  });
  return { state, log, transitions, events };
}

// Convenience: a list of inputs applied with no updates.
export function runInputs(state, inputs, seed = 1) {
  return runSteps(
    state,
    inputs.map((input) => ({ input })),
    seed
  );
}
