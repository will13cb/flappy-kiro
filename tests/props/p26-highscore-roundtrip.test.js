// Feature: flappy-kiro, Property 26: High score round trip
// **Validates: Requirements 16.2, 16.4**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  arbScore,
  arbStorageString,
  createFakeStorage,
  createThrowingStorage,
} from '../helpers/arbitraries.js';

import { HIGH_SCORE_KEY, parseHighScore, load, save, recordIfHigher } from '../../src/scoreStore.js';

const arbSafeInt = fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER });

describe('Property 26: high score round trip', () => {
  it('reads back the same integer that was saved', () => {
    fc.assert(
      fc.property(fc.oneof(arbScore, arbSafeInt), (score) => {
        const storage = createFakeStorage();
        expect(save(storage, score)).toBe(true);
        expect(storage.getItem(HIGH_SCORE_KEY)).toBe(String(score));
        expect(load(storage)).toBe(score);
        expect(parseHighScore(String(score))).toBe(score);
      }),
      { numRuns: 100 }
    );
  });

  it('persists a new high score through recordIfHigher and leaves lower ones untouched', () => {
    fc.assert(
      fc.property(arbScore, arbScore, (stored, score) => {
        const storage = createFakeStorage();
        save(storage, stored);
        const result = recordIfHigher(storage, score, load(storage));
        expect(result).toBe(Math.max(stored, score));
        expect(load(storage)).toBe(Math.max(stored, score));
      }),
      { numRuns: 100 }
    );
  });

  it('always reads a non-negative safe integer, whatever the stored string', () => {
    fc.assert(
      fc.property(arbStorageString, (raw) => {
        const v = load(createFakeStorage({ [HIGH_SCORE_KEY]: raw }));
        expect(Number.isSafeInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 }
    );
  });

  it('reads 0 when nothing is stored and survives unavailable storage', () => {
    expect(load(createFakeStorage())).toBe(0);
    fc.assert(
      fc.property(arbScore, (score) => {
        const storage = createThrowingStorage();
        expect(load(storage)).toBe(0);
        expect(save(storage, score)).toBe(false);
        expect(recordIfHigher(storage, score + 1, score)).toBe(score + 1);
      }),
      { numRuns: 100 }
    );
  });
});
