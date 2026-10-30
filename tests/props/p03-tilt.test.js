// Feature: flappy-kiro, Property 3: Tilt follows the direction of motion
// **Validates: Requirements 3.5, 3.7**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { tiltFor } from '../../src/physics.js';

const arbVy = fc.double({ min: -5000, max: 5000, noNaN: true });

describe('Property 3: tilt follows the direction of motion', () => {
  it('is negative when moving up, positive when moving down', () => {
    fc.assert(
      fc.property(arbVy, (vy) => {
        const t = tiltFor(vy);
        if (vy < 0) expect(t).toBeLessThan(0);
        else if (vy > 0) expect(t).toBeGreaterThan(0);
      })
    );
  });

  it('is exactly zero when velocity is zero', () => {
    expect(tiltFor(0)).toBe(0);
    expect(tiltFor(-0)).toBe(0);
  });

  it('has the same sign for tiny and huge velocities', () => {
    fc.assert(
      fc.property(fc.double({ min: 1e-9, max: 1e9, noNaN: true }), (m) => {
        expect(tiltFor(m)).toBeGreaterThan(0);
        expect(tiltFor(-m)).toBeLessThan(0);
      })
    );
  });
});
