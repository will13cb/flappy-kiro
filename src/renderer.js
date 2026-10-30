// Flappy Kiro renderer: draws a GameState on a canvas 2D context.
// 17.1 covers the world (sky, clouds, pipes, ground), the ghost and the score.
// Menu, HUD icons and overlays belong to 17.2: see drawUi below (the extension point).
import * as pipesMod from './pipes.js';
import * as animation from './animation.js';
import * as assetsMod from './assets.js';
import * as menuMod from './menu.js';


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

function drawSky(ctx, cfg) {
  ctx.fillStyle = PALETTE.sky;
  ctx.fillRect(0, 0, cfg.world.WIDTH, cfg.world.HEIGHT);
}

// Clouds sit behind everything else; each has its own alpha.
function drawClouds(ctx, state) {
  const list = state.clouds || [];
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    ctx.save();
    ctx.globalAlpha = c.alpha;
    ctx.fillStyle = PALETTE.cloud;
    const h = c.width * 0.4;
    ctx.fillRect(c.x, c.y, c.width, h);
    ctx.fillRect(c.x + c.width * 0.15, c.y - h * 0.4, c.width * 0.5, h * 0.5);
    ctx.restore();
  }
}

function drawPipes(ctx, state) {
  const cfg = state.cfg;
  const pairs = state.pipes || [];
  ctx.lineWidth = 2;
  for (let i = 0; i < pairs.length; i++) {
    const rects = pipesMod.pipeRects(cfg, pairs[i]);
    for (let j = 0; j < rects.length; j++) {
      const r = rects[j];
      if (r.w <= 0 || r.h <= 0) continue;
      ctx.fillStyle = PALETTE.pipe;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = PALETTE.pipeOutline;
      ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    }
  }
}

// Scrolling ground: ticks shift left with groundOffset and wrap every GROUND_TICK.
function drawGround(ctx, state) {
  const cfg = state.cfg;
  const top = cfg.world.GROUND_TOP;
  const w = cfg.world.WIDTH;
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, top, w, cfg.world.GROUND_HEIGHT);
  ctx.fillStyle = PALETTE.groundStripe;
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

// White copy of an image for crash flashes. Needs a canvas factory; cached per source image.
const tintCache = new WeakMap();
function tintedCopy(img, size, createCanvas) {
  if (!img || typeof createCanvas !== 'function') return null;
  const key = img;
  const hit = tintCache.get(key);
  if (hit && hit.size === size) return hit.canvas;
  const c = createCanvas(img.width || size, img.height || size);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  tintCache.set(key, { size, canvas: c });
  return c;
}

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
    const tinted = f.tint ? tintedCopy(a.sprite, s, opts && opts.createCanvas) : null;
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

const BUTTON_LABELS = { PLAY: 'PLAY', HIGH_SCORES: 'HIGH SCORES', BACK: 'BACK', RESTART: 'RESTART' };
const TITLE_Y = 140;
const MENU_BEST_Y = 372;
const MENU_HINT_Y = 520;
const PANEL_BEST_Y = 240;
const PAUSED_Y = 280;
const PAUSED_HINT_Y = 320;
const GAME_OVER_Y = 160;
const GAME_OVER_PANEL = { y: 220, h: 120, pad: 16 };
const GAME_OVER_HINT_Y = 460;
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

function drawMainMenu(ctx, state) {
  const cfg = state.cfg;
  const cx = cfg.world.WIDTH / 2;
  const menu = state.menu || menuMod.initialMenu();
  if (menu.panelOpen) {
    drawText(ctx, 'HIGH SCORES', cx, TITLE_Y, 20, 'center');
    drawText(ctx, 'BEST: ' + state.highScore, cx, PANEL_BEST_Y, 24, 'center', PALETTE.highlight);
    drawButton(ctx, cfg, 'BACK', true);
    return;
  }
  drawText(ctx, 'FLAPPY KIRO', cx, TITLE_Y, 28, 'center');
  drawText(ctx, 'BEST: ' + state.highScore, cx, MENU_BEST_Y, LABEL_SIZE, 'center', PALETTE.highlight);
  drawButton(ctx, cfg, 'PLAY', menu.selected === 'PLAY');
  drawButton(ctx, cfg, 'HIGH_SCORES', menu.selected === 'HIGH_SCORES');
  drawText(ctx, 'Press SPACE or tap to play', cx, MENU_HINT_Y, HINT_SIZE, 'center');
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
  drawText(ctx, 'SCORE', px + pad, GAME_OVER_PANEL.y + 32, LABEL_SIZE, 'left');
  drawText(ctx, String(state.score), px + pw - pad, GAME_OVER_PANEL.y + 32, LABEL_SIZE, 'right');
  drawText(ctx, 'BEST', px + pad, GAME_OVER_PANEL.y + 64, LABEL_SIZE, 'left');
  drawText(ctx, String(state.highScore), px + pw - pad, GAME_OVER_PANEL.y + 64, LABEL_SIZE, 'right');
  if (state.newHighScore) {
    drawText(ctx, 'NEW BEST!', px + pad, GAME_OVER_PANEL.y + 96, LABEL_SIZE, 'left', PALETTE.highlight);
  }
  drawButton(ctx, cfg, 'RESTART', true);
  drawText(ctx, 'Press SPACE or tap to restart', cx, GAME_OVER_HINT_Y, HINT_SIZE, 'center');
}

// Menu, High_Scores_Panel, HUD icons, Paused and Game_Over overlays. Called last, over the world and ghost.
// opts.muted: current mute state from the audio player (the GameState does not hold it).
function drawUi(ctx, state, assets, opts) { // eslint-disable-line no-unused-vars
  const mode = state.mode;
  if (mode === 'Main_Menu') {
    drawMainMenu(ctx, state);
  } else if (mode === 'Playing') {
    drawScore(ctx, state);
  } else if (mode === 'Paused') {
    drawPaused(ctx, state);
  } else if (mode === 'Game_Over' && !(state.crashMs > 0)) {
    drawGameOver(ctx, state);
  }
  if (menuMod.iconsVisible(mode)) drawIcons(ctx, state, opts);
}

// Draw order: sky, clouds, pipes, ground, ghost, UI (score and, in 17.2, menu/overlays).
function render(ctx, state, assets, opts) {
  ctx.imageSmoothingEnabled = false;
  drawSky(ctx, state.cfg);
  drawClouds(ctx, state);
  drawPipes(ctx, state);
  drawGround(ctx, state);
  drawGhost(ctx, state, assets, opts);
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

export { PALETTE, FONT_FAMILY, font, drawText, drawSky, drawClouds, drawPipes, drawGround, drawGhost, drawScore, ghostHidden, drawButton, drawIcons, drawMainMenu, drawPaused, drawGameOver, drawUi, render, fitCanvas };
