import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG as cfg, rng } from '../helpers/arbitraries.js';
import { buildState } from '../helpers/game-arbs.js';
import { createGame, handleInput, update } from '../../src/game.js';
import * as menu from '../../src/menu.js';
const send = (state, input) => handleInput(state, input, { rng: rng(1) });
const click = (name) => {
  const r = menu.buttonRect(cfg, name);
  return { kind: 'pointer', x: r.x + r.w / 2, y: r.y + r.h / 2 };
};
const gameOver = (extra) => buildState(cfg, 'Game_Over', { lockoutMs: 0, ...extra });
describe('Game_Over buttons', () => {
  it('lists RESTART then MENU, MENU one gap below RESTART', () => {
    expect(menu.buttonsFor('Game_Over')).toEqual(['RESTART', 'MENU']);
    const a = menu.buttonRect(cfg, 'RESTART');
    const b = menu.buttonRect(cfg, 'MENU');
    expect(b.y).toBe(a.y + cfg.ui.BUTTON_HEIGHT + cfg.ui.BUTTON_GAP);
    expect(b.y + b.h).toBeLessThan(cfg.world.GROUND_TOP);
  });
  it('selects RESTART when the game ends', () => {
    const g = createGame(cfg, 0, rng(1));
    g.mode = 'Playing';
    g.ghost = { y: cfg.world.GROUND_TOP, vy: 0 };
    g.menu = { selected: 'HIGH_SCORES', panelOpen: false };
    update(g, 0.016, { rng: rng(1) });
    expect(g.mode).toBe('Game_Over');
    expect(g.menu.selected).toBe('RESTART');
  });
  it('Up and Down switch between RESTART and MENU', () => {
    const s = gameOver({});
    send(s, { kind: 'down' });
    expect(s.menu.selected).toBe('MENU');
    send(s, { kind: 'down' });
    expect(s.menu.selected).toBe('RESTART');
    send(s, { kind: 'up' });
    expect(s.menu.selected).toBe('MENU');
    expect(s.mode).toBe('Game_Over');
  });
  it('Space and Enter activate the selected button', () => {
    for (const kind of ['space', 'enter']) {
      const restart = gameOver({});
      send(restart, { kind });
      expect(restart.mode).toBe('Playing');
      const toMenu = gameOver({});
      send(toMenu, { kind: 'down' });
      send(toMenu, { kind });
      expect(toMenu.mode).toBe('Main_Menu');
    }
  });
  it('MENU resets the ghost, pipes and panel and selects PLAY', () => {
    const s = gameOver({ ghost: { y: 500, vy: 120 }, pipes: [{ x: 10, gapCenter: 200, scored: false }], score: 3 });
    s.menu = { selected: 'MENU', panelOpen: true };
    const events = send(s, click('MENU'));
    expect(events).toEqual([]);
    expect(s.mode).toBe('Main_Menu');
    expect(s.ghost).toEqual({ y: cfg.world.MENU_GHOST_Y, vy: 0 });
    expect(s.pipes).toEqual([]);
    expect(s.menu).toEqual({ selected: 'PLAY', panelOpen: false });
  });
  it('a pointer on RESTART or elsewhere restarts', () => {
    for (const p of [click('RESTART'), { kind: 'pointer', x: 5, y: 5 }]) {
      const s = gameOver({});
      send(s, { kind: 'down' });
      send(s, p);
      expect(s.mode).toBe('Playing');
    }
  });
  it('ignores input during the lockout', () => {
    const s = gameOver({ lockoutMs: 10 });
    send(s, { kind: 'down' });
    send(s, click('MENU'));
    expect(s.mode).toBe('Game_Over');
    expect(s.menu.selected).toBe('RESTART');
  });
  it('keeps the top scores given to createGame', () => {
    const top = [5, 3];
    const s = createGame(cfg, 5, rng(1), top);
    expect(s.topScores).toEqual(top);
    expect(s.topScores).not.toBe(top);
    expect(createGame(cfg, 0, rng(1)).topScores).toEqual([]);
  });
});
