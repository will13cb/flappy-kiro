// Flappy Kiro collision detector: circle Ghost hitbox against rectangular pipe hitboxes.
// Pure functions on plain objects. Circle: { cx, cy, r }   Rect: { x, y, w, h }
(function () {
  'use strict';

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

  // Plain rectangles for one pair: [topBody, topCap, bottomBody, bottomCap].
  // pair.x is the left edge of the cap; the body is inset by CAP_INSET.
  function pairRects(cfg, pair) {
    const p = cfg.pipes;
    const inset = (p.CAP_WIDTH - p.PIPE_WIDTH) / 2;
    const gapTop = pair.gapCenter - p.GAP_HEIGHT / 2;
    const gapBottom = pair.gapCenter + p.GAP_HEIGHT / 2;
    const groundTop = cfg.world.GROUND_TOP;
    return [
      { x: pair.x + inset, y: 0, w: p.PIPE_WIDTH, h: gapTop - p.CAP_HEIGHT },
      { x: pair.x, y: gapTop - p.CAP_HEIGHT, w: p.CAP_WIDTH, h: p.CAP_HEIGHT },
      { x: pair.x + inset, y: gapBottom + p.CAP_HEIGHT, w: p.PIPE_WIDTH, h: groundTop - gapBottom - p.CAP_HEIGHT },
      { x: pair.x, y: gapBottom, w: p.CAP_WIDTH, h: p.CAP_HEIGHT },
    ];
  }

  // A pipe hitbox is the union of its body and cap rectangles.
  function hitsPipe(cfg, ghost, pairs) {
    const circle = ghostCircle(cfg, ghost);
    for (let i = 0; i < pairs.length; i++) {
      const rects = pairRects(cfg, pairs[i]);
      for (let j = 0; j < rects.length; j++) {
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

  const api = {
    ghostCircle,
    nearestPoint,
    distanceSqToRect,
    circleHitsRect,
    hitsPipe,
    hitsGround,
    hitsCeiling,
    detect,
  };

  if (typeof window !== 'undefined') {
    window.FlappyKiro = window.FlappyKiro || {};
    Object.assign(window.FlappyKiro, api);
  }
  if (typeof module !== 'undefined' && module.exports) {
    Object.assign(module.exports, api);
  }
})();
