// Ghosty's Journey worlds: the world table, index helpers, the ?world= parser and the
// per-world configs. Pure: no DOM, no clock. Every threshold comes from POINTS_PER_WORLD.
import { mergeConfig, validateConfig } from './config.js';

// Overlays scale the base (URL-overridden) values, so ?gravity= etc. still apply in every world.
// Only physics, speed and twist values change; 
// gapShiftScale narrows how far consecutive gaps may jump, so the stronger twists stay reachable.
const WORLDS = [
  { id: 'sky', title: 'THE SKY', gravityScale: 1, jumpScale: 1, speedScale: 1, gapShiftScale: 1, twist: {} },
  { id: 'forest', title: 'THE FOREST', gravityScale: 1, jumpScale: 1, speedScale: 1.08, gapShiftScale: 1,
    twist: { WIND_FORCE: 300 } },
  { id: 'castle', title: 'THE CASTLE', gravityScale: 1, jumpScale: 1, speedScale: 1.12, gapShiftScale: 0.5,
    twist: { GAP_AMPLITUDE: 32, GAP_PERIOD_S: 3.5 } }, // slow, readable slides
  // Floaty: half gravity and a 75% flap give a higher, longer arc (about 63 px, 1.1 s).
  { id: 'space', title: 'SPACE', gravityScale: 0.5, jumpScale: 0.75, speedScale: 1.25, gapShiftScale: 0.7,
    twist: {} },
];
const MAX_LOOPS = 20; // search bound for the fastest loop that still validates

const worldKind = (index) => ((index % WORLDS.length) + WORLDS.length) % WORLDS.length;
const loopOf = (index) => Math.floor(index / WORLDS.length);
const worldIndexFor = (score, P) => Math.floor(Math.max(0, score) / P);
const startScoreFor = (index, P) => index * P;
const worldOf = (index) => WORLDS[worldKind(index)];

// Play modes on the main menu: the journey through every world, or one world on its own.
// A single-world run never changes world and starts at score 0.
const PLAY_MODES = [{ id: 'journey', name: 'ALL WORLDS' }].concat(
  WORLDS.map((w) => ({ id: w.id, name: w.title.replace(/^THE /, '') + ' ONLY' })));
const isPlayMode = (id) => PLAY_MODES.some((m) => m.id === id);
const playModeById = (id) => PLAY_MODES.find((m) => m.id === id) || PLAY_MODES[0];
// World index a single-world mode plays in, or null for the journey.
const singleWorldIndex = (modeId) => {
  const i = WORLDS.findIndex((w) => w.id === modeId);
  return i < 0 ? null : i;
};
function cyclePlayMode(id, dir) {
  const i = Math.max(0, PLAY_MODES.findIndex((m) => m.id === id));
  return PLAY_MODES[(i + dir + PLAY_MODES.length) % PLAY_MODES.length].id;
}

// ?world=sky|forest|castle|space -> { index, warning }. Anything else starts in Sky.
function parseStartWorld(search) {
  const value = new URLSearchParams(search || '').get('world');
  if (value === null) return { index: 0, warning: null };
  const index = WORLDS.findIndex((w) => w.id === value.trim().toLowerCase());
  if (index < 0) {
    const names = WORLDS.map((w) => w.id).join(', ');
    return { index: 0, warning: 'unknown world "' + value + '" (use ' + names + '); starting in sky' };
  }
  return { index, warning: null };
}

// "WORLD 2 - THE FOREST", plus "LOOP 2" from the second pass on. ASCII hyphen: the pixel
// font may lack an em dash.
function titleFor(index) {
  const w = worldOf(index);
  const loop = loopOf(index);
  return {
    line1: 'WORLD ' + (worldKind(index) + 1) + ' - ' + w.title,
    line2: loop > 0 ? 'LOOP ' + (loop + 1) : null,
  };
}

// World config for one kind and loop. Sky on the first pass is the base config itself, so the
// classic game is unchanged. Elsewhere the speed ramp restarts per world: it starts at the world's
// initial speed, steps every point and stops WORLD_SPEED_SPAN above the start.
function worldConfig(base, kind, loop) {
  if (kind === 0 && loop === 0) return base;
  const w = WORLDS[kind];
  const sp = base.speed;
  const initial = sp.INITIAL_SPEED * w.speedScale * Math.pow(sp.LOOP_SPEED_FACTOR, loop);
  return mergeConfig(base, {
    ghost: {
      GRAVITY: base.ghost.GRAVITY * w.gravityScale,
      JUMP_VELOCITY: base.ghost.JUMP_VELOCITY * w.jumpScale,
    },
    pipes: { MAX_GAP_SHIFT: base.pipes.MAX_GAP_SHIFT * w.gapShiftScale },
    speed: { INITIAL_SPEED: initial, SPEED_STEP_INTERVAL: 1, MAX_SPEED: initial + sp.WORLD_SPEED_SPAN },
    twist: w.twist,
  });
}

// Builds every world config up to the fastest loop where all four worlds still validate.
// Returns { configs, maxLoop, errors }; errors is non-empty if even the first pass fails.
function buildWorldConfigs(base) {
  const configs = [];
  let maxLoop = -1;
  for (let loop = 0; loop < MAX_LOOPS; loop++) {
    const pass = WORLDS.map((_, kind) => worldConfig(base, kind, loop));
    const failed = pass.map((c) => validateConfig(c)).filter((r) => !r.valid);
    if (failed.length) {
      if (loop === 0) return { configs, maxLoop, errors: failed.flatMap((r) => r.errors) };
      break;
    }
    configs.push(...pass);
    maxLoop = loop;
  }
  return { configs, maxLoop, errors: [] };
}

// Loops past maxLoop reuse the fastest valid loop.
function configFor(built, index) {
  const loop = Math.min(loopOf(index), built.maxLoop);
  return built.configs[loop * WORLDS.length + worldKind(index)];
}

export {
  WORLDS, PLAY_MODES, isPlayMode, playModeById, singleWorldIndex, cyclePlayMode, worldKind, loopOf, worldIndexFor, startScoreFor, worldOf,
  parseStartWorld, titleFor, worldConfig, buildWorldConfigs, configFor,
};
