// Feature: flappy-kiro, Property 45: JSON mapping round trip
// **Validates: Requirements 1.6**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { mapJson, unmapJson } = require('../../src/config.js');

const num = fc.double({ min: 0.001, max: 100000, noNaN: true, noDefaultInfinity: true });
const signed = fc.double({ min: -100000, max: -0.001, noNaN: true, noDefaultInfinity: true });
const group = (keys) =>
  fc.record(Object.fromEntries(keys.map((k) => [k, num])));

const jsonArb = fc.record({
  _comment: fc.string(),
  world: group(['width', 'height', 'groundHeight']),
  ghost: fc.record({
    spriteSize: num,
    hitboxShape: fc.constant('circle'),
    hitboxRadius: num,
    x: num,
    gravity: num,
    jumpVelocity: signed,
  }),
  pipes: group(['pipeWidth', 'capWidth', 'capHeight', 'gapHeight', 'gapMargin', 'pipeSpacing', 'maxGapShift']),
  speed: group(['wallSpeed', 'speedIncrement', 'speedStepInterval', 'maxSpeed']),
  timing: group(['invincibilityMs', 'crashMs', 'crashFlashMs', 'blinkMs', 'lockoutMs', 'maxFrameMs']),
  clouds: fc.record({
    speedMin: num,
    speedMax: num,
    layers: fc.array(fc.record({ width: num, depth: num, alpha: num }), { minLength: 3, maxLength: 6 }),
  }),
});

describe('Property 45: JSON mapping round trip', () => {
  it('unmapJson(mapJson(json)) equals the original without _comment', () => {
    fc.assert(
      fc.property(jsonArb, (json) => {
        const { _comment, ...expected } = json;
        expect(unmapJson(mapJson(json))).toEqual(expected);
      }),
      { numRuns: 100 }
    );
  });

  it('maps values unchanged to their config keys and ignores unknown keys', () => {
    fc.assert(
      fc.property(jsonArb, fc.string(), (json, extra) => {
        const withExtra = { ...json, ['x_' + extra]: 1 };
        withExtra.world = { ...json.world, ['y_' + extra]: 2 };
        const base = mapJson(withExtra);
        expect(base.speed.INITIAL_SPEED).toBe(json.speed.wallSpeed);
        expect(base.ghost.JUMP_VELOCITY).toBe(json.ghost.jumpVelocity);
        expect(base.ghost.JUMP_VELOCITY).toBeLessThan(0);
        expect(base.ghost.HITBOX_SHAPE).toBe('circle');
        expect(base.world.WIDTH).toBe(json.world.width);
        expect(base.pipes.MAX_GAP_SHIFT).toBe(json.pipes.maxGapShift);
        expect(base.timing.MAX_FRAME_MS).toBe(json.timing.maxFrameMs);
        expect(base.clouds.SPEED_MAX).toBe(json.clouds.speedMax);
        expect(base.clouds.LAYERS).toEqual(
          json.clouds.layers.map((l) => ({ WIDTH: l.width, DEPTH: l.depth, ALPHA: l.alpha }))
        );
        expect(JSON.stringify(base)).not.toContain('_comment');
        expect(base.world).not.toHaveProperty('y_' + extra);
      }),
      { numRuns: 100 }
    );
  });
});
