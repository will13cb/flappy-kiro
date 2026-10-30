// Ghosty's Journey: a few examples for worlds, twists, medals and skins.
import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, buildConfig, validateConfig } from '../../src/config.js';
import { buildWorldConfigs, configFor, parseStartWorld, titleFor, PLAY_MODES, cyclePlayMode } from '../../src/worlds.js';
import { initPair, slideGaps } from '../../src/twists.js';
import { medalFor } from '../../src/medals.js';
import { createGame, handleInput, update } from '../../src/game.js';
import { loadWorldBests, recordWorldBest } from '../../src/scoreStore.js';
import { buttonRect } from '../../src/menu.js';
import { mapKey } from '../../src/input.js';
import { isUnlocked, cycleSkin, isTrailUnlocked, cycleTrail, neighbour, TRAILS, SKINS } from '../../src/skins.js';

describe('worlds', () => {
  it('every world config validates and each world starts faster than the last', () => {
    const built = buildWorldConfigs(DEFAULT_CONFIG);
    expect(built.errors).toEqual([]);
    expect(built.maxLoop).toBeGreaterThanOrEqual(1);
    const speeds = [0, 1, 2, 3].map((i) => configFor(built, i).speed.INITIAL_SPEED);
    expect([...speeds].sort((a, b) => a - b)).toEqual(speeds);
    expect(configFor(built, 3).ghost.GRAVITY).toBeLessThan(DEFAULT_CONFIG.ghost.GRAVITY);
  });

  it('parses ?world= and titles loops', () => {
    expect(parseStartWorld('?world=castle')).toEqual({ index: 2, warning: null });
    expect(parseStartWorld('?world=moon').index).toBe(0);
    expect(titleFor(1).line1).toBe('WORLD 2 - THE FOREST');
    expect(titleFor(4).line2).toBe('LOOP 2');
  });

  it('rejects a non-integer pointsPerWorld', () => {
    const errors = validateConfig(buildConfig({ world: { POINTS_PER_WORLD: 2.5 } })).errors;
    expect(errors.some((e) => e.startsWith('world.pointsPerWorld'))).toBe(true);
  });
});

describe('moving gaps', () => {
  it('stay inside the legal gap range', () => {
    const castle = configFor(buildWorldConfigs(DEFAULT_CONFIG), 2);
    const p = castle.pipes;
    let pairs = [initPair(castle, { x: 0, gapCenter: p.GAP_CENTER_MIN, scored: false })];
    for (let i = 0; i < 400; i++) {
      pairs = slideGaps(castle, pairs, 16);
      expect(pairs[0].gapCenter).toBeGreaterThanOrEqual(p.GAP_CENTER_MIN);
      expect(pairs[0].gapCenter).toBeLessThanOrEqual(p.GAP_CENTER_MAX);
    }
  });
});

describe('medals and skins', () => {
  it('derive medals from pointsPerWorld and unlock skins by medal', () => {
    expect([0, 4, 5, 10, 15, 20, 99].map((s) => medalFor(s, 5))).toEqual(
      [null, null, 'bronze', 'silver', 'gold', 'platinum', 'platinum']);
    expect(isUnlocked('gold', 'silver')).toBe(false);
    expect(isUnlocked('gold', 'gold')).toBe(true);
    expect(cycleSkin('classic', -1)).toBe('starfield');
  });
});
describe('skins and trails are separate', () => {
  it('unlock trails by medal and cycle them on their own', () => {
    expect(isTrailUnlocked('soft', null)).toBe(true);
    expect(isTrailUnlocked('rainbow', 'bronze')).toBe(false);
    expect(isTrailUnlocked('rainbow', 'silver')).toBe(true);
    expect(cycleTrail('soft', -1)).toBe('stardust');
    expect(cycleTrail('stardust', 1)).toBe('soft');
  });
  it('finds the previous and next choice with wrap-around', () => {
    expect(neighbour(SKINS, 'classic', -1).id).toBe('starfield');
    expect(neighbour(SKINS, 'classic', 1).id).toBe('pumpkin');
    expect(neighbour(TRAILS, 'stardust', 1).id).toBe('soft');
  });
});
describe('menu rows', () => {
  const make = () => createGame(DEFAULT_CONFIG, 0, () => 0.5, [], {});
  const send = (state, input) => handleInput(state, input, { rng: () => 0.5 });
  it('Left and Right change the skin until Tab switches to the trail row', () => {
    const s = make();
    expect(send(s, { kind: 'right' })).toEqual([{ type: 'skinChanged', skin: 'pumpkin' }]);
    expect(s.trailStyle).toBe('soft');
    expect(send(s, { kind: 'tab' })).toEqual([]);
    expect(s.editRow).toBe('TRAIL');
    expect(send(s, { kind: 'right' })).toEqual([{ type: 'trailChanged', trail: 'ember' }]);
    expect(s.skin).toBe('pumpkin');
    send(s, { kind: 'tab' });
    expect(s.editRow).toBe('MODE');
    send(s, { kind: 'tab' });
    expect(s.editRow).toBe('SKIN');
  });
  it('clicking a row arrow changes that row and focuses it', () => {
    const s = make();
    const next = buttonRect(s.cfg, 'TRAIL_NEXT');
    const prev = buttonRect(s.cfg, 'SKIN_PREV');
    expect(send(s, { kind: 'pointer', x: next.x + 1, y: next.y + 1 })).toEqual([{ type: 'trailChanged', trail: 'ember' }]);
    expect(s.editRow).toBe('TRAIL');
    expect(send(s, { kind: 'pointer', x: prev.x + 1, y: prev.y + 1 })).toEqual([{ type: 'skinChanged', skin: 'starfield' }]);
    expect(s.editRow).toBe('SKIN');
    expect(s.mode).toBe('Main_Menu');
  });
  it('maps Tab and keeps the browser from moving focus', () => {
    expect(mapKey({ key: 'Tab' })).toEqual({ input: 'tab', preventDefault: true });
  });
});
describe('play modes', () => {
  const P = DEFAULT_CONFIG.world.POINTS_PER_WORLD;
  const send = (state, input) => handleInput(state, input, { rng: () => 0.5 });
  // Scores one point per call by putting a passed pair behind the ghost.
  const scorePoint = (s) => {
    s.invincibleMs = 1e9;
    s.ghost = { y: 300, vy: 0 };
    s.pipes = [{ x: DEFAULT_CONFIG.ghost.X - DEFAULT_CONFIG.pipes.CAP_WIDTH - 1, gapCenter: 300, scored: false }];
    update(s, 0.001, { rng: () => 0.5 });
  };
  it('offers the journey and each world alone, cycling with wrap-around', () => {
    expect(PLAY_MODES.map((m) => m.id)).toEqual(['journey', 'sky', 'forest', 'castle', 'space']);
    expect(cyclePlayMode('journey', -1)).toBe('space');
    expect(cyclePlayMode('space', 1)).toBe('journey');
  });
  it('the mode arrows beside PLAY change the mode without starting a round', () => {
    const s = createGame(DEFAULT_CONFIG, 0, () => 0.5, [], {});
    const next = buttonRect(s.cfg, 'MODE_NEXT');
    expect(send(s, { kind: 'pointer', x: next.x + 1, y: next.y + 1 })).toEqual([{ type: 'playModeChanged', playMode: 'sky' }]);
    expect(s.mode).toBe('Main_Menu');
    expect(s.editRow).toBe('MODE');
    expect(send(s, { kind: 'left' })).toEqual([{ type: 'playModeChanged', playMode: 'journey' }]);
  });
  it('a single-world run starts at 0 in its world and never moves on', () => {
    const s = createGame(DEFAULT_CONFIG, 0, () => 0.5, [], { playMode: 'castle' });
    send(s, { kind: 'space' });
    expect(s.score).toBe(0);
    expect(s.worldIndex).toBe(2);
    for (let i = 0; i < 3 * P; i++) scorePoint(s);
    for (let i = 0; i < 200; i++) update(s, 0.016, { rng: () => 0.5 });
    expect(s.score).toBe(3 * P);
    expect(s.worldIndex).toBe(2);
    expect(s.transition).toBeNull();
  });
  it('the journey still moves to the next world', () => {
    const s = createGame(DEFAULT_CONFIG, 0, () => 0.5, [], { playMode: 'journey' });
    send(s, { kind: 'space' });
    for (let i = 0; i < P; i++) scorePoint(s);
    expect(s.transition).not.toBeNull();
  });
  it('a single-world game over reports the world and its own best', () => {
    const s = createGame(DEFAULT_CONFIG, 50, () => 0.5, [], { playMode: 'forest', worldBests: { forest: 2 } });
    send(s, { kind: 'space' });
    for (let i = 0; i < 3; i++) scorePoint(s);
    s.invincibleMs = 0;
    s.pipes = [];
    s.ghost = { y: DEFAULT_CONFIG.world.GROUND_TOP, vy: 0 };
    const over = update(s, 0.016, { rng: () => 0.5 }).find((e) => e.type === 'gameOver');
    expect(over).toEqual({ type: 'gameOver', score: 3, previousHighScore: 2, world: 'forest' });
    expect(s.newHighScore).toBe(true);
  });
  it('stores world bests per world and ignores corrupt data', () => {
    const data = {};
    const storage = { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; } };
    const ids = ['sky', 'forest'];
    expect(loadWorldBests(storage, ids)).toEqual({ sky: 0, forest: 0 });
    let bests = recordWorldBest(storage, 'forest', 7, loadWorldBests(storage, ids));
    expect(loadWorldBests(storage, ids)).toEqual({ sky: 0, forest: 7 });
    expect(recordWorldBest(storage, 'forest', 5, bests)).toBe(bests);
    data['flappyKiro.worldBests'] = '{"sky":-3,"forest":"x"';
    expect(loadWorldBests(storage, ids)).toEqual({ sky: 0, forest: 0 });
  });
});
