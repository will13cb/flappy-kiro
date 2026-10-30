// Feature: flappy-kiro, Property 2: Jump sets a fixed upward velocity
// **Validates: Requirements 3.2**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbAnyConfig, arbGhost } from '../helpers/arbitraries.js';

import { applyJump } from '../../src/physics.js';

describe('Property 2: jump sets a fixed upward velocity', () => {
  it('sets vy to JUMP_VELOCITY (negative) and keeps y, whatever the previous state', () => {
    fc.assert(
      fc.property(
        arbAnyConfig.chain((cfg) => fc.tuple(fc.constant(cfg), arbGhost(cfg))),
        ([cfg, ghost]) => {
          const result = applyJump(cfg, ghost);
          expect(result.vy).toBe(cfg.ghost.JUMP_VELOCITY);
          expect(result.vy).toBeLessThan(0);
          expect(result.y).toBe(ghost.y);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('gives the same velocity for two different previous velocities', () => {
    fc.assert(
      fc.property(
        arbAnyConfig.chain((cfg) => fc.tuple(fc.constant(cfg), arbGhost(cfg), arbGhost(cfg))),
        ([cfg, a, b]) => {
          expect(applyJump(cfg, a).vy).toBe(applyJump(cfg, b).vy);
        }
      ),
      { numRuns: 20 }
    );
  });
});
