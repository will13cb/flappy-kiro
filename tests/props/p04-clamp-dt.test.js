// Feature: flappy-kiro, Property 4: Frame time is clamped
// **Validates: Requirements 12.5**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createRequire } from 'module';
import { arbConfig } from '../helpers/arbitraries.js';

const require = createRequire(import.meta.url);
const { clampDt } = require('../../src/physics.js');

const arbRaw = fc.oneof(
  fc.double({ noNaN: true, min: -10, max: 10, noDefaultInfinity: true }),
  fc.double({ noNaN: true, min: 0, max: 0.2, noDefaultInfinity: true })
);

describe('Property 4: frame time is clamped', () => {
  it('lies in [0, MAX_DT] for any raw time', () => {
    fc.assert(
      fc.property(arbConfig, arbRaw, (cfg, raw) => {
        const dt = clampDt(cfg, raw);
        expect(dt).toBeGreaterThanOrEqual(0);
        expect(dt).toBeLessThanOrEqual(cfg.timing.MAX_DT);
      }),
      { numRuns: 100 }
    );
  });

  it('equals the raw time when already within [0, MAX_DT]', () => {
    fc.assert(
      fc.property(arbConfig, fc.double({ noNaN: true, min: 0, max: 1, noDefaultInfinity: true }), (cfg, frac) => {
        const raw = frac * cfg.timing.MAX_DT;
        expect(clampDt(cfg, raw)).toBe(raw);
      }),
      { numRuns: 100 }
    );
  });
});
