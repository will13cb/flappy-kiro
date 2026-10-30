// Validates: Requirements 2.1, 5.2, 7.4, 7.5, 9.5, 13.1, 14.5, 16.6, 17.1, 17.5, 17.8, 17.10, 17.11, 18.6, 18.7
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { rng, DEFAULT_CONFIG } from '../helpers/arbitraries.js';

const require = createRequire(import.meta.url);
const renderer = require('../../src/renderer.js');
const { createGame } = require('../../src/game.js');
const menu = require('../../src/menu.js');
const physics = require('../../src/physics.js');

const cfg = DEFAULT_CONFIG;
const DEG = Math.PI / 180;

// Recording fake 2D context: logs method calls and property sets, snapshotting
// the style properties in force at each call.
function makeCtx() {
  const log = [];
  const props = {};
  const target = {};
  const ctx = new Proxy(target, {
    get(_t, name) {
      if (name === 'log') return log;
      if (name === 'measureText') return (s) => ({ width: String(s).length * 8 });
      if (name in props) return props[name];
      return (...args) => {
        log.push({ op: name, args, props: { ...props } });
      };
    },
    set(_t, name, value) {
      props[name] = value;
      log.push({ set: name, value });
      return true;
    },
  });
  return ctx;
}

const calls = (ctx, op) => ctx.log.filter((e) => e.op === op);
const texts = (ctx) => calls(ctx, 'fillText').map((e) => e.args[0]);

function state(mode, extra) {
  const s = createGame(cfg, 7, rng(3));
  s.mode = mode;
  return Object.assign(s, extra || {});
}

const sheet = { width: 320, height: 32 };
const sprite = { width: 32, height: 32 };

describe('render', () => {
  it('disables smoothing first and draws clouds before pipes, ground and ghost', () => {
    const ctx = makeCtx();
    const s = state('Playing', { pipes: [{ x: 200, gapCenter: 300, scored: false }], flapMs: null });
    renderer.render(ctx, s, { sprite, sheet: null }, {});
    expect(ctx.log[0]).toEqual({ set: 'imageSmoothingEnabled', value: false });
    const idx = (pred) => ctx.log.findIndex(pred);
    const skyI = idx((e) => e.op === 'fillRect' && e.props.fillStyle === renderer.PALETTE.sky);
    const cloudI = idx((e) => e.op === 'fillRect' && e.props.fillStyle === renderer.PALETTE.cloud);
    const pipeI = idx((e) => e.op === 'fillRect' && e.props.fillStyle === renderer.PALETTE.pipe);
    const groundI = idx((e) => e.op === 'fillRect' && e.props.fillStyle === renderer.PALETTE.ground);
    const ghostI = idx((e) => e.op === 'drawImage');
    expect(skyI).toBeGreaterThanOrEqual(0);
    expect(s.clouds.length).toBeGreaterThan(0);
    expect(skyI).toBeLessThan(cloudI);
    expect(cloudI).toBeLessThan(pipeI);
    expect(pipeI).toBeLessThan(groundI);
    expect(groundI).toBeLessThan(ghostI);
    // score text (UI) is drawn after the ghost
    expect(idx((e) => e.op === 'fillText')).toBeGreaterThan(ghostI);
  });
});

describe('ghost transforms', () => {
  function ghostCalls(s, assets, opts) {
    const ctx = makeCtx();
    renderer.drawGhost(ctx, s, assets, opts);
    return ctx;
  }

  it('idle frame (no sheet) translates with the bob offset, tilts and uses scale 1', () => {
    const s = state('Main_Menu', { animClockMs: 300 });
    const ctx = ghostCalls(s, { sprite, sheet: null });
    expect(calls(ctx, 'translate')[0].args).toEqual([cfg.ghost.X, s.ghost.y - 1]);
    expect(calls(ctx, 'rotate')[0].args[0]).toBeCloseTo(physics.tiltFor(0));
    expect(calls(ctx, 'scale')[0].args).toEqual([1, 1]);
    const d = calls(ctx, 'drawImage')[0].args;
    expect(d).toEqual([sprite, -16, -16, 32, 32]);
  });

  it('flap frame applies the squash/stretch scale', () => {
    const s = state('Playing', { flapMs: 0 });
    const ctx = ghostCalls(s, { sprite, sheet: null });
    expect(calls(ctx, 'translate')[0].args).toEqual([cfg.ghost.X, s.ghost.y]);
    expect(calls(ctx, 'scale')[0].args).toEqual([1, 1.15]);
    const s2 = state('Playing', { flapMs: 130 });
    expect(calls(ghostCalls(s2, { sprite, sheet: null }), 'scale')[0].args).toEqual([1.1, 0.9]);
  });

  it('death frames rotate 0, 45 and 90 degrees', () => {
    const rot = (ms) => calls(ghostCalls(state('Game_Over', { deathMs: ms }), { sprite, sheet: null }), 'rotate')[0].args[0];
    expect(rot(0)).toBeCloseTo(0);
    expect(rot(150)).toBeCloseTo(45 * DEG);
    expect(rot(250)).toBeCloseTo(90 * DEG);
    expect(rot(5000)).toBeCloseTo(90 * DEG);
  });

  it('with a sheet, draws the source rectangle for the frame and uses identity scale', () => {
    const flap = ghostCalls(state('Playing', { flapMs: 70 }), { sprite, sheet });
    expect(calls(flap, 'scale')[0].args).toEqual([1, 1]);
    expect(calls(flap, 'drawImage')[0].args).toEqual([sheet, 3 * 32, 0, 32, 32, -16, -16, 32, 32]);
    const idle = ghostCalls(state('Main_Menu', { animClockMs: 0 }), { sprite, sheet });
    expect(calls(idle, 'drawImage')[0].args.slice(0, 5)).toEqual([sheet, 0, 0, 32, 32]);
    const death = ghostCalls(state('Game_Over', { deathMs: 250 }), { sprite, sheet });
    expect(calls(death, 'drawImage')[0].args.slice(0, 5)).toEqual([sheet, 7 * 32, 0, 32, 32]);
  });

  it('falls back to the white square when no sprite or sheet is present', () => {
    const ctx = ghostCalls(state('Playing', { flapMs: null }), { sprite: null, sheet: null });
    expect(calls(ctx, 'drawImage')).toHaveLength(0);
    expect(calls(ctx, 'fillRect')[0].args).toEqual([-12, -12, 24, 24]);
  });

  it('draws a tinted copy on tinted death frames when createCanvas is given', () => {
    const tintCanvas = makeCtx();
    const made = { width: 32, height: 32, getContext: () => tintCanvas };
    const ctx = ghostCalls(state('Game_Over', { deathMs: 0 }), { sprite: { width: 32, height: 32 }, sheet: null }, {
      createCanvas: () => made,
    });
    expect(calls(ctx, 'drawImage')[0].args[0]).toBe(made);
    expect(calls(tintCanvas, 'fillRect')).toHaveLength(1);
  });

  it('blink hides the ghost on odd intervals only while invincible', () => {
    const inv = cfg.timing.INVINCIBILITY_MS;
    const blink = cfg.timing.BLINK_MS;
    const hidden = (ms) => renderer.ghostHidden(state('Playing', { invincibleMs: ms }));
    expect(hidden(inv)).toBe(false); // interval 0
    expect(hidden(inv - blink)).toBe(true); // interval 1
    expect(hidden(inv - 2 * blink)).toBe(false); // interval 2
    expect(hidden(0)).toBe(false);
    const ctx = makeCtx();
    renderer.drawGhost(ctx, state('Playing', { invincibleMs: inv - blink }), { sprite });
    expect(ctx.log).toHaveLength(0);
  });
});

describe('score and icons', () => {
  it('shows the score at the top center while Playing', () => {
    const ctx = makeCtx();
    renderer.drawUi(ctx, state('Playing', { score: 12 }), {}, {});
    const t = calls(ctx, 'fillText').find((e) => e.args[0] === '12');
    expect(t.args[1]).toBe(cfg.world.WIDTH / 2);
    expect(t.props.textAlign).toBe('center');
  });

  it('draws icons in Playing and Paused at the configured positions, not elsewhere', () => {
    const mute = menu.iconRect(cfg, 'MUTE');
    const pause = menu.iconRect(cfg, 'PAUSE');
    for (const mode of ['Playing', 'Paused']) {
      const ctx = makeCtx();
      renderer.drawUi(ctx, state(mode), {}, {});
      const rects = calls(ctx, 'fillRect').map((e) => e.args);
      expect(rects.some(([x, y]) => x > mute.x && x < mute.x + mute.w && y >= mute.y && y < mute.y + mute.h)).toBe(true);
      expect(rects.some(([x, y]) => x > pause.x && x < pause.x + pause.w && y >= pause.y && y < pause.y + pause.h)).toBe(true);
    }
    for (const mode of ['Main_Menu', 'Game_Over']) {
      const ctx = makeCtx();
      renderer.drawUi(ctx, state(mode, { crashMs: 0 }), {}, {});
      const m = calls(ctx, 'fillRect').filter((e) => e.props.globalAlpha === 0.6);
      expect(m).toHaveLength(0);
    }
  });

  it('draws a cross on the speaker only when muted', () => {
    const moveCount = (muted) => {
      const ctx = makeCtx();
      renderer.drawIcons(ctx, state('Playing'), { muted });
      const stroke = calls(ctx, 'stroke')[0];
      return { stroke, moves: calls(ctx, 'moveTo').length };
    };
    const on = moveCount(false);
    const off = moveCount(true);
    expect(on.stroke.props.strokeStyle).not.toBe(renderer.PALETTE.highlight);
    expect(off.stroke.props.strokeStyle).toBe(renderer.PALETTE.highlight);
    // muted: two crossing diagonals (x grows while y changes)
    const ctx = makeCtx();
    renderer.drawIcons(ctx, state('Playing'), { muted: true });
    const mv = calls(ctx, 'moveTo').map((e) => e.args);
    const ln = calls(ctx, 'lineTo').map((e) => e.args);
    const mute = menu.iconRect(cfg, 'MUTE');
    const lastMove = mv[mv.length - 1];
    const lastLine = ln[ln.length - 1];
    expect(lastMove[0]).not.toBe(lastLine[0]);
    expect(lastMove[1]).toBeGreaterThanOrEqual(mute.y);
  });
});

describe('Main_Menu and High_Scores panel', () => {
  it('shows title, best score, both buttons and the hint', () => {
    const ctx = makeCtx();
    renderer.drawUi(ctx, state('Main_Menu'), {}, {});
    const t = texts(ctx);
    expect(t).toEqual(expect.arrayContaining(['FLAPPY KIRO', 'BEST: 7', 'PLAY', 'HIGH SCORES', 'Press SPACE or tap to play']));
    expect(t).not.toContain('BACK');
  });

  it('puts the white border on the selected button only', () => {
    const border = (selected) => {
      const ctx = makeCtx();
      const s = state('Main_Menu');
      s.menu = { selected, panelOpen: false };
      renderer.drawUi(ctx, s, {}, {});
      const play = menu.buttonRect(cfg, 'PLAY');
      const hs = menu.buttonRect(cfg, 'HIGH_SCORES');
      const col = (r) => calls(ctx, 'strokeRect').find((e) => e.args[1] === r.y + 1.5).props.strokeStyle;
      return { play: col(play), hs: col(hs) };
    };
    expect(border('PLAY')).toEqual({ play: renderer.PALETTE.text, hs: renderer.PALETTE.pipeOutline });
    expect(border('HIGH_SCORES')).toEqual({ play: renderer.PALETTE.pipeOutline, hs: renderer.PALETTE.text });
  });

  it('panel shows the best score and BACK, without the menu buttons', () => {
    const ctx = makeCtx();
    const s = state('Main_Menu');
    s.menu = { selected: 'PLAY', panelOpen: true };
    renderer.drawUi(ctx, s, {}, {});
    const t = texts(ctx);
    expect(t).toEqual(expect.arrayContaining(['HIGH SCORES', 'BEST: 7', 'BACK']));
    expect(t).not.toContain('PLAY');
    expect(t).not.toContain('FLAPPY KIRO');
  });
});

describe('Paused and Game_Over', () => {
  it('paused dims the screen and shows PAUSED, the score and the resume hint', () => {
    const ctx = makeCtx();
    renderer.drawUi(ctx, state('Paused', { score: 4 }), {}, {});
    expect(texts(ctx)).toEqual(expect.arrayContaining(['PAUSED', '4', 'Press P to resume']));
    const dim = calls(ctx, 'fillRect').find((e) => e.props.fillStyle === renderer.PALETTE.dim);
    expect(dim.args).toEqual([0, 0, cfg.world.WIDTH, cfg.world.HEIGHT]);
    expect(dim.props.globalAlpha).toBe(0.5);
  });

  it('game over panel is hidden while the crash animation runs', () => {
    const ctx = makeCtx();
    renderer.drawUi(ctx, state('Game_Over', { crashMs: 100 }), {}, {});
    expect(texts(ctx)).not.toContain('GAME OVER');
  });

  it('game over panel shows score, best and RESTART once crashMs <= 0', () => {
    const ctx = makeCtx();
    renderer.drawUi(ctx, state('Game_Over', { crashMs: 0, score: 5, highScore: 9 }), {}, {});
    const t = texts(ctx);
    expect(t).toEqual(expect.arrayContaining(['GAME OVER', 'SCORE', '5', 'BEST', '9', 'RESTART', 'Press SPACE or tap to restart']));
    // RESTART is the selected button: white border
    const r = menu.buttonRect(cfg, 'RESTART');
    const border = calls(ctx, 'strokeRect').find((e) => e.args[1] === r.y + 1.5);
    expect(border.props.strokeStyle).toBe(renderer.PALETTE.text);
  });

  it('shows NEW BEST! only when newHighScore is true', () => {
    const show = (flag) => {
      const ctx = makeCtx();
      renderer.drawUi(ctx, state('Game_Over', { crashMs: 0, newHighScore: flag }), {}, {});
      return texts(ctx).includes('NEW BEST!');
    };
    expect(show(true)).toBe(true);
    expect(show(false)).toBe(false);
  });
});

describe('helpers', () => {
  it('drawText outlines then fills with the given style', () => {
    const ctx = makeCtx();
    renderer.drawText(ctx, 'Hi', 10, 20, 16, 'left', '#123456');
    const ops = ctx.log.filter((e) => e.op).map((e) => e.op);
    expect(ops).toEqual(['strokeText', 'fillText']);
    const fill = calls(ctx, 'fillText')[0];
    expect(fill.props.font).toBe(renderer.font(16));
    expect(fill.props.textAlign).toBe('left');
    expect(fill.props.fillStyle).toBe('#123456');
  });

  it('fitCanvas scales to the window preserving aspect ratio', () => {
    const canvas = { style: {} };
    const scale = renderer.fitCanvas(canvas, cfg, 960, 640);
    expect(scale).toBe(1);
    expect(canvas.style.width).toBe(cfg.world.WIDTH + 'px');
    expect(canvas.style.imageRendering).toBe('pixelated');
    renderer.fitCanvas(canvas, cfg, 240, 1000);
    expect(canvas.style.width).toBe('240px');
    expect(canvas.style.height).toBe(Math.floor(cfg.world.HEIGHT * 0.5) + 'px');
  });
});
