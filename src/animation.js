// Flappy Kiro animation: frame selection and placement. Pure functions, no canvas.
import * as physics from './physics.js';


const DEG = Math.PI / 180;
// Sheet strip layout: idle 0..1, flap 2..4, death 5..9.
const IDLE_SHEET_BASE = 0;
const FLAP_SHEET_BASE = 2;
const DEATH_SHEET_BASE = 5;

// Index in a timed table ([{ ms }]) for an elapsed time; clamps to the last frame.
function frameAt(table, elapsedMs) {
  let end = 0;
  for (let i = 0; i < table.length; i++) {
    end += table[i].ms;
    if (elapsedMs < end) return i;
  }
  return table.length - 1;
}

function desc(anim, index, sheetIndex, f, rotation, tint, useSheet) {
  if (useSheet) {
    return { anim, index, sheetIndex, offsetY: 0, scaleX: 1, scaleY: 1, rotation: f.sheetRotation, tint: false };
  }
  return { anim, index, sheetIndex, offsetY: f.offsetY, scaleX: f.scaleX, scaleY: f.scaleY, rotation, tint };
}

// Loops over the cumulative idle table.
function idleFrame(cfg, clockMs, vy, useSheet) {
  const a = cfg.animation;
  const t = ((clockMs % a.IDLE_TOTAL_MS) + a.IDLE_TOTAL_MS) % a.IDLE_TOTAL_MS;
  const i = frameAt(a.IDLE_FRAMES, t);
  const rot = physics.tiltFor(vy || 0);
  return desc('idle', i, IDLE_SHEET_BASE + i,
    { offsetY: a.IDLE_FRAMES[i].offsetY || 0, scaleX: 1, scaleY: 1, sheetRotation: rot }, rot, false, useSheet);
}

// null or finished flap -> idle frame 0; otherwise the flap frame.
function flapFrame(cfg, flapMs, vy, useSheet) {
  const a = cfg.animation;
  if (flapMs === null || flapMs === undefined || flapMs >= a.FLAP_TOTAL_MS) {
    return idleFrame(cfg, 0, vy, useSheet);
  }
  const i = frameAt(a.FLAP_FRAMES, Math.max(flapMs, 0));
  const fr = a.FLAP_FRAMES[i];
  const rot = physics.tiltFor(vy || 0);
  return desc('flap', i, FLAP_SHEET_BASE + i,
    { offsetY: 0, scaleX: fr.scaleX, scaleY: fr.scaleY, sheetRotation: rot }, rot, false, useSheet);
}

// Timed death frames, then DEATH_FINAL held.
function deathFrame(cfg, deathMs, useSheet) {
  const a = cfg.animation;
  const n = a.DEATH_FRAMES.length;
  const i = Math.min(Math.floor(Math.max(deathMs, 0) / cfg.timing.DEATH_FRAME_MS), n);
  const fr = i < n ? a.DEATH_FRAMES[i] : a.DEATH_FINAL;
  return desc('death', i, DEATH_SHEET_BASE + i,
    { offsetY: 0, scaleX: 1, scaleY: 1, sheetRotation: 0 }, fr.rotation * DEG, !!fr.tint, useSheet);
}

// Picks the animation from the mode and timers. useSheet gives identity transforms.
function currentFrame(state, useSheet) {
  const cfg = state.cfg;
  const vy = state.ghost ? state.ghost.vy : 0;
  switch (state.mode) {
    case 'Main_Menu': return idleFrame(cfg, state.animClockMs, vy, useSheet);
    case 'Game_Over': return deathFrame(cfg, state.deathMs, useSheet);
    default: return flapFrame(cfg, state.flapMs, vy, useSheet);
  }
}

// Base destination rectangle: SPRITE_SIZE square centered on (X, ghost.y).
function frameDest(cfg, ghost) {
  const s = cfg.ghost.SPRITE_SIZE;
  return { x: cfg.ghost.X - s / 2, y: ghost.y - s / 2, w: s, h: s };
}

// Source rectangle in the horizontal sprite-sheet strip.
function sheetSource(cfg, sheetIndex) {
  const s = cfg.ghost.SPRITE_SIZE;
  return { x: sheetIndex * s, y: 0, w: s, h: s };
}

export { frameAt, idleFrame, flapFrame, deathFrame, currentFrame, frameDest, sheetSource };
