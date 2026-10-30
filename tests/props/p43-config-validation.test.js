// Feature: flappy-kiro, Property 43: Config validation accepts the defaults and rejects each broken relationship
// **Validates: Requirements 4.4, 4.5, 4.6, 4.7, 6.1, 7.2, 7.7, 8.1, 13.3, 13.5, 17.1**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbAnyConfig, DEFAULT_CONFIG } from '../helpers/arbitraries.js';

import { validateConfig } from '../../src/config.js';

// Configs are deep-frozen, so every mutation works on a plain clone.
const thaw = (cfg) => JSON.parse(JSON.stringify(cfg));

const dbl = (min, max) => fc.double({ min, max, noNaN: true, noDefaultInfinity: true });
// t in (0, 1]: scales how far a relationship is pushed past its limit.
const arbT = dbl(0.01, 1);

const DURATIONS = ['INVINCIBILITY_MS', 'CRASH_MS', 'LOCKOUT_MS'];
const BAD_NUMBERS = [NaN, Infinity, -Infinity];
const BAD_NON_NUMBERS = ['abc', '12', null, true, {}];
const FINITE_KEYS = [
  ['ghost', 'HITBOX_RADIUS'], ['ghost', 'GRAVITY'],
  ['pipes', 'GAP_HEIGHT'], ['pipes', 'PIPE_SPACING'], ['pipes', 'MAX_GAP_SHIFT'],
  ['speed', 'INITIAL_SPEED'], ['speed', 'SPEED_STEP_INTERVAL'], ['speed', 'MAX_SPEED'],
  ['timing', 'INVINCIBILITY_MS'], ['timing', 'CRASH_MS'], ['timing', 'LOCKOUT_MS'],
  ['clouds', 'SPEED_MIN'], ['clouds', 'SPEED_MAX'],
];

// One mutation per rule id. Each takes a thawed config and t in (0, 1], and breaks only its rule.
const MUTATIONS = {
  'gap.heightVsHitbox': (c, t) => {
    c.pipes.GAP_HEIGHT = 2 * c.ghost.HITBOX_RADIUS * (1 - 0.5 * (t - 0.01)); // <= 2 * radius
  },
  'ghost.radiusFits': (c, t) => {
    c.ghost.HITBOX_RADIUS = c.ghost.SPRITE_SIZE / 2 + 1 + t * 10;
  },
  'ghost.jumpUp': (c, t) => {
    c.ghost.JUMP_VELOCITY = t > 0.5 ? 0 : t * 100;
  },
  'gap.fitsAboveGround': (c, t) => {
    c.pipes.GAP_MARGIN = (c.world.GROUND_TOP - c.pipes.GAP_HEIGHT) / 2 + t * 50;
  },
  'gap.capFits': (c, t) => {
    c.pipes.GAP_MARGIN = c.pipes.CAP_HEIGHT * (1 - t); // 0 <= margin < CAP_HEIGHT
  },
  'reach.fall': (c, t) => {
    const limit = c.pipes.PIPE_SPACING / c.speed.MAX_SPEED;
    const minShift = (c.ghost.GRAVITY * limit * limit) / 2; // fall time == limit
    c.pipes.MAX_GAP_SHIFT = minShift * (1 + t);
  },
  'reach.climb': (c, t) => {
    const limit = c.pipes.PIPE_SPACING / c.speed.MAX_SPEED;
    // climb >= 2 * MAX_GAP_SHIFT / v, so v <= 2 * shift / limit guarantees climb >= limit.
    const v = (2 * c.pipes.MAX_GAP_SHIFT / limit) * t;
    c.ghost.JUMP_VELOCITY = -v;
    c.ghost.JUMP_SPEED = v;
  },
  'speed.order': (c, t) => {
    c.speed.INITIAL_SPEED = c.speed.MAX_SPEED + t * 100;
  },
  'clouds.belowScroll': (c, t) => {
    c.clouds.SPEED_MAX = c.speed.INITIAL_SPEED + t * 50;
  },
  'clouds.order': (c, t) => {
    c.clouds.SPEED_MIN = c.clouds.SPEED_MAX + (t > 0.5 ? 0 : t * 10);
  },
  'timing.positive': (c, t) => {
    const key = DURATIONS[Math.floor(t * 1000) % DURATIONS.length];
    c.timing[key] = t > 0.5 ? 0 : -t * 1000;
  },
  'timing.lockoutAfterCrash': (c, t) => {
    c.timing.LOCKOUT_MS = Math.max(1, c.timing.CRASH_MS * (1 - 0.5 * t)); // > 0 but <= CRASH_MS
  },
  'anim.deathFitsCrash': (c, t) => {
    c.animation.DEATH_TOTAL_MS = c.timing.CRASH_MS + t * 1000;
  },
};

// gap.capFits is not combinable: it needs a small GAP_MARGIN, gap.fitsAboveGround needs a large one.
// Order matters when several are combined: later mutations must not undo earlier ones.
// speed.order runs before clouds.belowScroll, which runs before clouds.order.
const COMBINABLE = [
  'gap.heightVsHitbox', 'ghost.jumpUp', 'gap.fitsAboveGround',
  'reach.fall', 'speed.order', 'clouds.belowScroll', 'clouds.order', 'timing.positive',
  'anim.deathFitsCrash',
];

describe('Property 43: config validation', () => {
  it('accepts DEFAULT_CONFIG with no errors', () => {
    expect(validateConfig(DEFAULT_CONFIG)).toEqual({ valid: true, errors: [] });
  });

  it('accepts every generated valid config (control for the mutations)', () => {
    fc.assert(
      fc.property(arbAnyConfig, (cfg) => {
        expect(validateConfig(cfg).valid).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  for (const ruleId of Object.keys(MUTATIONS)) {
    it(`rejects a config that breaks ${ruleId} and reports its rule id`, () => {
      fc.assert(
        fc.property(arbAnyConfig, arbT, (cfg, t) => {
          const broken = thaw(cfg);
          MUTATIONS[ruleId](broken, t);
          const result = validateConfig(broken);
          expect(result.valid).toBe(false);
          expect(result.errors.some((e) => e.startsWith(ruleId + ':'))).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  }

  it('rejects NaN, Infinity and -Infinity in any numeric value with number.finite', () => {
    fc.assert(
      fc.property(arbAnyConfig, fc.constantFrom(...FINITE_KEYS), fc.constantFrom(...BAD_NUMBERS), (cfg, [g, k], bad) => {
        const broken = thaw(cfg);
        broken[g][k] = bad;
        const result = validateConfig(broken);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.startsWith('number.finite:'))).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('rejects a non-number where a number is required with number.finite', () => {
    fc.assert(
      fc.property(arbAnyConfig, fc.constantFrom(...FINITE_KEYS), fc.constantFrom(...BAD_NON_NUMBERS), (cfg, [g, k], bad) => {
        const broken = thaw(cfg);
        broken[g][k] = bad;
        const result = validateConfig(broken);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.startsWith('number.finite:'))).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('reports the rule id of every broken relationship when several are broken', () => {
    const arbSubset = fc
      .subarray(COMBINABLE, { minLength: 2 })
      .map((ids) => COMBINABLE.filter((id) => ids.includes(id)));
    fc.assert(
      fc.property(arbAnyConfig, arbSubset, arbT, (cfg, ids, t) => {
        const broken = thaw(cfg);
        ids.forEach((id) => MUTATIONS[id](broken, t));
        const result = validateConfig(broken);
        expect(result.valid).toBe(false);
        const missing = ids.filter((id) => !result.errors.some((e) => e.startsWith(id + ':')));
        expect(missing).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });

  it('also reports reach.climb together with reach.fall', () => {
    fc.assert(
      fc.property(arbAnyConfig, arbT, arbT, (cfg, t1, t2) => {
        const broken = thaw(cfg);
        MUTATIONS['reach.fall'](broken, t1);
        MUTATIONS['reach.climb'](broken, t2);
        const ids = validateConfig(broken).errors.map((e) => e.split(':')[0]);
        expect(ids).toContain('reach.fall');
        expect(ids).toContain('reach.climb');
      }),
      { numRuns: 100 }
    );
  });
});
