// Validates: Requirements 4.4, 4.7, 1.6
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import fc from 'fast-check';
import { arbConfig } from '../helpers/arbitraries.js';

const require = createRequire(import.meta.url);
const cfgMod = require('../../src/config.js');
const { DEFAULT_CONFIG, validateConfig, loadConfig, parseOverrides, TUNABLE } = cfgMod;

const SRC = fs.readFileSync(path.resolve(__dirname, '../../src/config.js'), 'utf8');
const GAME_CONFIG = require('../../src/game-config.js').GAME_CONFIG;

// Evaluates src/config.js in a fresh context with a stubbed require.
function loadFresh(gameConfig) {
  const module = { exports: {} };
  const stubRequire = (id) => {
    if (id === './game-config' && gameConfig !== undefined) return { GAME_CONFIG: gameConfig };
    throw new Error('Cannot find module ' + id);
  };
  const ctx = vm.createContext({ module, require: stubRequire, URLSearchParams });
  vm.runInContext(SRC, ctx);
  return module.exports;
}

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

describe('startup failures', () => {
  it('loads cleanly with the real GAME_CONFIG', () => {
    expect(loadFresh(GAME_CONFIG).DEFAULT_CONFIG).toEqual(DEFAULT_CONFIG);
  });

  it('throws a clear message when GAME_CONFIG is missing', () => {
    expect(() => loadFresh(undefined)).toThrow('game-config.js not loaded: run npm run sync-config');
  });

  it('throws naming the rule when the default config is invalid', () => {
    const bad = JSON.parse(JSON.stringify(GAME_CONFIG));
    bad.pipes.gapHeight = 20;
    expect(() => loadFresh(bad)).toThrow(/Invalid Flappy Kiro config[\s\S]*gap\.heightVsHitbox/);
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

  it('falls back to defaults for ?gapHeight=20 and names gap.heightVsHitbox', () => {
    const { warnings, log } = collector();
    const cfg = loadConfig('?gapHeight=20', log);
    expect(cfg).toBe(DEFAULT_CONFIG);
    expect(warnings.some((w) => w.includes('gap.heightVsHitbox'))).toBe(true);
  });
});

describe('arbConfig', () => {
  it('rejects few candidates', () => {
    const samples = fc.sample(arbConfig, 100);
    expect(samples).toHaveLength(100);
    samples.forEach((c) => expect(validateConfig(c).valid).toBe(true));

    // Acceptance rate of the underlying (unfiltered) candidates.
    let valid = 0;
    const total = 300;
    fc.sample(
      fc.record(
        Object.fromEntries(Object.keys(TUNABLE).map((n) => [n, fc.double({ min: 0.5, max: 1.5, noNaN: true })]))
      ),
      total
    ).forEach((f) => {
      const overrides = {};
      Object.keys(TUNABLE).forEach((n) => {
        const [g, k] = TUNABLE[n];
        const v = DEFAULT_CONFIG[g][k] * f[n];
        (overrides[g] = overrides[g] || {})[k] = k === 'SPEED_STEP_INTERVAL' ? Math.max(1, Math.round(v)) : v;
      });
      if (validateConfig(cfgMod.buildConfig(overrides)).valid) valid++;
    });
    expect(valid / total).toBeGreaterThan(0.1);
  });
});
