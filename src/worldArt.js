// Per-world drawing: obstacles, backdrops and the wind cue. Draw-only: it receives a canvas
// context, rectangles and a palette, and never changes game state. Obstacles stay inside the
// collision rectangles from pipes.pipeRects, so what you see is what you hit.

// Small deterministic value in [0, 1) for integer n (stable star and leaf placement).
function h01(n) {
  let x = Math.imul(n ^ 0x27d4eb2d, 0x165667b1);
  x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}

// rects: [topBody, topCap, bottomBody, bottomCap]. kind: 0 sky, 1 forest, 2 castle, 3 space.
function drawObstacle(ctx, kind, rects, pal) {
  for (let j = 0; j < rects.length; j++) {
    const r = rects[j];
    if (r.w <= 0 || r.h <= 0) continue;
    const isCap = j % 2 === 1;
    const x = Math.round(r.x);
    ctx.fillStyle = pal.pipe;
    ctx.fillRect(x, r.y, r.w, r.h);
    if (kind === 1) drawTrunk(ctx, x, r, pal, isCap);
    else if (kind === 2) drawPillar(ctx, x, r, pal, isCap, j === 1);
    else if (kind === 3) drawAsteroid(ctx, x, r, pal, isCap);
    ctx.lineWidth = 2;
    ctx.strokeStyle = pal.pipeOutline;
    ctx.strokeRect(x + 1, r.y + 1, r.w - 2, r.h - 2);
  }
}

// Forest: bark stripes on the trunk, leafy blobs on the caps.
function drawTrunk(ctx, x, r, pal, isCap) {
  if (isCap) {
    ctx.fillStyle = pal.pipeLight;
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 4 + i * 17, r.y + 3, 12, r.h - 6);
    ctx.fillStyle = pal.pipeDark;
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 12 + i * 17, r.y + 6, 4, 4);
    return;
  }
  ctx.fillStyle = pal.pipeDark;
  for (let sx = 10; sx < r.w - 6; sx += 14) ctx.fillRect(x + sx, r.y, 3, r.h);
}

// Castle: brick courses on the pillar; battlement notches on the top of each cap face.
function drawPillar(ctx, x, r, pal, isCap, isTopCap) {
  ctx.fillStyle = pal.pipeDark;
  if (isCap) {
    const notchY = isTopCap ? r.y : r.y + r.h - 8;
    for (let nx = 6; nx < r.w - 6; nx += 18) ctx.fillRect(x + nx, notchY, 9, 8);
    return;
  }
  const top = Math.ceil(r.y / 16) * 16;
  for (let y = top; y < r.y + r.h; y += 16) {
    ctx.fillRect(x, y, r.w, 2);
    const off = (y / 16) % 2 === 0 ? 0 : 16;
    for (let bx = off; bx < r.w; bx += 32) ctx.fillRect(x + bx, y, 2, Math.min(16, r.y + r.h - y));
  }
}

// Space: rocky column with craters at fixed offsets.
function drawAsteroid(ctx, x, r, pal, isCap) {
  ctx.fillStyle = pal.pipeDark;
  const step = isCap ? 20 : 46;
  for (let y = r.y + 6, i = 0; y < r.y + r.h - 8; y += step, i++) {
    const cx = x + 8 + Math.floor(h01(i + Math.round(r.y)) * (r.w - 22));
    ctx.fillRect(cx, y, 8, 6);
    ctx.fillStyle = pal.pipeLight;
    ctx.fillRect(cx + 1, y, 6, 2);
    ctx.fillStyle = pal.pipeDark;
  }
}

const wrap = (v, m) => ((v % m) + m) % m;

// Backdrop details behind the obstacles. t is a world clock in px (scroll distance), so
// everything freezes with the world outside Playing.
function drawBackdrop(ctx, kind, cfg, pal, t) {
  const W = cfg.world.WIDTH;
  const H = cfg.world.GROUND_TOP;
  if (kind === 1) {
    // Falling leaves drifting left.
    ctx.fillStyle = pal.accent;
    for (let i = 0; i < 14; i++) {
      const x = wrap(h01(i) * W - t * 0.35, W);
      const y = wrap(h01(i + 40) * H + t * 0.25, H);
      ctx.fillRect(Math.round(x), Math.round(y), 4, 3);
    }
  } else if (kind === 2) {
    // Torches on the back wall, flickering.
    for (let i = 0; i < 4; i++) {
      const x = Math.round(wrap(60 + i * 120 - t * 0.2, W));
      const flick = 2 + Math.round(2 * Math.abs(Math.sin(t * 0.07 + i * 1.7)));
      ctx.fillStyle = pal.pipeDark;
      ctx.fillRect(x, 140, 4, 14);
      ctx.fillStyle = pal.accent;
      ctx.fillRect(x - 1, 134 - flick, 6, 6 + flick);
      ctx.fillStyle = pal.accent2;
      ctx.fillRect(x, 136 - flick / 2, 4, 4);
    }
  } else if (kind === 3) {
    // Twinkling stars with a slow parallax drift.
    for (let i = 0; i < 40; i++) {
      const x = Math.round(wrap(h01(i) * W - t * 0.1, W));
      const y = Math.round(h01(i + 90) * (H - 10));
      const bright = Math.sin(t * 0.03 + i * 2.3) > 0.6;
      ctx.fillStyle = bright ? pal.accent2 : pal.accent;
      ctx.fillRect(x, y, bright ? 3 : 2, bright ? 3 : 2);
    }
  }
}

// Forest gust cue: an arrow below the score and leaves streaming in the gust direction.
// Shown during the ~1 s telegraph (fainter) and the gust itself.
function drawWindCue(ctx, cfg, pal, wind, t) {
  if (!wind || (wind.phase !== 'telegraph' && wind.phase !== 'gust')) return;
  const W = cfg.world.WIDTH;
  const H = cfg.world.GROUND_TOP;
  const dir = wind.dir;
  ctx.save();
  ctx.globalAlpha = wind.phase === 'telegraph' ? 0.6 : 0.9;
  ctx.fillStyle = pal.accent;
  for (let i = 0; i < 12; i++) {
    const x = Math.round(h01(i + 200) * W);
    const y = Math.round(wrap(h01(i + 300) * H + dir * t * 1.5, H));
    ctx.fillRect(x, y, 3, 8);
  }
  const cx = W / 2;
  const cy = 124; // below the score and the world label
  ctx.fillStyle = pal.arrow;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - dir * 6);
  ctx.lineTo(cx + 10, cy - dir * 6);
  ctx.lineTo(cx, cy + dir * 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - 3, dir > 0 ? cy - 16 : cy + 6, 6, 10); // stem behind the arrow head
  ctx.restore();
}

export { drawObstacle, drawBackdrop, drawWindCue };
