// Feature: flappy-kiro, Property 27: Invalid stored values read as zero
// **Validates: Requirements 16.3**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createRequire } from 'module';
import { arbStorageString, createFakeStorage, createThrowingStorage } from '../helpers/arbitraries.js';

const require = createRequire(import.meta.url);
const { HIGH_SCORE_KEY, parseHighScore, load } = require('../../src/scoreStore.js');

const isValid = (s) => /^\d+$/.test(s) && Number.isSafeInteger(Number(s));

describe('Property 27: invalid stored values read as zero', () => {
  it('reads 0 for any stored string that is not a non-negative integer', () => {
    fc.assert(
      fc.property(arbStorageString, (raw) => {
        fc.pre(!isValid(raw));
        expect(parseHighScore(raw)).toBe(0);
        expect(load(createFakeStorage({ [HIGH_SCORE_KEY]: raw }))).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('reads valid non-negative integer strings as that number', () => {
    fc.assert(
      fc.property(fc.nat(), (n) => {
        expect(load(createFakeStorage({ [HIGH_SCORE_KEY]: String(n) }))).toBe(n);
      }),
      { numRuns: 100 }
    );
  });

  it('reads 0 for a missing key, null and non-string values', () => {
    expect(load(createFakeStorage())).toBe(0);
    expect(parseHighScore(null)).toBe(0);
    expect(parseHighScore(undefined)).toBe(0);
  });

  it('reads 0 without raising when storage throws on access', () => {
    fc.assert(
      fc.property(fc.string(), (message) => {
        expect(load(createThrowingStorage(message))).toBe(0);
      }),
      { numRuns: 100 }
    );
  });
});
