// Flappy Kiro renderer: draws a GameState on a canvas 2D context.
// 17.1 covers the world (sky, clouds, pipes, ground), the ghost and the score.
// Menu, HUD icons and overlays belong to 17.2: see drawUi below (the extension point).
import * as pipesMod from './pipes.js';
import * as animation from './animation.js';
import * as assetsMod from './assets.js';
import * as menuMod from './menu.js';
import * as worlds from './worlds.js';
import * as art from './worldArt.js';
import { medalFor, betterMedal } from './medals.js';
import { SKINS, TRAILS, skinById, trailById, isUnlocked, isTrailUnlocked, neighbour } from './skins.js';


// Fixed drawing constants (ui-mockups.md palette); not gameplay tunables.
const PALETTE = {
  sky: '#70C5CE',
  pipe: '#5DB02A',
  pipeOutline: '#3E7A1B',
  ground: '#DED895',
  groundStripe: '#8B7B3A',
  text: '#FFFFFF',
  textOutline: '#2B2B2B',
  dim: '#000000',
  highlight: '#FFD54A',
  cloud: '#FFFFFF',
  // Interface: raised panels and buttons, a dark drop shadow and the leaderboard tones.
  shadow: '#14142B',
  panel: '#1F1F36',
  panelEdge: '#5A5A8A',
  face: '#2F2F4A',
  faceHi: '#44445F',
  faceSel: '#4A4A78',
  faceSelHi: '#6A6AA0',
  slot: '#2A2A44',
  slotAlt: '#33334F',
  locked: '#8A8AA0',
  rankGold: '#FFD54A',
  rankSilver: '#C0C8D4',
  rankBronze: '#CD7F32',
  rankOther: '#5A5A8A',
};
// Per-world colours, indexed by world kind. Sky keeps the classic look (same values as PALETTE).
const PALETTES = [
  { sky: PALETTE.sky, cloud: PALETTE.cloud, pipe: PALETTE.pipe, pipeOutline: PALETTE.pipeOutline,
    pipeLight: '#7ED957', pipeDark: '#3E7A1B', ground: PALETTE.ground, groundStripe: PALETTE.groundStripe,
    accent: '#FFF3B0', accent2: '#FFFFFF', arrow: '#FFFFFF',
    haze: '#C4EAEC', far: '#62AEB9', far2: '#559FAC', groundLight: '#EDE8B0', groundDark: '#B5A85A' },
  { sky: '#3E6B48', cloud: '#CFE8C8', pipe: '#6B4A2B', pipeOutline: '#3B2614',
    pipeLight: '#4E9A3A', pipeDark: '#3B2614', ground: '#4A3423', groundStripe: '#2E5E2A',
    accent: '#8BC34A', accent2: '#C5E1A5', arrow: '#FFFFFF',
    haze: '#7FA886', far: '#30573A', far2: '#264A30', groundLight: '#5C4430', groundDark: '#382818' },
  { sky: '#2B2B3A', cloud: '#555566', pipe: '#7A7A85', pipeOutline: '#3A3A44',
    pipeLight: '#9A9AA5', pipeDark: '#4A4A55', ground: '#3A3A44', groundStripe: '#5A5A66',
    accent: '#FF9F1C', accent2: '#FFE066', arrow: '#FFFFFF',
    haze: '#4A4A60', far: '#262636', far2: '#1E1E2B', groundLight: '#4A4A56', groundDark: '#2C2C36' },
  { sky: '#05050F', cloud: '#222244', pipe: '#5A5266', pipeOutline: '#2E2838',
    pipeLight: '#8A8296', pipeDark: '#2E2838', ground: '#2E2838', groundStripe: '#4A4258',
    accent: '#9FA8DA', accent2: '#FFFFFF', arrow: '#FFFFFF',
    haze: '#1B1B3C', far: '#1E1E40', far2: '#161633', groundLight: '#3A3448', groundDark: '#241F30' },
];
// Particle tones, medal colours, skin tints and the rainbow trail.
const TONES = { puff: '#FFFFFF', leaf: '#8BC34A', ember: '#FF9F1C', star: '#FFF59D' };
const MEDAL_COLORS = { bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD700', platinum: '#E5E4E2' };
const SKIN_TINTS = { pumpkin: '#FF8C1A', gold: '#FFD700', starfield: '#1A1A4A' };
const RAINBOW = ['#FF5252', '#FFAB40', '#FFEB3B', '#69F0AE', '#40C4FF', '#7C4DFF', '#E040FB', '#FF4081'];
// How each trail looks: colours cycle along it, alpha fades with age, wobble zigzags it.
const TRAIL_LOOK = {
  soft: { colors: [PALETTE.text], alpha: 0.35, size: 6, wobble: 0 },
  ember: { colors: [TONES.ember, RAINBOW[0]], alpha: 0.7, size: 6, wobble: 0 },
  rainbow: { colors: RAINBOW, alpha: 0.8, size: 8, wobble: 0 },
  stardust: { colors: [TONES.star, PALETTE.text], alpha: 0.8, size: 4, wobble: 4 },
};
const FONT_FAMILY = '"Press Start 2P", monospace';
const GROUND_STRIPE_HEIGHT = 8;
const GROUND_TICK = 24;
const SCORE_Y = 64;
const SCORE_SIZE = 32;

function font(px) {
  return px + 'px ' + FONT_FAMILY;
}

// Text with a dark outline, the shared style for all HUD and overlay text.
function drawText(ctx, str, x, y, size, align, color) {
  ctx.font = font(size);
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, Math.round(size / 4));
  ctx.strokeStyle = PALETTE.textOutline;
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color || PALETTE.text;
  ctx.fillText(str, x, y);
}

const kindOf = (state) => worlds.worldKind(state.worldIndex || 0);

// Linear mix of two #RRGGBB colours.
function mixHex(a, b, t) {
  const ch = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  let out = '#';
  for (let i = 0; i < 3; i++) {
    const v = Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t);
    out += v.toString(16).padStart(2, '0');
  }
  return out;
}

// The current world's palette; during the title card it crossfades to the next world's.
function activePalette(state) {
  const from = PALETTES[kindOf(state)];
  const t = state.transition;
  if (!t || t.phase !== 'card') return from;
  const to = PALETTES[worlds.worldKind(t.nextIndex)];
  const p = 1 - t.cardMs / state.cfg.timing.TITLE_CARD_MS;
  const out = {};
  Object.keys(from).forEach((k) => { out[k] = mixHex(from[k], to[k], p); });
  return out;
}

function drawSky(ctx, cfg, pal = PALETTE) {
  ctx.fillStyle = pal.sky;
  ctx.fillRect(0, 0, cfg.world.WIDTH, cfg.world.HEIGHT);
}

// Clouds sit behind everything else; each has its own alpha.
function drawClouds(ctx, state, pal = PALETTE) {
  if (kindOf(state) >= 2) return; // no clouds in the Castle or Space
  const list = state.clouds || [];
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    ctx.save();
    ctx.globalAlpha = c.alpha;
    ctx.fillStyle = pal.cloud;
    const x = Math.round(c.x);
    const y = Math.round(c.y);
    const w = Math.round(c.width);
    const h = Math.round(c.width * 0.4);
    ctx.fillRect(x, y, w, h);
    ctx.fillRect(x + Math.round(w * 0.15), y - Math.round(h * 0.4), Math.round(w * 0.5), Math.round(h * 0.5));
    ctx.fillRect(x + Math.round(w * 0.55), y - Math.round(h * 0.25), Math.round(w * 0.3), Math.round(h * 0.35));
    ctx.fillStyle = pal.haze; // soft underside
    ctx.fillRect(x, y + h - Math.round(h * 0.3), w, Math.round(h * 0.3));
    ctx.restore();
  }
}

// Obstacles in the current world's style, always inside the collision rectangles.
function drawPipes(ctx, state, pal = PALETTE) {
  const cfg = state.cfg;
  const pairs = state.pipes || [];
  const kind = kindOf(state);
  for (let i = 0; i < pairs.length; i++) {
    art.drawObstacle(ctx, kind, pipesMod.pipeRects(cfg, pairs[i]), pal);
  }
}

// Scrolling ground: ticks shift left with groundOffset and wrap every GROUND_TICK.
function drawGround(ctx, state, pal = PALETTE) {
  const cfg = state.cfg;
  const top = cfg.world.GROUND_TOP;
  const w = cfg.world.WIDTH;
  ctx.fillStyle = pal.ground;
  ctx.fillRect(0, top, w, cfg.world.GROUND_HEIGHT);
  ctx.fillStyle = pal.groundStripe;
  ctx.fillRect(0, top, w, GROUND_STRIPE_HEIGHT);
  const shift = Math.round((((state.groundOffset || 0) % GROUND_TICK) + GROUND_TICK) % GROUND_TICK);
  for (let x = -shift; x < w; x += GROUND_TICK) {
    ctx.fillRect(x, top + GROUND_STRIPE_HEIGHT, GROUND_TICK / 2, GROUND_STRIPE_HEIGHT / 2);
  }
  // Lit edge on top, then dirt speckles that scroll with the ticks.
  ctx.fillStyle = pal.groundLight;
  ctx.fillRect(0, top, w, 2);
  ctx.fillStyle = pal.groundDark;
  for (let x = -shift, k = 0; x < w; x += GROUND_TICK, k++) {
    const row = top + 26 + (k % 3) * 12;
    ctx.fillRect(x + ((k * 7) % 14) + 2, row, 6, 3);
    ctx.fillRect(x + ((k * 5) % 11) + 12, row + 16, 4, 3);
  }
}

// True when invincibility blinking hides the ghost (odd BLINK_MS intervals).
function ghostHidden(state) {
  const t = state.cfg.timing;
  if (!(state.invincibleMs > 0)) return false;
  const elapsed = Math.max(0, t.INVINCIBILITY_MS - state.invincibleMs);
  return Math.floor(elapsed / t.BLINK_MS) % 2 === 1;
}

// Tinted copy of an image (white for crash flashes, colours for skins). Needs a canvas
// factory; built once and cached per source image and tint.
const tintCache = new WeakMap();
function tintedCopy(img, size, createCanvas, color = '#ffffff', alpha = 1) {
  if (!img || typeof createCanvas !== 'function') return null;
  const byTint = tintCache.get(img) || {};
  const key = color + '@' + alpha;
  const hit = byTint[key];
  if (hit && hit.size === size) return hit.canvas;
  const c = createCanvas(img.width || size, img.height || size);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  byTint[key] = { size, canvas: c };
  tintCache.set(img, byTint);
  return c;
}

// The chosen skin if it is unlocked, otherwise the classic look.
const activeSkin = (state) => (isUnlocked(state.skin, state.bestMedal) ? skinById(state.skin).id : 'classic');
const activeTrail = (state) => (isTrailUnlocked(state.trailStyle, state.bestMedal) ? trailById(state.trailStyle).id : 'soft');

// assets: { sprite, sheet } (either may be null). opts.createCanvas(w, h) enables tinting.
function drawGhost(ctx, state, assets, opts) {
  if (ghostHidden(state)) return;
  const cfg = state.cfg;
  const a = assets || {};
  const useSheet = !!a.sheet;
  const f = animation.currentFrame(state, useSheet);
  const dest = animation.frameDest(cfg, state.ghost);
  const s = cfg.ghost.SPRITE_SIZE;
  const cx = dest.x + dest.w / 2;
  const cy = dest.y + dest.h / 2;

  ctx.save();
  ctx.translate(cx, cy + f.offsetY);
  ctx.rotate(f.rotation);
  ctx.scale(f.scaleX, f.scaleY);
  if (useSheet) {
    const src = animation.sheetSource(cfg, f.sheetIndex);
    ctx.drawImage(a.sheet, src.x, src.y, src.w, src.h, -s / 2, -s / 2, s, s);
  } else if (a.sprite) {
    const skinTint = SKIN_TINTS[activeSkin(state)];
    const tint = f.tint ? ['#ffffff', 1] : skinTint ? [skinTint, 0.55] : null;
    const make = opts && opts.createCanvas;
    const tinted = tint ? tintedCopy(a.sprite, s, make, tint[0], tint[1]) : null;
    ctx.drawImage(tinted || a.sprite, -s / 2, -s / 2, s, s);
  } else {
    assetsMod.drawFallbackSprite(ctx, 0, 0);
  }
  ctx.restore();
}

// Score at the top center, shown while a round is on screen.
function drawScore(ctx, state) {
  drawText(ctx, String(state.score), state.cfg.world.WIDTH / 2, SCORE_Y, SCORE_SIZE, 'center');
}

const BUTTON_LABELS = { PLAY: 'PLAY', HIGH_SCORES: 'HIGH SCORES', BACK: 'BACK', RESTART: 'RESTART', MENU: 'MENU' };
const TITLE_Y = 140;
const MENU_BEST_Y = 372;
const MENU_HINT_Y = 520;
const PAUSED_Y = 280;
const PAUSED_HINT_Y = 320;
const GAME_OVER_Y = 80;
const GAME_OVER_PANEL = { y: 110, h: 270, pad: 16 };
const TOP_ROW_GAP = 22;
const GAME_OVER_HINT_Y = 530;
const HINT_SIZE = 10;
const LABEL_SIZE = 14;
const ICON_ALPHA = 0.6;

// Raised button with a centered label; the selected one gets a white border, a lighter face
// and a pointer on each side.
// sub (optional): a small second line under the label, such as the play mode. A button with a sub
// line has arrow buttons beside it, so it marks selection with the border and lit face only.
function drawButton(ctx, cfg, name, selected, sub) {
  const r = menuMod.buttonRect(cfg, name);
  ctx.fillStyle = PALETTE.shadow;
  ctx.fillRect(r.x, r.y + 4, r.w, r.h);
  ctx.fillStyle = selected ? PALETTE.faceSel : PALETTE.face;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = selected ? PALETTE.faceSelHi : PALETTE.faceHi;
  ctx.fillRect(r.x + 3, r.y + 3, r.w - 6, 3);
  ctx.lineWidth = 3;
  ctx.strokeStyle = selected ? PALETTE.text : PALETTE.pipeOutline;
  ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
  if (selected && !sub) {
    const cy = r.y + r.h / 2;
    ctx.fillStyle = PALETTE.highlight;
    ctx.beginPath();
    ctx.moveTo(r.x - 18, cy - 7);
    ctx.lineTo(r.x - 6, cy);
    ctx.lineTo(r.x - 18, cy + 7);
    ctx.moveTo(r.x + r.w + 18, cy - 7);
    ctx.lineTo(r.x + r.w + 6, cy);
    ctx.lineTo(r.x + r.w + 18, cy + 7);
    ctx.fill();
  }
  if (sub) {
    drawText(ctx, BUTTON_LABELS[name], r.x + r.w / 2, r.y + r.h / 2 - 7, LABEL_SIZE, 'center');
    drawText(ctx, sub, r.x + r.w / 2, r.y + r.h / 2 + 11, 8, 'center', PALETTE.highlight);
  } else {
    drawText(ctx, BUTTON_LABELS[name], r.x + r.w / 2, r.y + r.h / 2, LABEL_SIZE, 'center');
  }
}

// Square arrow button; dir -1 points left, +1 right. Shared by the choice rows and the mode picker.
function drawArrowButton(ctx, r, dir, lit) {
  const mx = r.x + r.w / 2;
  ctx.fillStyle = PALETTE.shadow;
  ctx.fillRect(r.x, r.y + 3, r.w, r.h);
  ctx.fillStyle = lit ? PALETTE.faceSel : PALETTE.face;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = lit ? PALETTE.faceSelHi : PALETTE.faceHi;
  ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, 2);
  ctx.fillStyle = lit ? PALETTE.highlight : PALETTE.text;
  ctx.beginPath();
  ctx.moveTo(mx - dir * 5, r.y + r.h * 0.25);
  ctx.lineTo(mx + dir * 5, r.y + r.h / 2);
  ctx.lineTo(mx - dir * 5, r.y + r.h * 0.75);
  ctx.fill();
}

// Raised dark panel with a light edge, the shared frame for overlays and cards.
function drawPanel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.shadow;
  ctx.fillRect(x, y + 4, w, h);
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x, y, w, h);
  ctx.lineWidth = 2;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function drawDim(ctx, cfg) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = PALETTE.dim;
  ctx.fillRect(0, 0, cfg.world.WIDTH, cfg.world.HEIGHT);
  ctx.restore();
}

// Mute (speaker, with a cross when muted) and pause (two bars) icons. opts.muted comes from the audio player.
function drawIcons(ctx, state, opts) {
  const cfg = state.cfg;
  const m = menuMod.iconRect(cfg, 'MUTE');
  const p = menuMod.iconRect(cfg, 'PAUSE');
  const muted = !!(opts && opts.muted);
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = PALETTE.shadow;
  ctx.fillRect(m.x - 4, m.y - 4, m.w + 8, m.h + 8);
  ctx.fillRect(p.x - 4, p.y - 4, p.w + 8, p.h + 8);
  ctx.globalAlpha = ICON_ALPHA;
  ctx.fillStyle = PALETTE.text;
  ctx.strokeStyle = PALETTE.textOutline;
  ctx.lineWidth = 2;
  // speaker body and cone
  ctx.fillRect(m.x + m.w * 0.15, m.y + m.h * 0.35, m.w * 0.2, m.h * 0.3);
  ctx.beginPath();
  ctx.moveTo(m.x + m.w * 0.35, m.y + m.h * 0.35);
  ctx.lineTo(m.x + m.w * 0.6, m.y + m.h * 0.15);
  ctx.lineTo(m.x + m.w * 0.6, m.y + m.h * 0.85);
  ctx.lineTo(m.x + m.w * 0.35, m.y + m.h * 0.65);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  if (muted) {
    ctx.strokeStyle = PALETTE.highlight;
    ctx.moveTo(m.x + m.w * 0.7, m.y + m.h * 0.35);
    ctx.lineTo(m.x + m.w * 0.95, m.y + m.h * 0.65);
    ctx.moveTo(m.x + m.w * 0.95, m.y + m.h * 0.35);
    ctx.lineTo(m.x + m.w * 0.7, m.y + m.h * 0.65);
  } else {
    ctx.moveTo(m.x + m.w * 0.72, m.y + m.h * 0.35);
    ctx.lineTo(m.x + m.w * 0.72, m.y + m.h * 0.65);
    ctx.moveTo(m.x + m.w * 0.88, m.y + m.h * 0.25);
    ctx.lineTo(m.x + m.w * 0.88, m.y + m.h * 0.75);
  }
  ctx.stroke();
  // pause bars
  ctx.fillRect(p.x + p.w * 0.25, p.y + p.h * 0.2, p.w * 0.17, p.h * 0.6);
  ctx.fillRect(p.x + p.w * 0.58, p.y + p.h * 0.2, p.w * 0.17, p.h * 0.6);
  ctx.restore();
}

// Ranked list of the best scores, or a placeholder when there are none. Rows start at y and are
// TOP_ROW_GAP apart. The caller picks x and alignment. markScore (optional) puts a pointer beside
// the first row with that score, so a finished run can find itself on the board.
function drawTopScores(ctx, state, x, y, align, size, markScore) {
  const top = state.topScores || [];
  if (top.length === 0) {
    drawText(ctx, 'No scores yet', x, y, size, align);
    return;
  }
  const marked = markScore === undefined ? -1 : top.indexOf(markScore);
  top.forEach((score, i) => {
    drawText(ctx, (i + 1) + '. ' + score, x, y + i * TOP_ROW_GAP, size, align, i === 0 ? PALETTE.highlight : undefined);
  });
  if (marked >= 0) {
    const my = y + marked * TOP_ROW_GAP;
    ctx.fillStyle = PALETTE.highlight;
    ctx.beginPath();
    ctx.moveTo(x - 62, my - 6);
    ctx.lineTo(x - 50, my);
    ctx.lineTo(x - 62, my + 6);
    ctx.fill();
  }
}

// Small pixel trophy (cup, stem and base).
function drawTrophy(ctx, x, y) {
  ctx.fillStyle = PALETTE.textOutline;
  ctx.fillRect(x - 11, y - 12, 22, 24);
  ctx.fillStyle = PALETTE.rankGold;
  ctx.fillRect(x - 8, y - 10, 16, 10);
  ctx.fillRect(x - 12, y - 9, 4, 6);
  ctx.fillRect(x + 8, y - 9, 4, 6);
  ctx.fillRect(x - 5, y, 10, 4);
  ctx.fillRect(x - 2, y + 4, 4, 4);
  ctx.fillRect(x - 7, y + 8, 14, 3);
  ctx.fillStyle = PALETTE.text;
  ctx.fillRect(x - 5, y - 8, 3, 6);
}

const RANK_COLORS = [PALETTE.rankGold, PALETTE.rankSilver, PALETTE.rankBronze];
const BOARD = { y: 92, h: 296, rowY: 172, rowGap: 38, rowH: 32, slots: 5 };

// World a score reached, as a short label ("THE FOREST", "SPACE LOOP 2").
function worldLabelFor(score, P) {
  const index = worlds.worldIndexFor(score, P);
  const loop = worlds.loopOf(index);
  return worlds.worldOf(index).title + (loop > 0 ? ' L' + (loop + 1) : '');
}

// The High_Scores panel: one slot per rank with a coloured badge, the world each run reached, its
// medal and the score. Empty slots stay visible but dim, so the board shows how much room is left.
function drawLeaderboard(ctx, state) {
  const cfg = state.cfg;
  const cx = cfg.world.WIDTH / 2;
  const x = cfg.ui.BUTTON_X - 60;
  const w = cfg.ui.BUTTON_WIDTH + 120;
  const P = (state.baseCfg || cfg).world.POINTS_PER_WORLD;
  const top = state.topScores || [];
  drawPanel(ctx, x, BOARD.y, w, BOARD.h);
  ctx.fillStyle = PALETTE.panelEdge;
  ctx.fillRect(x + 2, BOARD.y + 54, w - 4, 2);
  drawTrophy(ctx, x + 36, BOARD.y + 28);
  drawTrophy(ctx, x + w - 36, BOARD.y + 28);
  drawText(ctx, 'HIGH SCORES', cx, BOARD.y + 28, 18, 'center');
  for (let i = 0; i < BOARD.slots; i++) {
    const y = BOARD.rowY + i * BOARD.rowGap;
    const score = top[i];
    ctx.fillStyle = i % 2 === 0 ? PALETTE.slot : PALETTE.slotAlt;
    ctx.fillRect(x + 12, y - BOARD.rowH / 2, w - 24, BOARD.rowH);
    ctx.fillStyle = score === undefined ? PALETTE.slotAlt : RANK_COLORS[i] || PALETTE.rankOther;
    ctx.fillRect(x + 18, y - 12, 24, 24);
    ctx.fillStyle = PALETTE.textOutline;
    ctx.fillRect(x + 18, y + 8, 24, 4);
    if (score === undefined) continue;
    drawText(ctx, String(i + 1), x + 30, y - 1, 12, 'center');
    drawText(ctx, worldLabelFor(score, P), x + 52, y, 8, 'left', i === 0 ? PALETTE.highlight : PALETTE.text);
    drawMedal(ctx, medalFor(score, P), x + w - 112, y);
    drawText(ctx, String(score), x + w - 20, y, 16, 'right', i === 0 ? PALETTE.highlight : PALETTE.text);
  }
  if (top.length === 0) drawText(ctx, 'No scores yet', cx, BOARD.rowY + 2 * BOARD.rowGap, 14, 'center');
  const bestMedal = betterMedal(state.bestMedal || null, medalFor(state.highScore, P));
  drawText(ctx, 'BEST MEDAL', x + 20, BOARD.y + BOARD.h - 24, 8, 'left');
  if (bestMedal) {
    drawMedal(ctx, bestMedal, x + 138, BOARD.y + BOARD.h - 24);
    drawText(ctx, bestMedal.toUpperCase(), x + 156, BOARD.y + BOARD.h - 24, 8, 'left', MEDAL_COLORS[bestMedal]);
  } else {
    drawText(ctx, 'NONE YET', x + 126, BOARD.y + BOARD.h - 24, 8, 'left', PALETTE.locked);
  }
}

function drawMainMenu(ctx, state, assets, opts) {
  const cfg = state.cfg;
  const cx = cfg.world.WIDTH / 2;
  const menu = state.menu || menuMod.initialMenu();
  if (menu.panelOpen) {
    drawLeaderboard(ctx, state);
    drawButton(ctx, cfg, 'BACK', true);
    return;
  }
  const clock = state.animClockMs || 0;
  const bob = Math.round(Math.sin(clock / 400) * 2);
  drawText(ctx, 'FLAPPY KIRO', cx + 3, TITLE_Y + 3 + bob, 28, 'center', PALETTE.shadow);
  drawText(ctx, 'FLAPPY KIRO', cx, TITLE_Y + bob, 28, 'center');
  ctx.fillStyle = PALETTE.highlight;
  ctx.fillRect(cx - 100, TITLE_Y + 26, 200, 4);
  ctx.fillStyle = PALETTE.text;
  ctx.fillRect(cx - 4, TITLE_Y + 24, 8, 8);
  drawSkinSelector(ctx, state, assets, opts);
  const playMode = worlds.playModeById(state.playMode);
  const single = worlds.singleWorldIndex(playMode.id) !== null;
  const best = single ? (state.worldBests || {})[playMode.id] || 0 : state.highScore;
  drawText(ctx, (single ? playMode.name + ' BEST: ' : 'BEST: ') + best, cx, MENU_BEST_Y, single ? 10 : LABEL_SIZE, 'center', PALETTE.highlight);
  drawButton(ctx, cfg, 'PLAY', menu.selected === 'PLAY', playMode.name);
  const modeLit = state.editRow === 'MODE';
  drawArrowButton(ctx, menuMod.buttonRect(cfg, 'MODE_PREV'), -1, modeLit);
  drawArrowButton(ctx, menuMod.buttonRect(cfg, 'MODE_NEXT'), 1, modeLit);
  drawButton(ctx, cfg, 'HIGH_SCORES', menu.selected === 'HIGH_SCORES');
  ctx.save();
  ctx.globalAlpha = 0.65 + 0.35 * Math.abs(Math.sin(clock / 600)); // the hint breathes
  drawText(ctx, 'Press SPACE or tap to play', cx, MENU_HINT_Y, HINT_SIZE, 'center');
  ctx.restore();
  drawText(ctx, 'TAB: skin / trail / mode   LEFT/RIGHT: change', cx, MENU_HINT_Y + 20, 8, 'center');
}

function drawPaused(ctx, state) {
  const cx = state.cfg.world.WIDTH / 2;
  drawDim(ctx, state.cfg);
  drawScore(ctx, state);
  drawPanel(ctx, cx - 130, PAUSED_Y - 44, 260, 108);
  drawText(ctx, 'PAUSED', cx, PAUSED_Y, 24, 'center');
  drawText(ctx, 'Press P to resume', cx, PAUSED_HINT_Y, HINT_SIZE, 'center');
}

// Shown once the Crash_Animation has finished (crashMs <= 0).
function drawGameOver(ctx, state) {
  const cfg = state.cfg;
  const cx = cfg.world.WIDTH / 2;
  const px = cfg.ui.BUTTON_X - 40;
  const pw = cfg.ui.BUTTON_WIDTH + 80;
  const pad = GAME_OVER_PANEL.pad;
  drawDim(ctx, cfg);
  drawText(ctx, 'GAME OVER', cx + 3, GAME_OVER_Y + 3, 28, 'center', PALETTE.shadow);
  drawText(ctx, 'GAME OVER', cx, GAME_OVER_Y, 28, 'center');
  drawPanel(ctx, px, GAME_OVER_PANEL.y, pw, GAME_OVER_PANEL.h);
  const top = GAME_OVER_PANEL.y;
  drawText(ctx, 'SCORE', px + pad, top + 28, LABEL_SIZE, 'left');
  drawText(ctx, String(state.score), px + pw - pad, top + 28, LABEL_SIZE, 'right');
  const mode = worlds.playModeById(state.playMode);
  const single = worlds.singleWorldIndex(mode.id) !== null;
  const P = (state.baseCfg || cfg).world.POINTS_PER_WORLD;
  if (!single) {
    // Medals measure how far the journey got, so only journey runs show them.
    const bestMedal = betterMedal(state.bestMedal || null, medalFor(state.highScore, P));
    drawMedal(ctx, medalFor(state.score, P), px + pw - pad - 80, top + 28);
    drawMedal(ctx, bestMedal, px + pw - pad - 80, top + 54);
  }
  const bests = state.worldBests || {};
  drawText(ctx, 'BEST', px + pad, top + 54, LABEL_SIZE, 'left');
  drawText(ctx, String(single ? bests[mode.id] || 0 : state.highScore), px + pw - pad, top + 54, LABEL_SIZE, 'right');
  if (state.newHighScore) {
    drawText(ctx, 'NEW BEST!', px + pad, top + 80, LABEL_SIZE, 'left', PALETTE.highlight);
  }
  drawText(ctx, mode.name, px + pw - pad, top + 80, 8, 'right', PALETTE.locked);
  ctx.fillStyle = PALETTE.panelEdge;
  ctx.fillRect(px + pad, top + 98, pw - 2 * pad, 2);
  if (!single) {
    drawText(ctx, 'TOP 5', cx, top + 116, HINT_SIZE + 2, 'center');
    drawTopScores(ctx, state, cx, top + 144, 'center', HINT_SIZE + 2, state.score);
  } else {
    // Single-world runs: the best in every world, with this one marked.
    drawText(ctx, 'WORLD BESTS', cx, top + 116, HINT_SIZE + 2, 'center');
    worlds.WORLDS.forEach((w, i) => {
      const y = top + 144 + i * TOP_ROW_GAP;
      const here = w.id === mode.id;
      const color = here ? PALETTE.highlight : PALETTE.text;
      drawText(ctx, worlds.playModeById(w.id).name.replace(' ONLY', ''), px + pad + 16, y, HINT_SIZE, 'left', color);
      drawText(ctx, String(bests[w.id] || 0), px + pw - pad, y, HINT_SIZE + 2, 'right', color);
      if (here) {
        ctx.fillStyle = PALETTE.highlight;
        ctx.beginPath();
        ctx.moveTo(px + pad, y - 5);
        ctx.lineTo(px + pad + 10, y);
        ctx.lineTo(px + pad, y + 5);
        ctx.fill();
      }
    });
  }
  const selected = state.menu && state.menu.selected === 'MENU' ? 'MENU' : 'RESTART';
  drawButton(ctx, cfg, 'RESTART', selected === 'RESTART');
  drawButton(ctx, cfg, 'MENU', selected === 'MENU');
  drawText(ctx, 'SPACE/ENTER to select, UP/DOWN to move', cx, GAME_OVER_HINT_Y, HINT_SIZE, 'center');
}
// Fading trail behind Ghosty: older samples sit further left (they scrolled with the world).
function drawTrail(ctx, state) {
  const list = state.trail || [];
  if (!list.length || ghostHidden(state)) return;
  const cfg = state.cfg;
  const look = TRAIL_LOOK[activeTrail(state)];
  const n = cfg.trail.LENGTH;
  ctx.save();
  list.forEach((p, i) => {
    const x = Math.round(cfg.ghost.X - (p.ageMs / 1000) * state.speed - 6);
    const wobble = i % 2 === 0 ? look.wobble : -look.wobble;
    ctx.globalAlpha = look.alpha * (1 - i / n);
    ctx.fillStyle = look.colors[i % look.colors.length];
    ctx.fillRect(x - look.size / 2, Math.round(p.y + wobble - look.size / 2), look.size, look.size);
  });
  ctx.restore();
}

// Cosmetic particles and "+1" popups, fading out over their life.
function drawParticles(ctx, state) {
  const list = (state.fx && state.fx.list) || [];
  if (!list.length) return;
  ctx.save();
  for (const p of list) {
    ctx.globalAlpha = Math.max(0, 1 - p.ageMs / p.lifeMs);
    if (p.text) {
      drawText(ctx, p.text, Math.round(p.x), Math.round(p.y), p.size, 'center', PALETTE.highlight);
    } else {
      ctx.fillStyle = TONES[p.tone] || PALETTE.text;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
  }
  ctx.restore();
}

// "WORLD 2 - THE FOREST" banner during a transition, fading in and out over TITLE_CARD_MS.
function drawTitleCard(ctx, state) {
  const t = state.transition;
  if (!t || t.phase !== 'card') return;
  const cfg = state.cfg;
  const p = 1 - t.cardMs / cfg.timing.TITLE_CARD_MS;
  const alpha = Math.max(0, Math.min(1, p / 0.25, (1 - p) / 0.25));
  const title = worlds.titleFor(t.nextIndex);
  const cy = cfg.world.GROUND_TOP / 2;
  ctx.save();
  ctx.globalAlpha = 0.5 * alpha;
  ctx.fillStyle = PALETTE.dim;
  ctx.fillRect(0, cy - 44, cfg.world.WIDTH, 88);
  ctx.globalAlpha = alpha;
  drawText(ctx, title.line1, cfg.world.WIDTH / 2, cy - (title.line2 ? 10 : 0), 16, 'center');
  if (title.line2) drawText(ctx, title.line2, cfg.world.WIDTH / 2, cy + 22, 12, 'center', PALETTE.highlight);
  ctx.restore();
}

// Small current-world label under the score while playing.
function drawWorldLabel(ctx, state) {
  const w = worlds.worldOf(state.worldIndex || 0);
  const loop = worlds.loopOf(state.worldIndex || 0);
  const single = worlds.singleWorldIndex(state.playMode) !== null;
  const label = single ? worlds.playModeById(state.playMode).name : w.id.toUpperCase() + (loop > 0 ? '  LOOP ' + (loop + 1) : '');
  drawText(ctx, label, state.cfg.world.WIDTH / 2, 96, 8, 'center');
}

// Medal disc (nothing for no medal).
function drawMedal(ctx, medal, x, y) {
  if (!medal) return;
  ctx.fillStyle = PALETTE.textOutline;
  ctx.fillRect(x - 9, y - 9, 18, 18);
  ctx.fillStyle = MEDAL_COLORS[medal];
  ctx.fillRect(x - 7, y - 7, 14, 14);
  ctx.fillStyle = PALETTE.text;
  ctx.fillRect(x - 3, y - 5, 3, 3);
}

// Main-menu choice rows. The skin row and the trail row each show the previous choice, the
// current one and the next one, with an arrow square at each end (the click areas). Neighbours are
// dimmed; locked choices carry a padlock and the current one says which medal unlocks it.
const ROW_W = 440;
const ROW_SPREAD = 110; // distance between neighbouring previews
const PLATE_W = 84;
const PLATE_H = 34;
const PREVIEW_SPRITE = 26;
const SKIN_BODY = '#FFFFFF';

// Padlock: shackle over a body.
function drawPadlock(ctx, x, y) {
  ctx.fillStyle = PALETTE.textOutline;
  ctx.fillRect(x - 8, y - 12, 16, 24);
  ctx.fillStyle = PALETTE.locked;
  ctx.fillRect(x - 5, y - 10, 10, 6);
  ctx.fillRect(x - 6, y - 2, 12, 10);
  ctx.fillStyle = PALETTE.textOutline;
  ctx.fillRect(x - 5, y - 8, 10, 4);
  ctx.fillRect(x - 1, y + 1, 2, 4);
}

// Mini Ghosty in a skin, with the given trail behind it (trailId null = no trail). Uses the real
// sprite (tinted like in the game) when it is loaded, otherwise a plain square.
function drawPreview(ctx, skinId, trailId, x, y, assets, opts) {
  if (trailId) {
    const look = TRAIL_LOOK[trailId];
    const a = ctx.globalAlpha;
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = a * Math.max(0.6, look.alpha) * (1 - i / 4); // faint trails stay visible here
      ctx.fillStyle = look.colors[i % look.colors.length];
      const wobble = i % 2 === 0 ? look.wobble : -look.wobble;
      ctx.fillRect(x - 17 - i * 9 - look.size / 2, y + wobble - look.size / 2, look.size, look.size);
    }
    ctx.globalAlpha = a;
  }
  const sprite = assets && assets.sprite;
  if (sprite) {
    const tint = SKIN_TINTS[skinId];
    const make = opts && opts.createCanvas;
    const img = tint ? tintedCopy(sprite, PREVIEW_SPRITE, make, tint, 0.55) || sprite : sprite;
    ctx.drawImage(img, x - PREVIEW_SPRITE / 2, y - PREVIEW_SPRITE / 2, PREVIEW_SPRITE, PREVIEW_SPRITE);
    return;
  }
  ctx.fillStyle = PALETTE.textOutline;
  ctx.fillRect(x - 11, y - 11, 22, 22);
  ctx.fillStyle = SKIN_TINTS[skinId] || SKIN_BODY;
  ctx.fillRect(x - 9, y - 9, 18, 18);
  ctx.fillStyle = PALETTE.textOutline; // eyes
  ctx.fillRect(x - 5, y - 4, 3, 5);
  ctx.fillRect(x + 2, y - 4, 3, 5);
}

function drawChoiceRow(ctx, state, row, assets, opts) {
  const cfg = state.cfg;
  const u = cfg.ui;
  const isSkinRow = row === 'SKIN';
  const list = isSkinRow ? SKINS : TRAILS;
  const currentId = isSkinRow ? state.skin : state.trailStyle;
  const current = list.find((k) => k.id === currentId) || list[0];
  const open = isSkinRow ? isUnlocked : isTrailUnlocked;
  const active = (state.editRow || 'SKIN') === row;
  const rowY = isSkinRow ? u.SKIN_ROW_Y : u.TRAIL_ROW_Y;
  const cx = cfg.world.WIDTH / 2;
  const left = cx - ROW_W / 2;
  // Flat translucent row: the scene shows through, the edge turns yellow on the active row.
  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(left, rowY, ROW_W, u.ROW_HEIGHT);
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = active ? PALETTE.highlight : PALETTE.panelEdge;
  ctx.strokeRect(left + 1, rowY + 1, ROW_W - 2, u.ROW_HEIGHT - 2);
  drawText(ctx, row, left + 8, rowY + 8, 8, 'left', active ? PALETTE.highlight : PALETTE.text);
  // Arrow squares: the tip points the way the row will move.
  [isSkinRow ? 'SKIN_PREV' : 'TRAIL_PREV', isSkinRow ? 'SKIN_NEXT' : 'TRAIL_NEXT'].forEach((name, i) => {
    drawArrowButton(ctx, menuMod.buttonRect(cfg, name), i === 0 ? -1 : 1, false);
  });
  const plateY = rowY + 4;
  [-1, 0, 1].forEach((offset) => {
    const item = offset === 0 ? current : neighbour(list, current.id, offset);
    const x = cx + offset * ROW_SPREAD;
    // Each choice sits on its own plate, so dark skins stay visible; the current one is lit.
    ctx.fillStyle = offset === 0 ? PALETTE.faceSel : PALETTE.slot;
    ctx.fillRect(x - PLATE_W / 2, plateY, PLATE_W, PLATE_H);
    if (offset === 0) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = PALETTE.text;
      ctx.strokeRect(x - PLATE_W / 2 + 1, plateY + 1, PLATE_W - 2, PLATE_H - 2);
    }
    const chipX = isSkinRow ? x : x + 14;
    const chipY = plateY + PLATE_H / 2;
    ctx.save();
    ctx.globalAlpha = offset === 0 ? 1 : 0.6;
    drawPreview(ctx, isSkinRow ? item.id : activeSkin(state), isSkinRow ? null : item.id, chipX, chipY, assets, opts);
    ctx.restore();
    if (!open(item.id, state.bestMedal)) drawPadlock(ctx, chipX, chipY);
  });
  const unlocked = open(current.id, state.bestMedal);
  const label = unlocked ? current.name : current.name + ' - ' + current.unlock.toUpperCase() + ' MEDAL';
  drawText(ctx, label, cx, rowY + 47, 8, 'center', unlocked ? PALETTE.text : PALETTE.highlight);
}

function drawSkinSelector(ctx, state, assets, opts) {
  drawChoiceRow(ctx, state, 'SKIN', assets, opts);
  drawChoiceRow(ctx, state, 'TRAIL', assets, opts);
}

// Menu, High_Scores_Panel, HUD icons, Paused and Game_Over overlays. Called last, over the world and ghost.
// opts.muted: current mute state from the audio player (the GameState does not hold it).
function drawUi(ctx, state, assets, opts) { // eslint-disable-line no-unused-vars
  const mode = state.mode;
  if (mode === 'Main_Menu') {
    drawMainMenu(ctx, state, assets, opts);
  } else if (mode === 'Playing') {
    drawScore(ctx, state);
    drawWorldLabel(ctx, state);
  } else if (mode === 'Paused') {
    drawPaused(ctx, state);
  } else if (mode === 'Game_Over' && !(state.crashMs > 0)) {
    drawGameOver(ctx, state);
  }
  if (menuMod.iconsVisible(mode)) drawIcons(ctx, state, opts);
}

// Crash shake: a short decaying offset, deterministic (no rng).
function shakeOffset(state) {
  if (!(state.shakeMs > 0)) return null;
  const f = state.cfg.fx;
  const k = (state.shakeMs / f.SHAKE_MS) * f.SHAKE_PX;
  return { x: Math.round(Math.sin(state.shakeMs * 0.9) * k), y: Math.round(Math.cos(state.shakeMs * 1.3) * k) };
}

// Draw order: sky, backdrop, clouds, obstacles, ground, trail, ghost, particles, then the
// wind cue, the title card and the UI (not shaken).
function render(ctx, state, assets, opts) {
  ctx.imageSmoothingEnabled = false;
  const pal = activePalette(state);
  const t = (state.groundOffset || 0) + (state.animClockMs || 0) * 0.05;
  const shake = shakeOffset(state);
  ctx.save();
  if (shake) ctx.translate(shake.x, shake.y);
  drawSky(ctx, state.cfg, pal);
  art.drawBackdrop(ctx, kindOf(state), state.cfg, pal, t);
  drawClouds(ctx, state, pal);
  drawPipes(ctx, state, pal);
  drawGround(ctx, state, pal);
  if (state.mode === 'Playing' || state.mode === 'Paused') drawTrail(ctx, state);
  drawGhost(ctx, state, assets, opts);
  drawParticles(ctx, state);
  ctx.restore();
  if (state.mode === 'Playing') art.drawWindCue(ctx, state.cfg, pal, state.wind, t);
  drawTitleCard(ctx, state);
  drawUi(ctx, state, assets, opts);
}

// Scales the canvas with CSS to fit the window, preserving the logical aspect ratio.
function fitCanvas(canvas, cfg, winW, winH) {
  const scale = Math.min(winW / cfg.world.WIDTH, winH / cfg.world.HEIGHT);
  canvas.style.width = Math.floor(cfg.world.WIDTH * scale) + 'px';
  canvas.style.height = Math.floor(cfg.world.HEIGHT * scale) + 'px';
  canvas.style.imageRendering = 'pixelated';
  return scale;
}

export { PALETTE, PALETTES, activePalette, FONT_FAMILY, font, drawText, drawSky, drawClouds, drawPipes, drawGround, drawGhost, drawScore, ghostHidden, drawButton, drawIcons, drawMainMenu, drawPaused, drawGameOver, drawUi, render, fitCanvas };
