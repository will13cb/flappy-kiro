// Validates: Requirements 2.1, 5.2, 7.4, 7.5, 9.5, 13.1, 14.5, 16.6, 17.1, 17.5, 17.8, 17.10, 17.11, 18.6, 18.7
import { describe, it, expect } from 'vitest';
import { rng, DEFAULT_CONFIG } from '../helpers/arbitraries.js';

import * as renderer from '../../src/renderer.js';
import { createGame } from '../../src/game.js';
import * as menu from '../../src/menu.js';
import * as physics from '../../src/physics.js';

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
    for (const mode of ['Game_Over']) {
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
    expect(t).toEqual(expect.arrayContaining(['HIGH SCORES', 'No scores yet', 'BACK']));
    expect(t).not.toContain('PLAY');
    expect(t).not.toContain('FLAPPY KIRO');
  });
  it('panel lists each rank with its score and the world it reached, instead of BEST', () => {
    const P = cfg.world.POINTS_PER_WORLD;
    const ctx = makeCtx();
    const scores = [3 * P + 1, 2 * P + 3, P + 1, 4, 3];
    const s = state('Main_Menu', { topScores: scores });
    s.menu = { selected: 'PLAY', panelOpen: true };
    renderer.drawUi(ctx, s, {}, {});
    const t = texts(ctx);
    // Each row draws rank, world label, score in that order.
    const first = t.indexOf('HIGH SCORES') + 1;
    const rows = [0, 1, 2, 3, 4].map((i) => t.slice(first + i * 3, first + i * 3 + 3));
    expect(rows.map((r) => r[0])).toEqual(['1', '2', '3', '4', '5']);
    expect(rows.map((r) => r[2])).toEqual(scores.map(String));
    expect(t).toEqual(expect.arrayContaining(['SPACE', 'THE CASTLE', 'THE FOREST', 'THE SKY']));
    expect(t).not.toContain('No scores yet');
    expect(t.some((x) => x.startsWith('BEST:'))).toBe(false);
  });
  it('panel keeps all five slots drawn and everything above the BACK button', () => {
    const ctx = makeCtx();
    const s = state('Main_Menu', { topScores: [9] });
    s.menu = { selected: 'PLAY', panelOpen: true };
    renderer.drawUi(ctx, s, {}, {});
    const back = menu.buttonRect(cfg, 'BACK');
    const slots = calls(ctx, 'fillRect').filter((e) => e.args[2] === cfg.ui.BUTTON_WIDTH + 96 && e.args[3] === 32);
    expect(slots).toHaveLength(5);
    slots.forEach((e) => expect(e.args[1] + e.args[3]).toBeLessThan(back.y));
    const label = calls(ctx, 'fillText').filter((e) => e.args[0] !== 'BACK').map((e) => e.args[2]);
    label.forEach((y) => expect(y).toBeLessThan(back.y));
  });
});
describe('skin and trail rows', () => {
  const rowTexts = (extra) => {
    const ctx = makeCtx();
    renderer.drawUi(ctx, state('Main_Menu', extra), {}, {});
    return texts(ctx);
  };
  it('draws one row for the skin and one for the trail, each naming its current choice', () => {
    expect(rowTexts({ skin: 'pumpkin', trailStyle: 'ember', bestMedal: 'bronze' }))
      .toEqual(expect.arrayContaining(['SKIN', 'TRAIL', 'PUMPKIN', 'EMBER']));
  });
  it('says which medal a locked choice needs, per row', () => {
    const t = rowTexts({ skin: 'gold', trailStyle: 'rainbow', bestMedal: null });
    expect(t).toEqual(expect.arrayContaining(['GOLD - GOLD MEDAL', 'RAINBOW - SILVER MEDAL']));
    const open = rowTexts({ skin: 'gold', trailStyle: 'rainbow', bestMedal: 'gold' });
    expect(open).toEqual(expect.arrayContaining(['GOLD', 'RAINBOW']));
  });
  it('shows the previous and next choice around the current one in both rows', () => {
    const ctx = makeCtx();
    renderer.drawUi(ctx, state('Main_Menu', { skin: 'classic', trailStyle: 'soft' }), {}, {});
    const cx = cfg.world.WIDTH / 2;
    // Each preview draws a 22 px outline square: centred on its slot in the skin row, 14 px right of it in the trail row.
    const slots = calls(ctx, 'fillRect').filter((e) => e.args[2] === 22 && e.args[3] === 22).map((e) => e.args[0] + 11);
    for (const x of [cx - 110, cx, cx + 110]) {
      expect(slots).toContain(x);
      expect(slots).toContain(x + 14);
    }
    // The neighbours are dimmed, the current one is not.
    const dimmed = calls(ctx, 'fillRect').filter((e) => e.args[2] === 22 && e.props.globalAlpha === 0.6);
    expect(dimmed).toHaveLength(4);
  });
  it('points each arrow the way it moves the row', () => {
    const ctx = makeCtx();
    renderer.drawUi(ctx, state('Main_Menu'), {}, {});
    const moves = calls(ctx, 'moveTo').map((e) => e.args);
    const lines = calls(ctx, 'lineTo').map((e) => e.args);
    for (const [name, dir] of [['SKIN_PREV', -1], ['SKIN_NEXT', 1], ['TRAIL_PREV', -1], ['TRAIL_NEXT', 1]]) {
      const r = menu.buttonRect(cfg, name);
      const mx = r.x + r.w / 2;
      const i = moves.findIndex(([x, y]) => x === mx - dir * 5 && y === r.y + r.h * 0.25);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(lines[2 * i][0]).toBe(mx + dir * 5); // tip
    }
  });
  it('draws the real sprite in the previews when it is loaded', () => {
    const ctx = makeCtx();
    renderer.drawUi(ctx, state('Main_Menu'), { sprite }, {});
    expect(calls(ctx, 'drawImage')).toHaveLength(6);
  });
  it('marks the row that Left and Right will change', () => {
    const marked = (editRow) => {
      const ctx = makeCtx();
      renderer.drawUi(ctx, state('Main_Menu', { editRow }), {}, {});
      return calls(ctx, 'strokeRect').filter((e) => e.props.strokeStyle === renderer.PALETTE.highlight).map((e) => e.args[1]);
    };
    expect(marked('SKIN')).toEqual([cfg.ui.SKIN_ROW_Y + 1]);
    expect(marked('TRAIL')).toEqual([cfg.ui.TRAIL_ROW_Y + 1]);
  });
  it('keeps the arrow squares where the hit test expects them', () => {
    const ctx = makeCtx();
    renderer.drawUi(ctx, state('Main_Menu'), {}, {});
    const rects = calls(ctx, 'fillRect').map((e) => e.args);
    for (const name of ['SKIN_PREV', 'SKIN_NEXT', 'TRAIL_PREV', 'TRAIL_NEXT']) {
      const r = menu.buttonRect(cfg, name);
      expect(rects.some(([x, y, w, h]) => x === r.x && y === r.y && w === r.w && h === r.h)).toBe(true);
    }
  });
  it('keeps both rows between the title and Ghosty', () => {
    const rowBottom = cfg.ui.TRAIL_ROW_Y + cfg.ui.ROW_HEIGHT + 4;
    expect(rowBottom).toBeLessThan(cfg.world.MENU_GHOST_Y - 16);
    expect(cfg.ui.SKIN_ROW_Y).toBeGreaterThan(140 + 30);
    expect(cfg.ui.SKIN_ROW_Y + cfg.ui.ROW_HEIGHT + 4).toBeLessThanOrEqual(cfg.ui.TRAIL_ROW_Y);
  });
});
describe('play mode on the menu and game over', () => {
  it('names the mode inside PLAY and draws an arrow each side of the button', () => {
    const ctx = makeCtx();
    renderer.drawUi(ctx, state('Main_Menu', { playMode: 'forest', worldBests: { forest: 4 } }), {}, {});
    expect(texts(ctx)).toEqual(expect.arrayContaining(['PLAY', 'FOREST ONLY', 'FOREST ONLY BEST: 4']));
    const rects = calls(ctx, 'fillRect').map((e) => e.args);
    for (const name of ['MODE_PREV', 'MODE_NEXT']) {
      const r = menu.buttonRect(cfg, name);
      expect(rects.some(([x, y, w, h]) => x === r.x && y === r.y && w === r.w && h === r.h)).toBe(true);
    }
    const play = menu.buttonRect(cfg, 'PLAY');
    expect(menu.buttonRect(cfg, 'MODE_PREV').x + cfg.ui.ICON_SIZE).toBeLessThan(play.x - 18);
    expect(menu.buttonRect(cfg, 'MODE_NEXT').x).toBeGreaterThan(play.x + play.w + 18);
  });
  it('marks a selected PLAY with its border only, so the mode arrows are the only triangles beside it', () => {
    const ctx = makeCtx();
    const play = menu.buttonRect(cfg, 'PLAY');
    renderer.drawUi(ctx, state('Main_Menu'), {}, {});
    const nearPlay = calls(ctx, 'moveTo').map((e) => e.args)
      .filter(([x, y]) => y > play.y - 8 && y < play.y + play.h && (x < play.x || x > play.x + play.w));
    // Only the two mode arrows start a triangle beside PLAY.
    expect(nearPlay).toHaveLength(2);
  });
  it('a single-world game over shows the world bests instead of the journey top 5 and medals', () => {
    const ctx = makeCtx();
    renderer.drawUi(ctx, state('Game_Over', { crashMs: 0, score: 3, playMode: 'castle', worldBests: { castle: 9, sky: 2 } }), {}, {});
    const t = texts(ctx);
    expect(t).toEqual(expect.arrayContaining(['WORLD BESTS', 'CASTLE ONLY', 'SKY', 'FOREST', 'CASTLE', 'SPACE', '9']));
    expect(t).not.toContain('TOP 5');
  });
});
describe('every world draws', () => {
  it('renders a full frame in each world kind and mode without throwing', () => {
    for (let worldIndex = 0; worldIndex < 8; worldIndex++) {
      for (const mode of ['Main_Menu', 'Playing', 'Paused', 'Game_Over']) {
        const ctx = makeCtx();
        const s = state(mode, { worldIndex, crashMs: 0, pipes: [{ x: 200, gapCenter: 300, scored: false }] });
        expect(() => renderer.render(ctx, s, { sprite, sheet: null }, {})).not.toThrow();
        expect(calls(ctx, 'fillRect').length).toBeGreaterThan(10);
      }
    }
  });
  it('keeps backdrop scenery out of the obstacle and ground colours', () => {
    for (let kind = 0; kind < 4; kind++) {
      const ctx = makeCtx();
      renderer.render(ctx, state('Playing', { worldIndex: kind }), { sprite, sheet: null }, {});
      const pal = renderer.PALETTES[kind];
      const firstPipe = ctx.log.findIndex((e) => e.op === 'fillRect' && e.props.fillStyle === pal.pipe);
      const firstGround = ctx.log.findIndex((e) => e.op === 'fillRect' && e.props.fillStyle === pal.ground);
      expect(firstPipe === -1 || firstPipe > 0).toBe(true);
      const scenery = ctx.log.slice(0, firstGround === -1 ? ctx.log.length : firstGround);
      expect(scenery.some((e) => e.op === 'fillRect' && e.props.fillStyle === pal.pipe && e.props.globalAlpha === 1 && e.args[3] > 100)).toBe(false);
    }
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
    expect(t).toEqual(expect.arrayContaining(['GAME OVER', 'SCORE', '5', 'BEST', '9', 'RESTART', 'MENU', 'TOP 5', 'No scores yet']));
    // RESTART is the selected button: white border, MENU is not
    const border = (name) => {
      const r = menu.buttonRect(cfg, name);
      return calls(ctx, 'strokeRect').find((e) => e.args[1] === r.y + 1.5).props.strokeStyle;
    };
    expect(border('RESTART')).toBe(renderer.PALETTE.text);
    expect(border('MENU')).toBe(renderer.PALETTE.pipeOutline);
  });
  it('moves the white border to MENU when MENU is selected', () => {
    const ctx = makeCtx();
    const s = state('Game_Over', { crashMs: 0 });
    s.menu = { selected: 'MENU', panelOpen: false };
    renderer.drawUi(ctx, s, {}, {});
    const colour = (name) => {
      const r = menu.buttonRect(cfg, name);
      return calls(ctx, 'strokeRect').find((e) => e.args[1] === r.y + 1.5).props.strokeStyle;
    };
    expect(colour('MENU')).toBe(renderer.PALETTE.text);
    expect(colour('RESTART')).toBe(renderer.PALETTE.pipeOutline);
  });
  it('lists the top scores and keeps all text clear of the buttons and above the ground', () => {
    const ctx = makeCtx();
    renderer.drawUi(ctx, state('Game_Over', { crashMs: 0, topScores: [9, 7, 3, 2, 1] }), {}, {});
    expect(texts(ctx).filter((x) => /^\d\. /.test(x))).toEqual(['1. 9', '2. 7', '3. 3', '4. 2', '5. 1']);
    const restart = menu.buttonRect(cfg, 'RESTART');
    const menuBtn = menu.buttonRect(cfg, 'MENU');
    expect(menuBtn.y).toBe(restart.y + restart.h + cfg.ui.BUTTON_GAP);
    const labels = ['RESTART', 'MENU'];
    const ys = calls(ctx, 'fillText').filter((e) => !labels.includes(e.args[0])).map((e) => e.args[2]);
    ys.forEach((y) => expect(y).toBeLessThan(cfg.world.GROUND_TOP));
    const panelBottom = Math.max(...ys.filter((y) => y < restart.y));
    expect(panelBottom).toBeLessThan(restart.y);
    const below = ys.filter((y) => y >= restart.y);
    below.forEach((y) => expect(y).toBeGreaterThan(menuBtn.y + menuBtn.h));
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
