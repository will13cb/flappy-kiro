// Feature: flappy-kiro, Property 28: Stored high score is the maximum
// **Validates: Requirements 16.1, 16.5**
// Only the scoreStore part is tested here; the game.js Game_Over wiring is not covered.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbScore, createFakeStorage, createThrowingStorage } from '../helpers/arbitraries.js';

import { HIGH_SCORE_KEY, load, recordIfHigher } from '../../src/scoreStore.js';

describe('Property 28: stored high score is the maximum', () => {
  it('leaves the stored value equal to max(score, stored)', () => {
    fc.assert(
      fc.property(arbScore, arbScore, (score, stored) => {
        const storage = createFakeStorage({ [HIGH_SCORE_KEY]: String(stored) });
        const result = recordIfHigher(storage, score, load(storage));
        expect(result).toBe(Math.max(score, stored));
        expect(load(storage)).toBe(Math.max(score, stored));
      }),
      { numRuns: 20 }
    );
  });

  it('leaves storage unchanged when score <= stored', () => {
    fc.assert(
      fc.property(arbScore, arbScore, (a, b) => {
        const score = Math.min(a, b);
        const stored = Math.max(a, b);
        const raw = String(stored);
        let writes = 0;
        const storage = createFakeStorage({ [HIGH_SCORE_KEY]: raw });
        const origSet = storage.setItem;
        storage.setItem = (k, v) => {
          writes++;
          origSet(k, v);
        };
        const result = recordIfHigher(storage, score, load(storage));
        expect(result).toBe(stored);
        expect(writes).toBe(0);
        expect(storage.getItem(HIGH_SCORE_KEY)).toBe(raw);
      }),
      { numRuns: 20 }
    );
  });

  it('returns the larger value even when storage throws', () => {
    fc.assert(
      fc.property(arbScore, arbScore, (score, stored) => {
        const storage = createThrowingStorage();
        expect(recordIfHigher(storage, score, stored)).toBe(Math.max(score, stored));
      }),
      { numRuns: 20 }
    );
  });
});
