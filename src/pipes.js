// Flappy Kiro pipes: gap choice, speed curve, spawning, movement, removal and geometry.
// Pipe_Pair: { x, gapCenter, scored }   x = left edge of the (wider) cap.
// All functions are pure: list functions return new arrays and never mutate their input.
(function (root) {
  'use strict';

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  // [min, max] for the next gap center. Without prevCenter: the full margin range.
  // With prevCenter: intersected with [prev - MAX_GAP_SHIFT, prev + MAX_GAP_SHIFT].
  function gapCenterRange(cfg, prevCenter) {
    const p = cfg.pipes;
    let min = p.GAP_CENTER_MIN;
    let max = p.GAP_CENTER_MAX;
    if (typeof prevCenter === 'number' && Number.isFinite(prevCenter)) {
      min = Math.max(min, prevCenter - p.MAX_GAP_SHIFT);
      max = Math.min(max, prevCenter + p.MAX_GAP_SHIFT);
      if (min > max) {
        // prevCenter outside the margin range: fall back to the nearest valid point.
        const c = clamp(prevCenter, p.GAP_CENTER_MIN, p.GAP_CENTER_MAX);
        min = c;
        max = c;
      }
    }
    return [min, max];
  }

  // Uniform over gapCenterRange; rng() values outside [0, 1] are clamped.
  function chooseGapCenter(cfg, prevCenter, rng) {
    const range = gapCenterRange(cfg, prevCenter);
    let r = Number(rng());
    if (!Number.isFinite(r)) r = 0;
    r = clamp(r, 0, 1);
    return clamp(range[0] + r * (range[1] - range[0]), range[0], range[1]);
  }

  function speedForScore(cfg, score) {
    const s = cfg.speed;
    const steps = Math.floor(Math.max(0, score) / s.SPEED_STEP_INTERVAL);
    return Math.min(s.MAX_SPEED, s.INITIAL_SPEED + s.SPEED_INCREMENT * steps);
  }

  // Appends a new pair at x = WIDTH and returns the new list.
  function spawnPair(cfg, pairs, rng) {
    const list = pairs || [];
    const prev = list.length > 0 ? list[list.length - 1].gapCenter : undefined;
    const pair = {
      x: cfg.world.WIDTH,
      gapCenter: chooseGapCenter(cfg, prev, rng),
      scored: false,
    };
    return list.concat([pair]);
  }

  // The first pair of a round spawns at once; later pairs when the last has reached SPAWN_X.
  function shouldSpawn(cfg, pairs) {
    if (!pairs || pairs.length === 0) return true;
    return pairs[pairs.length - 1].x <= cfg.pipes.SPAWN_X;
  }

  function movePairs(pairs, speed, dt) {
    return pairs.map((p) => Object.assign({}, p, { x: p.x - speed * dt }));
  }

  function removeOffscreen(cfg, pairs) {
    return pairs.filter((p) => !(p.x + cfg.pipes.CAP_WIDTH < 0));
  }

  // -> [topBody, topCap, bottomBody, bottomCap], each { x, y, w, h }.
  // Caps sit at the gap edges; bodies run to the ceiling and to GROUND_TOP.
  function pipeRects(cfg, pair) {
    const p = cfg.pipes;
    const groundTop = cfg.world.GROUND_TOP;
    const gapTop = pair.gapCenter - p.GAP_HEIGHT / 2;
    const gapBottom = pair.gapCenter + p.GAP_HEIGHT / 2;
    const bodyX = pair.x + p.CAP_INSET;
    const topCapY = gapTop - p.CAP_HEIGHT;
    const bottomBodyY = gapBottom + p.CAP_HEIGHT;
    return [
      { x: bodyX, y: 0, w: p.PIPE_WIDTH, h: Math.max(0, topCapY) },
      { x: pair.x, y: topCapY, w: p.CAP_WIDTH, h: p.CAP_HEIGHT },
      { x: bodyX, y: bottomBodyY, w: p.PIPE_WIDTH, h: Math.max(0, groundTop - bottomBodyY) },
      { x: pair.x, y: gapBottom, w: p.CAP_WIDTH, h: p.CAP_HEIGHT },
    ];
  }

  const api = {
    gapCenterRange,
    chooseGapCenter,
    speedForScore,
    spawnPair,
    shouldSpawn,
    movePairs,
    removeOffscreen,
    pipeRects,
  };

  if (typeof window !== 'undefined') {
    window.FlappyKiro = window.FlappyKiro || {};
    Object.assign(window.FlappyKiro, api);
  }
  if (typeof module !== 'undefined' && module.exports) {
    Object.assign(module.exports, api);
  }
})(typeof window !== 'undefined' ? (window.FlappyKiro = window.FlappyKiro || {}) : {});
