// Flappy Kiro game state machine: GameState, createGame, startRound, handleInput, update.
// The state is a single mutable object; the shell owns audio and storage.
import * as physics from './physics.js';
import * as clouds from './clouds.js';
import * as menu from './menu.js';
import * as pipes from './pipes.js';
import * as collision from './collision.js';
import * as worlds from './worlds.js';
import * as twists from './twists.js';
import * as fx from './particles.js';
import { cycleSkin } from './skins.js';

// Flap puff tone per world kind (sky, forest, castle, space); colours live in the renderer.
const PUFF_TONES = ['puff', 'leaf', 'ember', 'star'];

// World configs for cfg. If a custom cfg makes a world invalid (tests, odd overrides that
// loadConfig did not see), every world falls back to cfg itself rather than failing.
function buildWorlds(cfg) {
  const built = worlds.buildWorldConfigs(cfg);
  if (built.errors.length === 0) return built;
  return { configs: [cfg, cfg, cfg, cfg], maxLoop: 0, errors: built.errors };
}

// Starts Main_Menu: ghost at MENU_GHOST_Y, menu = initialMenu(), clouds created, timers at initial values.
// topScores: descending list of up to 5 best scores, shown by the renderer.
// opts: { startWorld (index), bestMedal (medal or null), skin (skin id) }.
function createGame(cfg, highScore, rng, topScores, opts) {
  const o = opts || {};
  const built = buildWorlds(cfg);
  return {
    cfg: worlds.configFor(built, 0),
    baseCfg: cfg,
    worlds: built,
    worldIndex: 0,
    startWorld: o.startWorld || 0,
    transition: null,
    wind: twists.initialWind(),
    fx: fx.createFx(),
    shakeMs: 0,
    trail: [],
    trailClockMs: 0,
    bestMedal: o.bestMedal || null,
    skin: o.skin || 'classic',
    mode: 'Main_Menu',
    ghost: { y: cfg.world.MENU_GHOST_Y, vy: 0 },
    pipes: [],
    clouds: clouds.createClouds(cfg, rng),
    groundOffset: 0,
    score: 0,
    highScore: highScore > 0 ? Math.floor(highScore) : 0,
    topScores: topScores ? topScores.slice() : [],
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

// Puts the round in world `index` (cfg swap only; position and velocity are kept).
function enterWorld(state, index) {
  state.worldIndex = index;
  state.cfg = worlds.configFor(state.worlds, index);
  state.transition = null;
  state.wind = twists.initialWind();
}

// Clears per-round effects.
function resetEffects(state) {
  state.fx = fx.createFx();
  state.shakeMs = 0;
  state.trail = [];
  state.trailClockMs = 0;
}

// Game_Over -> Main_Menu: ghost back at MENU_GHOST_Y, world cleared, panel closed, PLAY selected.
function returnToMenu(state) {
  enterWorld(state, 0);
  resetEffects(state);
  state.mode = 'Main_Menu';
  state.ghost = { y: state.cfg.world.MENU_GHOST_Y, vy: 0 };
  state.pipes = [];
  state.score = 0;
  state.crashMs = 0;
  state.lockoutMs = 0;
  state.deathMs = 0;
  state.newHighScore = false;
  state.flapMs = null;
  state.menu = Object.assign({}, state.menu, { selected: 'PLAY', panelOpen: false });
  return [];
}

// Resets round values, starts invincibility, applies the jump and restarts the flap animation.
// The round starts in state.startWorld (from ?world=) with the score at that world's threshold.
// Every start and restart path calls this. Mutates and returns [{ type: 'jump' }].
function startRound(state, rng) { // eslint-disable-line no-unused-vars
  enterWorld(state, state.startWorld || 0);
  resetEffects(state);
  const cfg = state.cfg;
  state.mode = 'Playing';
  state.score = worlds.startScoreFor(state.worldIndex, state.baseCfg.world.POINTS_PER_WORLD);
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

function jump(state) {
  const cfg = state.cfg;
  state.ghost = physics.applyJump(cfg, state.ghost);
  state.flapMs = 0;
  const tone = PUFF_TONES[worlds.worldKind(state.worldIndex)];
  state.fx = fx.emitPuff(cfg, state.fx, tone, cfg.ghost.X, state.ghost.y);
  return [{ type: 'jump' }];
}

function changeSkin(state, dir) {
  state.skin = cycleSkin(state.skin, dir);
  return [{ type: 'skinChanged', skin: state.skin }];
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
    if (kind === 'left' || kind === 'right') return open ? none : changeSkin(state, kind === 'left' ? -1 : 1);
    if (kind === 'pointer') {
      const hit = menu.hitTest(state.cfg, state, input.x, input.y);
      if (hit === 'SKIN_PREV' || hit === 'SKIN_NEXT') return changeSkin(state, hit === 'SKIN_PREV' ? -1 : 1);
      if (hit === 'PLAY' || hit === 'HIGH_SCORES' || hit === 'BACK') {
        if (hit === 'PLAY' || hit === 'HIGH_SCORES') state.menu = Object.assign({}, state.menu, { selected: hit });
        return activateName(hit);
      }
      return open ? none : startRound(state, rng);
    }
    return none;
  }

  if (mode === 'Playing') {
    if (kind === 'space') return jump(state);
    if (kind === 'pause' || kind === 'hidden') return setPaused(true);
    if (kind === 'pointer') {
      const hit = menu.hitTest(state.cfg, state, input.x, input.y);
      if (hit === 'MUTE') return [{ type: 'toggleMute' }];
      if (hit === 'PAUSE') return setPaused(true);
      return jump(state);
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
    const choose = (name) => (name === 'MENU' ? returnToMenu(state) : startRound(state, rng));
    if (kind === 'space' || kind === 'enter') return choose(state.menu.selected);
    if (kind === 'up' || kind === 'down') {
      state.menu = Object.assign({}, state.menu, { selected: state.menu.selected === 'MENU' ? 'RESTART' : 'MENU' });
      return none;
    }
    if (kind === 'pointer') return choose(menu.hitTest(state.cfg, state, input.x, input.y));
    return none;
  }

  return none;
}

// World transition: drain (no spawns until the screen is clear), then the title card, then the
// new world with a short invincibility. The mode stays Playing throughout.
function stepTransition(state, ms, events) {
  const P = state.baseCfg.world.POINTS_PER_WORLD;
  if (!state.transition && worlds.worldIndexFor(state.score, P) > state.worldIndex) {
    state.transition = { phase: 'drain', cardMs: 0, nextIndex: state.worldIndex + 1 };
  }
  const t = state.transition;
  if (!t) return;
  if (t.phase === 'drain') {
    if (state.pipes.length > 0) return;
    const cfg = state.cfg;
    state.transition = { phase: 'card', cardMs: cfg.timing.TITLE_CARD_MS, nextIndex: t.nextIndex };
    const tone = PUFF_TONES[worlds.worldKind(t.nextIndex)];
    state.fx = fx.emitBurst(cfg, state.fx, tone, cfg.world.WIDTH / 2, cfg.world.GROUND_TOP / 2);
    return;
  }
  const cardMs = t.cardMs - ms;
  if (cardMs > 0) {
    state.transition = Object.assign({}, t, { cardMs });
    return;
  }
  enterWorld(state, t.nextIndex);
  state.invincibleMs = state.cfg.timing.WORLD_INVINCIBILITY_MS;
  events.push({ type: 'worldEntered', index: state.worldIndex });
}

// Trail: a ghost position every SAMPLE_MS, aged so the renderer can place it behind Ghosty.
function stepTrail(state, ms) {
  const t = state.cfg.trail;
  const maxAge = t.LENGTH * t.SAMPLE_MS;
  state.trail = state.trail.map((p) => ({ y: p.y, ageMs: p.ageMs + ms })).filter((p) => p.ageMs < maxAge);
  state.trailClockMs += ms;
  if (state.trailClockMs >= t.SAMPLE_MS) {
    state.trailClockMs -= t.SAMPLE_MS;
    state.trail.unshift({ y: state.ghost.y, ageMs: 0 });
  }
}

// Game_Over: crash animation, lockout, shake and particles run; the world stays frozen.
function updateGameOver(state, dt, ms) {
  const cfg = state.cfg;
  state.deathMs += ms;
  state.crashMs = Math.max(0, state.crashMs - ms);
  state.lockoutMs = Math.max(0, state.lockoutMs - ms);
  state.shakeMs = Math.max(0, state.shakeMs - ms);
  state.fx = fx.stepFx(state.fx, ms);
  const floorY = cfg.world.GROUND_TOP - cfg.ghost.HITBOX_RADIUS;
  if (state.ghost.y < floorY) state.ghost = physics.stepGhost(cfg, state.ghost, dt);
  if (state.ghost.y >= floorY) state.ghost = { y: floorY, vy: 0 };
}

// Scroll, moving gaps, removal and spawning (no spawns while a transition drains).
function stepWorld(state, dt, ms, rng) {
  const cfg = state.cfg;
  state.pipes = pipes.movePairs(state.pipes, state.speed, dt);
  state.pipes = twists.slideGaps(cfg, state.pipes, ms);
  state.groundOffset += state.speed * dt;
  state.clouds = clouds.moveClouds(cfg, state.clouds, dt);
  state.pipes = pipes.removeOffscreen(cfg, state.pipes);
  if (!state.transition && pipes.shouldSpawn(cfg, state.pipes)) {
    const spawned = pipes.spawnPair(cfg, state.pipes, rng);
    spawned[spawned.length - 1] = twists.initPair(cfg, spawned[spawned.length - 1]);
    state.pipes = spawned;
    state.lastGapCenter = state.pipes[state.pipes.length - 1].gapCenter;
  }
}

// Advances the simulation by dt seconds (already clamped). Mutates state, returns events.
// deps is { rng }.
function update(state, dt, deps) {
  const events = [];
  const ms = dt * 1000;
  if (state.mode === 'Main_Menu') {
    state.animClockMs += ms;
    return events;
  }
  if (state.mode === 'Game_Over') {
    updateGameOver(state, dt, ms);
    return events;
  }
  if (state.mode !== 'Playing') return events;
  const cfg = state.cfg;

  // 1. Timers and cosmetic effects.
  state.invincibleMs = Math.max(0, state.invincibleMs - ms);
  if (state.flapMs !== null) state.flapMs += ms;
  state.fx = fx.stepFx(state.fx, ms);

  // 2. Ghost physics; Forest wind is an extra smooth force, calm during transitions.
  state.wind = state.transition ? twists.initialWind() : twists.stepWind(cfg, state.wind, ms, deps.rng);
  state.ghost = physics.stepGhost(cfg, state.ghost, dt, state.wind.force);
  stepTrail(state, ms);

  // 3. World scroll and spawning.
  stepWorld(state, dt, ms, deps.rng);

  // 4. Scoring: one event per pair whose right edge the ghost center has passed.
  state.pipes = state.pipes.map((p) => {
    if (p.scored || !(p.x + cfg.pipes.CAP_WIDTH < cfg.ghost.X)) return p;
    state.score += 1;
    events.push({ type: 'scored' });
    state.fx = fx.emitPopup(cfg, state.fx, cfg.ghost.X, state.ghost.y - 24);
    return Object.assign({}, p, { scored: true });
  });

  // 5. Worlds: transition, then the speed ramp restarts inside each world.
  stepTransition(state, ms, events);
  const P = state.baseCfg.world.POINTS_PER_WORLD;
  state.speed = pipes.speedForScore(state.cfg, Math.max(0, state.score - state.worldIndex * P));

  // 6. Collision against the active world config (geometry is the same in every world).
  const hit = collision.detect(state.cfg, state.ghost, state.pipes, state.invincibleMs > 0);
  if (hit.pipe || hit.ground || hit.ceiling) {
    state.mode = 'Game_Over';
    state.invincibleMs = 0;
    state.deathMs = 0;
    state.crashMs = cfg.timing.CRASH_MS;
    state.lockoutMs = cfg.timing.LOCKOUT_MS;
    state.shakeMs = cfg.fx.SHAKE_MS;
    state.newHighScore = state.score > state.highScore;
    state.menu = Object.assign({}, state.menu, { selected: 'RESTART' });
    events.push({ type: 'gameOver', score: state.score, previousHighScore: state.highScore });
  }
  return events;
}

export { createGame, startRound, handleInput, update };
