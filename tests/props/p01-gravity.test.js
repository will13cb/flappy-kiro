// Feature: flappy-kiro, Property 1: Gravity integration
// **Validates: Requirements 3.1, 3.6**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createRequire } from 'module';
import { arbAnyConfig, arbGhost, arbDt } from '../helpers/arbitraries.js';

const require = createRequire(import.meta.url);
const { stepGhost } = require('../../src/physics.js');

describe('Property 1: gravity integration', () => {
  it('sets vy to vy + GRAVITY * dt and y to y + new vy * dt', () => {
    fc.assert(
      fc.property(
        arbAnyConfig.chain((cfg) => fc.tuple(fc.constant(cfg), arbGhost(cfg), arbDt(cfg))),
        ([cfg, ghost, dt]) => {
          const before = { ...ghost };
          const next = stepGhost(cfg, ghost, dt);
          const expectedVy = ghost.vy + cfg.ghost.GRAVITY * dt;
          expect(next.vy).toBe(expectedVy);
          expect(next.y).toBe(ghost.y + expectedVy * dt);
          // The input state is not mutated.
          expect(ghost).toEqual(before);
        }
      ),
      { numRuns: 100 }
    );
  });
});
