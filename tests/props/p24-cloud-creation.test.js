// Feature: flappy-kiro, Property 24: Cloud creation rules
// **Validates: Requirements 13.2, 13.3, 13.4, 13.5**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbConfig, rng } from '../helpers/arbitraries.js';

import { createClouds } from '../../src/clouds.js';

describe('Property 24: cloud creation rules', () => {
  it('creates clouds with valid alpha, speed range, position and layer fields', () => {
    fc.assert(
      fc.property(arbConfig, fc.integer(), (cfg, seed) => {
        const clouds = createClouds(cfg, rng(seed));
        const { LAYERS, LAYER_SPEEDS, SPEED_MIN, SPEED_MAX } = cfg.clouds;
        expect(clouds.length).toBe(2 * LAYERS.length);
        clouds.forEach((c, i) => {
          const layer = LAYERS[Math.floor(i / 2)];
          expect(c.alpha).toBeGreaterThan(0);
          expect(c.alpha).toBeLessThan(1);
          expect(c.speed).toBe(LAYER_SPEEDS[Math.floor(i / 2)]);
          expect(c.width).toBe(layer.WIDTH);
          expect(c.alpha).toBe(layer.ALPHA);
          expect(c.speed).toBeGreaterThanOrEqual(SPEED_MIN - 1e-9);
          expect(c.speed).toBeLessThanOrEqual(SPEED_MAX + 1e-9);
          expect(c.speed).toBeLessThan(cfg.speed.INITIAL_SPEED);
          expect(c.x).toBeGreaterThanOrEqual(0);
          expect(c.x).toBeLessThanOrEqual(cfg.world.WIDTH);
          expect(c.y).toBeGreaterThanOrEqual(0);
          expect(c.y).toBeLessThanOrEqual(0.6 * cfg.world.GROUND_TOP + 1e-9);
        });
      }),
      { numRuns: 20 }
    );
  });

  it('has at least two distinct speeds and orders speed by size', () => {
    fc.assert(
      fc.property(arbConfig, fc.integer(), (cfg, seed) => {
        const clouds = createClouds(cfg, rng(seed));
        expect(new Set(clouds.map((c) => c.speed)).size).toBeGreaterThanOrEqual(2);
        for (const a of clouds) {
          for (const b of clouds) {
            if (a.width < b.width) expect(a.speed).toBeLessThan(b.speed);
            if (a.width <= b.width) expect(a.speed).toBeLessThanOrEqual(b.speed);
          }
        }
      }),
      { numRuns: 20 }
    );
  });
});
