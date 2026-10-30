// Feature: flappy-kiro, Property 46: URL overrides are whitelisted, numeric and always yield a valid config
// **Validates: Requirements 1.6, 4.4, 4.7, 13.5**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { loadConfig, buildConfig, validateConfig, TUNABLE, DEFAULT_CONFIG } from '../../src/config.js';

const NAMES = Object.keys(TUNABLE);

function fakeLog() {
  const warnings = [];
  return { warnings, warn: (m) => warnings.push(String(m)) };
}

function qs(entries) {
  return '?' + entries.map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
}

function toOverrides(entries) {
  const o = {};
  entries.forEach(([name, value]) => {
    const [g, k] = TUNABLE[name];
    (o[g] = o[g] || {})[k] = Number(value); // later entries win
  });
  return o;
}

const arbName = fc.constantFrom(...NAMES);
// Finite numbers near defaults (mostly valid) and wide ones (often invalid).
const arbNear = arbName.chain((name) => {
  const [g, k] = TUNABLE[name];
  const def = DEFAULT_CONFIG[g][k];
  return fc
    .double({ min: 0.5, max: 1.5, noNaN: true, noDefaultInfinity: true })
    .map((f) => [name, String(def * f)]);
});
const arbWide = fc.tuple(
  arbName,
  fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }).map(String)
);
const arbNumEntry = fc.oneof({ weight: 3, arbitrary: arbNear }, { weight: 1, arbitrary: arbWide });

const NON_NUMERIC = ['abc', '', ' ', 'NaN', 'Infinity', '-Infinity', '1e999', '12px', 'one'];
const arbText = fc.oneof(
  fc.constantFrom(...NON_NUMERIC),
  fc.string({ maxLength: 8 }).filter((s) => s.trim() === '' || !Number.isFinite(Number(s.trim())))
);
const arbBadValue = fc.tuple(arbName, arbText);
const arbUnknown = fc.tuple(
  fc
    .oneof(fc.constantFrom('foo', 'constructor', '__proto__', 'GRAVITY', 'width', 'toString'), fc.string({ minLength: 1, maxLength: 8 }))
    .filter((n) => !NAMES.includes(n)),
  fc.oneof(fc.double({ noNaN: true, noDefaultInfinity: true }).map(String), arbText)
);

describe('Property 46: URL overrides', () => {
  it('always returns a config that validateConfig accepts', () => {
    const arbEntry = fc.oneof(arbNumEntry, arbBadValue, arbUnknown);
    fc.assert(
      fc.property(fc.array(arbEntry, { maxLength: 10 }), (entries) => {
        const cfg = loadConfig(qs(entries), fakeLog());
        expect(validateConfig(cfg).valid).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('applies whitelisted finite numbers (last wins) and keeps defaults elsewhere', () => {
    fc.assert(
      fc.property(fc.array(arbNear, { minLength: 1, maxLength: 12 }), (entries) => {
        const overrides = toOverrides(entries);
        const expected = buildConfig(overrides);
        fc.pre(validateConfig(expected).valid);
        const log = fakeLog();
        const cfg = loadConfig(qs(entries), log);
        expect(log.warnings).toEqual([]);
        const named = new Set(entries.map(([n]) => n));
        NAMES.forEach((name) => {
          const [g, k] = TUNABLE[name];
          if (named.has(name)) expect(cfg[g][k]).toBe(overrides[g][k]);
          else expect(cfg[g][k]).toBe(DEFAULT_CONFIG[g][k]);
        });
        expect(cfg).toEqual(expected);
      }),
      { numRuns: 200 }
    );
  });

  it('ignores unknown names and non-numeric values, with one warning each', () => {
    fc.assert(
      fc.property(
        fc.array(arbNear, { maxLength: 5 }),
        fc.array(fc.oneof(arbBadValue, arbUnknown), { minLength: 1, maxLength: 6 }),
        (good, junk) => {
          const expected = buildConfig(toOverrides(good));
          fc.pre(validateConfig(expected).valid);
          const log = fakeLog();
          const cfg = loadConfig(qs([...junk, ...good]), log);
          expect(cfg).toEqual(expected);
          expect(log.warnings.length).toBe(junk.length);
          junk.forEach(([name]) => {
            expect(log.warnings.some((w) => w.includes('"' + name + '"'))).toBe(true);
          });
        }
      ),
      { numRuns: 200 }
    );
  });

  it('falls back to DEFAULT_CONFIG and logs the violated rules when overrides are invalid', () => {
    fc.assert(
      fc.property(fc.array(arbWide, { minLength: 1, maxLength: 6 }), (entries) => {
        const result = validateConfig(buildConfig(toOverrides(entries)));
        fc.pre(!result.valid);
        const log = fakeLog();
        const cfg = loadConfig(qs(entries), log);
        expect(cfg).toEqual(DEFAULT_CONFIG);
        result.errors.forEach((e) => expect(log.warnings).toContain(e));
        expect(log.warnings.length).toBeGreaterThan(0);
      }),
      { numRuns: 200 }
    );
  });
});
