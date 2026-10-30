// Ghosty's Journey: a few examples for worlds, twists, medals and skins.
import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, buildConfig, validateConfig } from '../../src/config.js';
import { buildWorldConfigs, configFor, parseStartWorld, titleFor } from '../../src/worlds.js';
import { initPair, slideGaps } from '../../src/twists.js';
import { medalFor } from '../../src/medals.js';
import { isUnlocked, cycleSkin } from '../../src/skins.js';

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
