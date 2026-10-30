// Flappy Kiro game state machine: GameState, createGame, startRound.
// The state is a single mutable object; the shell owns audio and storage.
import * as physics from './physics.js';
import * as clouds from './clouds.js';
import * as menu from './menu.js';
import * as pipes from './pipes.js';
import * as collision from './collision.js';


// Starts Main_Menu: ghost at MENU_GHOST_Y, menu = initialMenu(), clouds created, timers at initial values.
function createGame(cfg, highScore, rng) {
  return {
    cfg,
    mode: 'Main_Menu',
    ghost: { y: cfg.world.MENU_GHOST_Y, vy: 0 },
    pipes: [],
    clouds: clouds.createClouds(cfg, rng),
    groundOffset: 0,
    score: 0,
    highScore: highScore > 0 ? Math.floor(highScore) : 0,
    speed: cfg.speed.INITIAL_SPEED,
    invincibleMs: 0,
    crashMs: 0,
    lockoutMs: 0,
    newHighScore: false,
    lastGapCenter: null,
    menu: menu.initialMenu(),
    animClockMs: 0,
    flapMs: null,
    deathMs: 0,
  };
}

// Resets round values, starts invincibility, applies the jump and restarts the flap animation.
// Every start and restart path calls this. Mutates and returns [{ type: 'jump' }].
function startRound(state, rng) {
  const cfg = state.cfg;
  state.mode = 'Playing';
  state.score = 0;
  state.speed = cfg.speed.INITIAL_SPEED;
  state.pipes = [];
  state.lastGapCenter = null;
  state.groundOffset = 0;
  state.ghost = physics.applyJump(cfg, { y: cfg.world.MENU_GHOST_Y, vy: 0 });
  state.invincibleMs = cfg.timing.INVINCIBILITY_MS;
  state.crashMs = 0;
  state.lockoutMs = 0;
  state.newHighScore = false;
  state.deathMs = 0;
  state.menu = Object.assign({}, state.menu, { panelOpen: false });
  state.flapMs = 0;
  return [{ type: 'jump' }];
}

// Routes one semantic input by mode (design: Input Routing). Mutates state, returns events.
// deps is { rng }.
function handleInput(state, input, deps) {
  const none = [];
  if (!input) return none;
  const rng = deps.rng;
  const mode = state.mode;
  const kind = input.kind;

  const setPaused = (paused) => {
    state.mode = paused ? 'Paused' : 'Playing';
    return none;
  };
  const jump = () => {
    state.ghost = physics.applyJump(state.cfg, state.ghost);
    state.flapMs = 0;
    return [{ type: 'jump' }];
  };
  const lockedOut = () => state.lockoutMs > 0;

  if (mode === 'Main_Menu') {
    const open = state.menu.panelOpen;
    const activateName = (name) => {
      if (name === 'PLAY') return startRound(state, rng);
      state.menu = menu.activate(state.menu, name);
      return none;
    };
    if (kind === 'space' || kind === 'enter') {
      return activateName(open ? 'BACK' : state.menu.selected);
    }
    if (kind === 'up' || kind === 'down') {
      if (!open) state.menu = menu.navigate(state.menu, kind);
      return none;
    }
    if (kind === 'pointer') {
      const hit = menu.hitTest(state.cfg, state, input.x, input.y);
      if (hit === 'PLAY' || hit === 'HIGH_SCORES' || hit === 'BACK') {
        if (hit === 'PLAY' || hit === 'HIGH_SCORES') state.menu = Object.assign({}, state.menu, { selected: hit });
        return activateName(hit);
      }
      return open ? none : startRound(state, rng);
    }
    return none;
  }

  if (mode === 'Playing') {
    if (kind === 'space') return jump();
    if (kind === 'pause' || kind === 'hidden') return setPaused(true);
    if (kind === 'pointer') {
      const hit = menu.hitTest(state.cfg, state, input.x, input.y);
      if (hit === 'MUTE') return [{ type: 'toggleMute' }];
      if (hit === 'PAUSE') return setPaused(true);
      return jump();
    }
    return none;
  }

  if (mode === 'Paused') {
    if (kind === 'pause') return setPaused(false);
    if (kind === 'pointer') {
      const hit = menu.hitTest(state.cfg, state, input.x, input.y);
      if (hit === 'PAUSE') return setPaused(false);
      if (hit === 'MUTE') return [{ type: 'toggleMute' }];
    }
    return none;
  }

  if (mode === 'Game_Over') {
    if (lockedOut()) return none;
    if (kind === 'space' || kind === 'enter') return startRound(state, rng);
    if (kind === 'pointer') return startRound(state, rng);
    return none;
  }

  return none;
}

// Advances the simulation by dt seconds (already clamped). Mutates state, returns events.
// deps is { rng }.
function update(state, dt, deps) {
  const events = [];
  const rng = deps.rng;
  const cfg = state.cfg;
  const ms = dt * 1000;

  if (state.mode === 'Main_Menu') {
    state.animClockMs += ms;
    return events;
  }

  if (state.mode === 'Game_Over') {
    state.deathMs += ms;
    state.crashMs = Math.max(0, state.crashMs - ms);
    state.lockoutMs = Math.max(0, state.lockoutMs - ms);
    const floorY = cfg.world.GROUND_TOP - cfg.ghost.HITBOX_RADIUS;
    if (state.ghost.y < floorY) {
      state.ghost = physics.stepGhost(cfg, state.ghost, dt);
    }
    if (state.ghost.y >= floorY) state.ghost = { y: floorY, vy: 0 };
    return events;
  }

  if (state.mode !== 'Playing') return events;

  // 1. Timers.
  state.invincibleMs = Math.max(0, state.invincibleMs - ms);
  if (state.flapMs !== null) state.flapMs += ms;

  // 2. Ghost physics.
  state.ghost = physics.stepGhost(cfg, state.ghost, dt);

  // 3. World scroll, clouds, pair removal and spawning.
  state.pipes = pipes.movePairs(state.pipes, state.speed, dt);
  state.groundOffset += state.speed * dt;
  state.clouds = clouds.moveClouds(cfg, state.clouds, dt);
  state.pipes = pipes.removeOffscreen(cfg, state.pipes);
  if (pipes.shouldSpawn(cfg, state.pipes)) {
    state.pipes = pipes.spawnPair(cfg, state.pipes, rng);
    state.lastGapCenter = state.pipes[state.pipes.length - 1].gapCenter;
  }

  // 4. Scoring: one event per pair whose right edge the ghost center has passed.
  state.pipes = state.pipes.map((p) => {
    if (!p.scored && p.x + cfg.pipes.CAP_WIDTH < cfg.ghost.X) {
      state.score += 1;
      events.push({ type: 'scored' });
      return Object.assign({}, p, { scored: true });
    }
    return p;
  });
  state.speed = pipes.speedForScore(cfg, state.score);

  // 5. Collision.
  const hit = collision.detect(cfg, state.ghost, state.pipes, state.invincibleMs > 0);
  if (hit.pipe || hit.ground || hit.ceiling) {
    state.mode = 'Game_Over';
    state.invincibleMs = 0;
    state.deathMs = 0;
    state.crashMs = cfg.timing.CRASH_MS;
    state.lockoutMs = cfg.timing.LOCKOUT_MS;
    state.newHighScore = state.score > state.highScore;
    events.push({ type: 'gameOver', score: state.score, previousHighScore: state.highScore });
  }
  return events;
}

export { createGame, startRound, handleInput, update };
