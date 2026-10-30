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
import { skinById, isUnlocked } from './skins.js';


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
};
// Per-world colours, indexed by world kind. Sky keeps the classic look (same values as PALETTE).
const PALETTES = [
  { sky: PALETTE.sky, cloud: PALETTE.cloud, pipe: PALETTE.pipe, pipeOutline: PALETTE.pipeOutline,
    pipeLight: '#7ED957', pipeDark: '#3E7A1B', ground: PALETTE.ground, groundStripe: PALETTE.groundStripe,
    accent: '#FFFFFF', accent2: '#FFFFFF', arrow: '#FFFFFF' },
  { sky: '#3E6B48', cloud: '#CFE8C8', pipe: '#6B4A2B', pipeOutline: '#3B2614',
    pipeLight: '#4E9A3A', pipeDark: '#3B2614', ground: '#4A3423', groundStripe: '#2E5E2A',
    accent: '#8BC34A', accent2: '#C5E1A5', arrow: '#FFFFFF' },
  { sky: '#2B2B3A', cloud: '#555566', pipe: '#7A7A85', pipeOutline: '#3A3A44',
    pipeLight: '#9A9AA5', pipeDark: '#4A4A55', ground: '#3A3A44', groundStripe: '#5A5A66',
    accent: '#FF9F1C', accent2: '#FFE066', arrow: '#FFFFFF' },
  { sky: '#05050F', cloud: '#222244', pipe: '#5A5266', pipeOutline: '#2E2838',
    pipeLight: '#8A8296', pipeDark: '#2E2838', ground: '#2E2838', groundStripe: '#4A4258',
    accent: '#9FA8DA', accent2: '#FFFFFF', arrow: '#FFFFFF' },
];
// Particle tones, medal colours, skin tints and the rainbow trail.
const TONES = { puff: '#FFFFFF', leaf: '#8BC34A', ember: '#FF9F1C', star: '#FFF59D' };
const MEDAL_COLORS = { bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD700', platinum: '#E5E4E2' };
const SKIN_TINTS = { pumpkin: '#FF8C1A', gold: '#FFD700', starfield: '#1A1A4A' };
const RAINBOW = ['#FF5252', '#FFAB40', '#FFEB3B', '#69F0AE', '#40C4FF', '#7C4DFF', '#E040FB', '#FF4081'];
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
    const h = c.width * 0.4;
    ctx.fillRect(c.x, c.y, c.width, h);
    ctx.fillRect(c.x + c.width * 0.15, c.y - h * 0.4, c.width * 0.5, h * 0.5);
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
  const shift = (((state.groundOffset || 0) % GROUND_TICK) + GROUND_TICK) % GROUND_TICK;
  for (let x = -shift; x < w; x += GROUND_TICK) {
    ctx.fillRect(x, top + GROUND_STRIPE_HEIGHT, GROUND_TICK / 2, GROUND_STRIPE_HEIGHT / 2);
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
const PANEL_BEST_Y = 200;
const PAUSED_Y = 280;
const PAUSED_HINT_Y = 320;
const GAME_OVER_Y = 80;
const GAME_OVER_PANEL = { y: 110, h: 270, pad: 16 };
const TOP_ROW_GAP = 22;
const GAME_OVER_HINT_Y = 530;
const HINT_SIZE = 10;
const LABEL_SIZE = 14;
const ICON_ALPHA = 0.6;

// Button with a centered label; the selected one gets a white border.
function drawButton(ctx, cfg, name, selected) {
  const r = menuMod.buttonRect(cfg, name);
  ctx.fillStyle = PALETTE.textOutline;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.lineWidth = 3;
  ctx.strokeStyle = selected ? PALETTE.text : PALETTE.pipeOutline;
  ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
  drawText(ctx, BUTTON_LABELS[name], r.x + r.w / 2, r.y + r.h / 2, LABEL_SIZE, 'center');
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
// TOP_ROW_GAP apart. Returns nothing; the caller picks x and alignment.
function drawTopScores(ctx, state, x, y, align, size) {
  const top = state.topScores || [];
  if (top.length === 0) {
    drawText(ctx, 'No scores yet', x, y, size, align);
    return;
  }
  top.forEach((score, i) => {
    drawText(ctx, (i + 1) + '. ' + score, x, y + i * TOP_ROW_GAP, size, align, i === 0 ? PALETTE.highlight : undefined);
  });
}
function drawMainMenu(ctx, state) {
  const cfg = state.cfg;
  const cx = cfg.world.WIDTH / 2;
  const menu = state.menu || menuMod.initialMenu();
  if (menu.panelOpen) {
    drawText(ctx, 'HIGH SCORES', cx, TITLE_Y, 20, 'center');
    drawTopScores(ctx, state, cx, PANEL_BEST_Y, 'center', 20);
    drawButton(ctx, cfg, 'BACK', true);
    return;
  }
  drawText(ctx, 'FLAPPY KIRO', cx, TITLE_Y, 28, 'center');
  drawSkinSelector(ctx, state);
  drawText(ctx, 'BEST: ' + state.highScore, cx, MENU_BEST_Y, LABEL_SIZE, 'center', PALETTE.highlight);
  drawButton(ctx, cfg, 'PLAY', menu.selected === 'PLAY');
  drawButton(ctx, cfg, 'HIGH_SCORES', menu.selected === 'HIGH_SCORES');
  drawText(ctx, 'Press SPACE or tap to play', cx, MENU_HINT_Y, HINT_SIZE, 'center');
  drawText(ctx, 'M: mute   P: pause', cx, MENU_HINT_Y + 20, 8, 'center');
}

function drawPaused(ctx, state) {
  const cx = state.cfg.world.WIDTH / 2;
  drawDim(ctx, state.cfg);
  drawScore(ctx, state);
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
  drawText(ctx, 'GAME OVER', cx, GAME_OVER_Y, 28, 'center');
  ctx.fillStyle = PALETTE.textOutline;
  ctx.fillRect(px, GAME_OVER_PANEL.y, pw, GAME_OVER_PANEL.h);
  ctx.lineWidth = 3;
  ctx.strokeStyle = PALETTE.text;
  ctx.strokeRect(px + 1.5, GAME_OVER_PANEL.y + 1.5, pw - 3, GAME_OVER_PANEL.h - 3);
  const top = GAME_OVER_PANEL.y;
  drawText(ctx, 'SCORE', px + pad, top + 28, LABEL_SIZE, 'left');
  drawText(ctx, String(state.score), px + pw - pad, top + 28, LABEL_SIZE, 'right');
  const P = (state.baseCfg || cfg).world.POINTS_PER_WORLD;
  const bestMedal = betterMedal(state.bestMedal || null, medalFor(state.highScore, P));
  drawMedal(ctx, medalFor(state.score, P), px + pw - pad - 80, top + 28);
  drawMedal(ctx, bestMedal, px + pw - pad - 80, top + 54);
  drawText(ctx, 'BEST', px + pad, top + 54, LABEL_SIZE, 'left');
  drawText(ctx, String(state.highScore), px + pw - pad, top + 54, LABEL_SIZE, 'right');
  if (state.newHighScore) {
    drawText(ctx, 'NEW BEST!', px + pad, top + 80, LABEL_SIZE, 'left', PALETTE.highlight);
  }
  drawText(ctx, 'TOP 5', cx, top + 116, HINT_SIZE + 2, 'center');
  drawTopScores(ctx, state, cx, top + 144, 'center', HINT_SIZE + 2);
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
  const rainbow = activeSkin(state) === 'rainbow';
  const n = cfg.trail.LENGTH;
  ctx.save();
  list.forEach((p, i) => {
    const x = Math.round(cfg.ghost.X - (p.ageMs / 1000) * state.speed - 6);
    ctx.globalAlpha = rainbow ? 0.8 * (1 - i / n) : 0.35 * (1 - i / n);
    ctx.fillStyle = rainbow ? RAINBOW[i % RAINBOW.length] : PALETTE.text;
    const size = rainbow ? 8 : 6;
    ctx.fillRect(x - size / 2, Math.round(p.y - size / 2), size, size);
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
  const label = w.id.toUpperCase() + (loop > 0 ? '  LOOP ' + (loop + 1) : '');
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

// Main-menu skin selector: arrows either side of the skin name; locked skins say what unlocks them.
function drawSkinSelector(ctx, state) {
  const cfg = state.cfg;
  const skin = skinById(state.skin);
  const unlocked = isUnlocked(skin.id, state.bestMedal);
  const prev = menuMod.buttonRect(cfg, 'SKIN_PREV');
  const next = menuMod.buttonRect(cfg, 'SKIN_NEXT');
  const cy = prev.y + prev.h / 2;
  ctx.fillStyle = PALETTE.text;
  ctx.beginPath();
  ctx.moveTo(prev.x + prev.w * 0.7, prev.y + prev.h * 0.2);
  ctx.lineTo(prev.x + prev.w * 0.25, cy);
  ctx.lineTo(prev.x + prev.w * 0.7, prev.y + prev.h * 0.8);
  ctx.closePath();
  ctx.moveTo(next.x + next.w * 0.3, next.y + next.h * 0.2);
  ctx.lineTo(next.x + next.w * 0.75, cy);
  ctx.lineTo(next.x + next.w * 0.3, next.y + next.h * 0.8);
  ctx.closePath();
  ctx.fill();
  const cx = cfg.world.WIDTH / 2;
  drawText(ctx, skin.name, cx, cy - 4, 10, 'center', unlocked ? PALETTE.text : PALETTE.pipeOutline);
  const sub = unlocked ? 'SKIN' : 'LOCKED - ' + skin.unlock.toUpperCase() + ' MEDAL';
  drawText(ctx, sub, cx, cy + 14, 8, 'center', unlocked ? PALETTE.text : PALETTE.highlight);
}

// Menu, High_Scores_Panel, HUD icons, Paused and Game_Over overlays. Called last, over the world and ghost.
// opts.muted: current mute state from the audio player (the GameState does not hold it).
function drawUi(ctx, state, assets, opts) { // eslint-disable-line no-unused-vars
  const mode = state.mode;
  if (mode === 'Main_Menu') {
    drawMainMenu(ctx, state);
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
