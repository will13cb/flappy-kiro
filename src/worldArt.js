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
    drawShading(ctx, x, r, pal, isCap, j === 1);
    ctx.lineWidth = 2;
    ctx.strokeStyle = pal.pipeOutline;
    ctx.strokeRect(x + 1, r.y + 1, r.w - 2, r.h - 2);
  }
}

// Light band on the left, shade on the right and a darker lip on the cap edge that faces the gap:
// the same cue on every obstacle so they read as solid. Stays inside the collision rectangle.
function drawShading(ctx, x, r, pal, isCap, isTopCap) {
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = pal.pipeLight;
  ctx.fillRect(x + 4, r.y + 4, Math.max(2, Math.round(r.w * 0.14)), r.h - 8);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = pal.pipeDark;
  ctx.fillRect(x + r.w - 4 - Math.round(r.w * 0.16), r.y + 4, Math.round(r.w * 0.16), r.h - 8);
  if (isCap) ctx.fillRect(x + 4, isTopCap ? r.y + r.h - 8 : r.y + 4, r.w - 8, 4);
  ctx.restore();
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

// Filled circle from 2 px scanlines (flat pixel-art disc).
function disc(ctx, cx, cy, r) {
  for (let dy = -r; dy < r; dy += 2) {
    const half = Math.round(Math.sqrt(r * r - (dy + 1) * (dy + 1)));
    ctx.fillRect(cx - half, cy + dy, half * 2, 2);
  }
}

// Rolling hills as 6 px columns; drift is the parallax offset in px.
function hills(ctx, W, groundTop, drift, base, amp) {
  for (let x = 0; x < W; x += 6) {
    const u = x + drift;
    const h = Math.round(base + amp * Math.sin(u * 0.018) + amp * 0.5 * Math.sin(u * 0.047 + 1));
    ctx.fillRect(x, groundTop - h, 6, h);
  }
}

// A row of pines: three stacked bars on a trunk, repeating every `spacing` px and wrapping.
function pines(ctx, W, groundTop, drift, spacing, height, seed) {
  const span = W + spacing * 2;
  for (let i = 0; i * spacing < span; i++) {
    const x = Math.round(wrap(i * spacing - drift, span)) - spacing;
    const h = height + Math.round(h01(i + seed) * 24);
    const w = 18 + Math.round(h01(i + seed + 50) * 8);
    ctx.fillRect(x - 2, groundTop - 12, 4, 12);
    ctx.fillRect(x - w / 2, groundTop - 12 - h * 0.35, w, Math.round(h * 0.35));
    ctx.fillRect(x - w * 0.35, groundTop - 12 - h * 0.7, w * 0.7, Math.round(h * 0.35));
    ctx.fillRect(x - w * 0.18, groundTop - 12 - h, w * 0.36, Math.round(h * 0.3));
  }
}

// Castle hall: a brick back wall with arched windows and wall-mounted torches, all scrolling
// slowly. drift is the parallax offset in px.
function hall(ctx, W, H, drift, pal, t) {
  ctx.fillStyle = pal.far;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = pal.far2;
  const row = 28;
  for (let y = 0, r = 0; y < H; y += row, r++) {
    ctx.fillRect(0, y, W, 2);
    for (let k = 0; k * 56 < W + 112; k++) {
      const x = Math.round(wrap(k * 56 + (r % 2) * 28 - drift, W + 112)) - 56;
      ctx.fillRect(x, y, 2, row);
    }
  }
  for (let i = 0; i < 4; i++) {
    const x = Math.round(wrap(i * 160 + 70 - drift * 1.3, W + 160)) - 80;
    // Arched window: a frame, then dim night glass.
    ctx.fillStyle = pal.far2;
    ctx.fillRect(x - 6, 128, 52, 118);
    ctx.fillRect(x, 120, 40, 8);
    ctx.fillRect(x + 8, 114, 24, 6);
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = pal.haze;
    ctx.fillRect(x, 134, 40, 106);
    ctx.fillRect(x + 4, 128, 32, 6);
    ctx.fillRect(x + 10, 122, 20, 6);
    ctx.restore();
    ctx.fillStyle = pal.far2;
    ctx.fillRect(x + 19, 122, 2, 118); // mullion
    ctx.fillRect(x, 176, 40, 2);
    // Torch on the wall between this window and the next.
    const tx = x + 80;
    const flick = 2 + Math.round(2 * Math.abs(Math.sin(t * 0.07 + i * 1.7)));
    ctx.fillStyle = pal.pipeDark;
    ctx.fillRect(tx - 3, 196, 10, 4); // bracket
    ctx.fillRect(tx, 198, 4, 16);
    ctx.fillStyle = pal.accent;
    ctx.fillRect(tx - 2, 188 - flick, 8, 8 + flick);
    ctx.fillStyle = pal.accent2;
    ctx.fillRect(tx, 190 - flick / 2, 4, 5);
    ctx.save();
    ctx.fillStyle = pal.accent;
    ctx.globalAlpha = 0.08; // small halo round the flame, not a box on the wall
    ctx.fillRect(tx - 6, 180 - flick, 16, 22 + flick);
    ctx.restore();
  }
}

// Backdrop behind the obstacles: a low-contrast scene per world, then small drifting details.
// t is a world clock in px (scroll distance), so everything freezes with the world outside Playing.
// Scenery colours are muted and never green like the walls, so the playfield stays readable.
function drawBackdrop(ctx, kind, cfg, pal, t) {
  const W = cfg.world.WIDTH;
  const H = cfg.world.GROUND_TOP;
  // Horizon haze: many faint bands stacked towards the ground, so no single edge shows.
  ctx.save();
  ctx.fillStyle = pal.haze;
  ctx.globalAlpha = 0.03;
  for (let y = H - 260; y < H; y += 26) ctx.fillRect(0, y, W, H - y);
  ctx.restore();
  if (kind === 0) {
    ctx.save();
    ctx.fillStyle = pal.accent;
    ctx.globalAlpha = 0.18;
    disc(ctx, 380, 112, 34);
    ctx.globalAlpha = 0.9;
    disc(ctx, 380, 112, 22);
    ctx.restore();
    ctx.fillStyle = pal.far;
    hills(ctx, W, H, t * 0.12, 40, 16);
    ctx.fillStyle = pal.far2;
    hills(ctx, W, H, t * 0.25 + 90, 22, 11);
  } else if (kind === 1) {
    ctx.fillStyle = pal.far;
    pines(ctx, W, H, t * 0.12, 44, 70, 0);
    ctx.fillStyle = pal.far2;
    pines(ctx, W, H, t * 0.25 + 20, 60, 90, 100);
    // Faint light shafts drifting through the canopy.
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = pal.accent2;
    for (let i = 0; i < 3; i++) ctx.fillRect(Math.round(wrap(70 + i * 170 - t * 0.08, W + 60)) - 30, 0, 26, H);
    ctx.restore();
    ctx.fillStyle = pal.accent;
    for (let i = 0; i < 14; i++) {
      const x = wrap(h01(i) * W - t * 0.35, W);
      const y = wrap(h01(i + 40) * H + t * 0.25, H);
      ctx.fillRect(Math.round(x), Math.round(y), 4, 3);
    }
  } else if (kind === 2) {
    hall(ctx, W, H, t * 0.12, pal, t);
  } else if (kind === 3) {
    // A ringed planet low in the sky, then twinkling stars with a slow parallax drift.
    const px = Math.round(wrap(330 - t * 0.04, W + 200)) - 60;
    ctx.fillStyle = pal.far2;
    disc(ctx, px, 440, 56);
    ctx.fillStyle = pal.far;
    disc(ctx, px - 14, 424, 30);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = pal.accent;
    ctx.fillRect(px - 92, 436, 184, 4);
    ctx.fillRect(px - 76, 444, 152, 2);
    ctx.restore();
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
