// Shared fast-check generators and fakes for Flappy Kiro tests.
import fc from 'fast-check';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { buildConfig, validateConfig, TUNABLE, DEFAULT_CONFIG } = require('../../src/config.js');

export { DEFAULT_CONFIG };

// Factors applied to each tunable default. Some values are integers by rule.
const INTEGER_KEYS = new Set(['SPEED_STEP_INTERVAL']);

function tunableArb([group, key]) {
  const def = DEFAULT_CONFIG[group][key];
  const factor = fc.double({ min: 0.5, max: 1.5, noNaN: true, noDefaultInfinity: true });
  return factor.map((f) => {
    const v = def * f;
    return INTEGER_KEYS.has(key) ? Math.max(1, Math.round(v)) : v;
  });
}

// Config built from tunable values near their defaults; only valid configs are kept.
export const arbConfig = fc
  .record(
    Object.fromEntries(Object.keys(TUNABLE).map((name) => [name, tunableArb(TUNABLE[name])]))
  )
  .map((vals) => {
    const overrides = {};
    Object.keys(TUNABLE).forEach((name) => {
      const [group, key] = TUNABLE[name];
      (overrides[group] = overrides[group] || {})[key] = vals[name];
    });
    return buildConfig(overrides);
  })
  .filter((cfg) => validateConfig(cfg).valid);

// Mixes the default config in so runs always cover it.
export const arbAnyConfig = fc.oneof({ weight: 1, arbitrary: fc.constant(DEFAULT_CONFIG) }, { weight: 4, arbitrary: arbConfig });

// Ghost state { y, vy }: y anywhere from above the world to below the ground.
export function arbGhost(cfg = DEFAULT_CONFIG) {
  return fc.record({
    y: fc.double({ min: -50, max: cfg.world.HEIGHT + 50, noNaN: true, noDefaultInfinity: true }),
    vy: fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
  });
}

// Pipe pair { x, gapCenter, scored } with a gap center inside the legal range.
export function arbPipe(cfg = DEFAULT_CONFIG) {
  return fc.record({
    x: fc.double({ min: -cfg.pipes.CAP_WIDTH * 2, max: cfg.world.WIDTH * 2, noNaN: true, noDefaultInfinity: true }),
    gapCenter: fc.double({
      min: cfg.pipes.GAP_CENTER_MIN,
      max: cfg.pipes.GAP_CENTER_MAX,
      noNaN: true,
      noDefaultInfinity: true,
    }),
    scored: fc.boolean(),
  });
}

export function arbPipes(cfg = DEFAULT_CONFIG, maxLength = 8) {
  return fc.array(arbPipe(cfg), { minLength: 0, maxLength });
}

// dt in (0, MAX_DT]
export function arbDt(cfg = DEFAULT_CONFIG) {
  const max = cfg.timing.MAX_DT;
  return fc
    .double({ min: 0, max, noNaN: true, noDefaultInfinity: true })
    .filter((d) => d > 0 && d <= max);
}

export const arbScore = fc.integer({ min: 0, max: 1000 });

export const arbRect = fc.record({
  x: fc.double({ min: -500, max: 500, noNaN: true, noDefaultInfinity: true }),
  y: fc.double({ min: -500, max: 500, noNaN: true, noDefaultInfinity: true }),
  w: fc.double({ min: 0.5, max: 300, noNaN: true, noDefaultInfinity: true }),
  h: fc.double({ min: 0.5, max: 300, noNaN: true, noDefaultInfinity: true }),
});

export const arbCircle = fc.record({
  cx: fc.double({ min: -500, max: 500, noNaN: true, noDefaultInfinity: true }),
  cy: fc.double({ min: -500, max: 500, noNaN: true, noDefaultInfinity: true }),
  r: fc.double({ min: 0.5, max: 100, noNaN: true, noDefaultInfinity: true }),
});

// Arbitrary strings for storage values, biased toward numeric-looking ones.
export const arbStorageString = fc.oneof(
  fc.string(),
  fc.integer({ min: -1000, max: 100000 }).map(String),
  fc.double({ noDefaultInfinity: false }).map(String),
  fc.constantFrom('', ' ', '0', '-1', '1.5', '1e3', 'NaN', 'Infinity', '007', '0x10', 'abc', '12abc', '9007199254740993')
);

// Seeded deterministic rng returning floats in [0, 1) (mulberry32).
export function rng(seed = 1) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// In-memory storage with the getItem/setItem shape of localStorage.
export function createFakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
    data,
  };
}

// Storage whose every access throws (private mode, disabled storage).
export function createThrowingStorage(message = 'storage unavailable') {
  const fail = () => {
    throw new Error(message);
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}
