// Ghosty's Journey worlds: the world table, index helpers, the ?world= parser and the
// per-world configs. Pure: no DOM, no clock. Every threshold comes from POINTS_PER_WORLD.
import { mergeConfig, validateConfig } from './config.js';

// Overlays scale the base (URL-overridden) values, so ?gravity= etc. still apply in every world.
// Only physics, speed and twist values change; pipe geometry is identical everywhere.
const WORLDS = [
  { id: 'sky', title: 'THE SKY', gravityScale: 1, jumpScale: 1, speedScale: 1, twist: {} },
  { id: 'forest', title: 'THE FOREST', gravityScale: 1, jumpScale: 1, speedScale: 1.08,
    twist: { WIND_FORCE: 120 } },
  { id: 'castle', title: 'THE CASTLE', gravityScale: 1, jumpScale: 1, speedScale: 1.17,
    twist: { GAP_AMPLITUDE: 24 } },
  { id: 'space', title: 'SPACE', gravityScale: 0.65, jumpScale: 0.8, speedScale: 1.25, twist: {} },
];
const MAX_LOOPS = 20; // search bound for the fastest loop that still validates

const worldKind = (index) => ((index % WORLDS.length) + WORLDS.length) % WORLDS.length;
const loopOf = (index) => Math.floor(index / WORLDS.length);
const worldIndexFor = (score, P) => Math.floor(Math.max(0, score) / P);
const startScoreFor = (index, P) => index * P;
const worldOf = (index) => WORLDS[worldKind(index)];

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
  WORLDS, worldKind, loopOf, worldIndexFor, startScoreFor, worldOf,
  parseStartWorld, titleFor, worldConfig, buildWorldConfigs, configFor,
};
