// Validates: Requirements 4.4, 4.7, 1.6
import { describe, it, expect } from 'vitest';

import * as cfgMod from '../../src/config.js';
const { DEFAULT_CONFIG, validateConfig, assertValidConfig, buildConfig, loadConfig, parseOverrides, TUNABLE } = cfgMod;

function isDeepFrozen(o) {
  if (o === null || typeof o !== 'object') return true;
  return Object.isFrozen(o) && Object.keys(o).every((k) => isDeepFrozen(o[k]));
}

function collector() {
  const warnings = [];
  return { warnings, log: { warn: (m) => warnings.push(m) } };
}

describe('default config', () => {
  it('is valid and deeply frozen', () => {
    expect(validateConfig(DEFAULT_CONFIG)).toEqual({ valid: true, errors: [] });
    expect(isDeepFrozen(DEFAULT_CONFIG)).toBe(true);
  });

  it('matches the required values', () => {
    expect(DEFAULT_CONFIG.ghost.GRAVITY).toBe(800);
    expect(DEFAULT_CONFIG.ghost.JUMP_VELOCITY).toBe(-300);
    expect(DEFAULT_CONFIG.speed.INITIAL_SPEED).toBe(120);
    expect(DEFAULT_CONFIG.pipes.GAP_HEIGHT).toBe(140);
    expect(DEFAULT_CONFIG.pipes.PIPE_SPACING).toBe(350);
    expect(DEFAULT_CONFIG.pipes.MAX_GAP_SHIFT).toBe(160);
    expect(DEFAULT_CONFIG.speed.MAX_SPEED).toBe(240);
    expect(DEFAULT_CONFIG.ghost.SPRITE_SIZE).toBe(32);
    expect(DEFAULT_CONFIG.ghost.HITBOX_RADIUS).toBe(12);
  });

  it('reachability: 3 jumps, 1.125 s climb, about 0.632 s fall, both below 350 / 240', () => {
    const { ghost, pipes, speed } = DEFAULT_CONFIG;
    const jumpSpeed = -ghost.JUMP_VELOCITY;
    const rise = (jumpSpeed * jumpSpeed) / (2 * ghost.GRAVITY);
    const jumps = Math.ceil(pipes.MAX_GAP_SHIFT / rise);
    const climb = jumps * (jumpSpeed / ghost.GRAVITY);
    const fall = Math.sqrt((2 * pipes.MAX_GAP_SHIFT) / ghost.GRAVITY);
    const limit = pipes.PIPE_SPACING / speed.MAX_SPEED;
    expect(jumps).toBe(3);
    expect(climb).toBeCloseTo(1.125, 10);
    expect(fall).toBeCloseTo(0.632, 3);
    expect(climb).toBeLessThan(limit);
    expect(fall).toBeLessThan(limit);
  });
});

describe('startup validity', () => {
  it('DEFAULT_CONFIG is valid', () => {
    expect(validateConfig(DEFAULT_CONFIG)).toEqual({ valid: true, errors: [] });
    expect(() => assertValidConfig(DEFAULT_CONFIG)).not.toThrow();
  });
  it('assertValidConfig throws naming gap.heightVsHitbox for GAP_HEIGHT 20', () => {
    const bad = buildConfig({ pipes: { GAP_HEIGHT: 20 } });
    expect(() => assertValidConfig(bad)).toThrow(/Invalid Flappy Kiro config[\s\S]*gap\.heightVsHitbox/);
  });
});
describe('URL overrides', () => {
  it('applies ?gravity=1500&gapHeight=180', () => {
    const { warnings, log } = collector();
    const cfg = loadConfig('?gravity=1500&gapHeight=180', log);
    expect(cfg.ghost.GRAVITY).toBe(1500);
    expect(cfg.pipes.GAP_HEIGHT).toBe(180);
    expect(warnings).toEqual([]);
  });

  it.each(['?gravity=abc', '?gravity=', '?foo=1'])('ignores %s with a warning', (search) => {
    const { warnings, log } = collector();
    const cfg = loadConfig(search, log);
    expect(cfg.ghost.GRAVITY).toBe(800);
    expect(warnings.length).toBeGreaterThan(0);
    expect(parseOverrides(search).overrides).toEqual({});
  });

  it('applies ?pointsPerWorld=1 and defaults POINTS_PER_WORLD to 5', () => {
    const { warnings, log } = collector();
    expect(DEFAULT_CONFIG.world.POINTS_PER_WORLD).toBe(5);
    expect(loadConfig('?pointsPerWorld=1', log).world.POINTS_PER_WORLD).toBe(1);
    expect(warnings).toEqual([]);
  });

  it.each(['?pointsPerWorld=0', '?pointsPerWorld=2.5'])('rejects %s and names world.pointsPerWorld', (search) => {
    const { warnings, log } = collector();
    expect(loadConfig(search, log)).toBe(DEFAULT_CONFIG);
    expect(warnings.some((w) => w.includes('world.pointsPerWorld'))).toBe(true);
  });

  it('ignores ?world=2 without a warning or an override', () => {
    expect(parseOverrides('?world=2')).toEqual({ overrides: {}, warnings: [] });
  });

  it('falls back to defaults for ?gapHeight=20 and names gap.heightVsHitbox', () => {
    const { warnings, log } = collector();
    const cfg = loadConfig('?gapHeight=20', log);
    expect(cfg).toBe(DEFAULT_CONFIG);
    expect(warnings.some((w) => w.includes('gap.heightVsHitbox'))).toBe(true);
  });
});
