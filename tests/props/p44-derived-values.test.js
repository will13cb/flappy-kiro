// Feature: flappy-kiro, Property 44: Derived values follow from base values
// **Validates: Requirements 4.5, 6.1, 6.3, 13.5, 17.1**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createRequire } from 'module';
import { arbConfig } from '../helpers/arbitraries.js';

const require = createRequire(import.meta.url);
const { buildConfig } = require('../../src/config.js');

function overridesOf(cfg) {
  // Rebuild overrides from a generated config (tunable keys only are honoured).
  const { TUNABLE } = require('../../src/config.js');
  const o = {};
  Object.values(TUNABLE).forEach(([g, k]) => {
    (o[g] = o[g] || {})[k] = cfg[g][k];
  });
  return o;
}

function isFrozenDeep(obj) {
  if (obj === null || typeof obj !== 'object') return true;
  return Object.isFrozen(obj) && Object.keys(obj).every((k) => isFrozenDeep(obj[k]));
}

describe('Property 44: derived values follow from base values', () => {
  it('computes every derived value from the base values', () => {
    fc.assert(
      fc.property(arbConfig, (generated) => {
        const c = buildConfig(overridesOf(generated));
        expect(c.world.GROUND_TOP).toBe(c.world.HEIGHT - c.world.GROUND_HEIGHT);
        expect(c.pipes.GAP_CENTER_MIN).toBe(c.pipes.GAP_MARGIN + c.pipes.GAP_HEIGHT / 2);
        expect(c.pipes.GAP_CENTER_MAX).toBe(
          c.world.GROUND_TOP - c.pipes.GAP_MARGIN - c.pipes.GAP_HEIGHT / 2
        );
        expect(c.ghost.HITBOX_MARGIN).toBe(c.ghost.SPRITE_SIZE / 2 - c.ghost.HITBOX_RADIUS);
        expect(c.ghost.JUMP_SPEED).toBe(-c.ghost.JUMP_VELOCITY);
        expect(c.pipes.SPAWN_X).toBe(c.world.WIDTH - c.pipes.PIPE_SPACING);
        expect(c.timing.MAX_DT).toBe(c.timing.MAX_FRAME_MS / 1000);
        expect(c.ui.BUTTON_X).toBe((c.world.WIDTH - c.ui.BUTTON_WIDTH) / 2);
        expect(c.clouds.LAYER_SPEEDS).toHaveLength(c.clouds.LAYERS.length);
        c.clouds.LAYERS.forEach((l, i) => {
          expect(c.clouds.LAYER_SPEEDS[i]).toBe(
            c.clouds.SPEED_MIN + l.DEPTH * (c.clouds.SPEED_MAX - c.clouds.SPEED_MIN)
          );
        });
      }),
      { numRuns: 100 }
    );
  });

  it('ignores derived keys passed as overrides', () => {
    fc.assert(
      fc.property(arbConfig, fc.double({ noNaN: true, min: -1e6, max: 1e6 }), (generated, junk) => {
        const base = overridesOf(generated);
        const expected = buildConfig(base);
        const tampered = JSON.parse(JSON.stringify(base));
        ['world', 'pipes', 'ghost', 'timing', 'ui', 'clouds'].forEach((g) => {
          tampered[g] = tampered[g] || {};
        });
        tampered.world.GROUND_TOP = junk;
        tampered.pipes.GAP_CENTER_MIN = junk;
        tampered.pipes.GAP_CENTER_MAX = junk;
        tampered.pipes.SPAWN_X = junk;
        tampered.ghost.HITBOX_MARGIN = junk;
        tampered.ghost.JUMP_SPEED = junk;
        tampered.timing.MAX_DT = junk;
        tampered.ui.BUTTON_X = junk;
        tampered.clouds.LAYER_SPEEDS = [junk];
        expect(buildConfig(tampered)).toEqual(expected);
      }),
      { numRuns: 100 }
    );
  });

  it('returns a config frozen at every level', () => {
    fc.assert(
      fc.property(arbConfig, (generated) => {
        expect(isFrozenDeep(buildConfig(overridesOf(generated)))).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
