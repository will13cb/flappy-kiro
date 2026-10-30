// Flappy Kiro collision detector: circle Ghost hitbox against rectangular pipe hitboxes.
// Pure functions on plain objects. Circle: { cx, cy, r }   Rect: { x, y, w, h }
import * as pipes from './pipes.js';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function ghostCircle(cfg, ghost) {
  return { cx: cfg.ghost.X, cy: ghost.y, r: cfg.ghost.HITBOX_RADIUS };
}

function nearestPoint(rect, cx, cy) {
  return {
    x: clamp(cx, rect.x, rect.x + rect.w),
    y: clamp(cy, rect.y, rect.y + rect.h),
  };
}

// A center inside the rectangle clamps to itself, so the distance is 0.
function distanceSqToRect(circle, rect) {
  const p = nearestPoint(rect, circle.cx, circle.cy);
  const dx = circle.cx - p.x;
  const dy = circle.cy - p.y;
  return dx * dx + dy * dy;
}

// Strict: touching (distance equal to the radius) is not a hit.
function circleHitsRect(circle, rect) {
  return distanceSqToRect(circle, rect) < circle.r * circle.r;
}

// A pipe hitbox is the union of its body and cap rectangles.
function hitsPipe(cfg, ghost, pairs) {
  const circle = ghostCircle(cfg, ghost);
  for (let i = 0; i < pairs.length; i++) {
    const rects = pipes.pipeRects(cfg, pairs[i]);
    for (let j = 0; j < rects.length; j++) {
      // A zero-size rect has no area to hit (pipeRects clamps body heights to 0).
      if (rects[j].w <= 0 || rects[j].h <= 0) continue;
      if (circleHitsRect(circle, rects[j])) return true;
    }
  }
  return false;
}

function hitsGround(cfg, ghost) {
  return ghost.y + cfg.ghost.HITBOX_RADIUS >= cfg.world.GROUND_TOP;
}

function hitsCeiling(cfg, ghost) {
  return ghost.y - cfg.ghost.HITBOX_RADIUS <= 0;
}

// Pipe test is skipped while invincible; ground and ceiling are always tested.
function detect(cfg, ghost, pairs, invincible) {
  return {
    pipe: invincible ? false : hitsPipe(cfg, ghost, pairs),
    ground: hitsGround(cfg, ghost),
    ceiling: hitsCeiling(cfg, ghost),
  };
}

export { ghostCircle, nearestPoint, distanceSqToRect, circleHitsRect, hitsPipe, hitsGround, hitsCeiling, detect };
