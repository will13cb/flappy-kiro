// Cosmetic particles: flap puffs, "+1" popups and world bursts. Never read by physics or
// collision. Randomness comes from a counter hash, never from the gameplay rng, so the
// pipe sequence is identical with or without particles.
// fx: { list: Particle[], seq: number }. Particle: { tone, x, y, vx, vy, ageMs, lifeMs, size, text? }
// tone is resolved to a colour by the renderer (puff, leaf, star, ember, popup).

function createFx() {
  return { list: [], seq: 0 };
}

// Deterministic value in [0, 1) for counter n.
function hash01(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function add(cfg, fx, items) {
  const list = fx.list.concat(items);
  const max = cfg.fx.MAX_PARTICLES;
  return { list: list.length > max ? list.slice(list.length - max) : list, seq: fx.seq + items.length * 4 };
}

function spray(fx, count, tone, x, y, speed, lifeMs, spread) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const n = fx.seq + i * 4;
    const angle = spread[0] + hash01(n) * (spread[1] - spread[0]);
    const v = speed * (0.5 + hash01(n + 1));
    out.push({
      tone, x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v,
      ageMs: 0, lifeMs: lifeMs * (0.7 + 0.6 * hash01(n + 2)), size: 2 + Math.floor(hash01(n + 3) * 3),
    });
  }
  return out;
}

// Small puff below Ghosty on a flap, heading down and back.
function emitPuff(cfg, fx, tone, x, y) {
  return add(cfg, fx, spray(fx, cfg.fx.PUFF_COUNT, tone, x - 4, y + 12, 60, 350, [Math.PI * 0.55, Math.PI * 0.95]));
}

// Burst in every direction, for the world title card.
function emitBurst(cfg, fx, tone, x, y) {
  return add(cfg, fx, spray(fx, cfg.fx.BURST_COUNT, tone, x, y, 140, 900, [0, Math.PI * 2]));
}

// "+1" that floats up and fades.
function emitPopup(cfg, fx, x, y) {
  return add(cfg, fx, [{ tone: 'popup', text: '+1', x, y, vx: 0, vy: -50, ageMs: 0, lifeMs: cfg.fx.POPUP_MS, size: 12 }]);
}

function stepFx(fx, dtMs) {
  const dt = dtMs / 1000;
  const list = [];
  for (const p of fx.list) {
    const ageMs = p.ageMs + dtMs;
    if (ageMs < p.lifeMs) list.push(Object.assign({}, p, { ageMs, x: p.x + p.vx * dt, y: p.y + p.vy * dt }));
  }
  return { list, seq: fx.seq };
}

export { createFx, emitPuff, emitBurst, emitPopup, stepFx };
