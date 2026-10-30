// Feature: flappy-kiro, Property 47: Top scores stay sorted, capped at 5 and survive a round trip
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbScore, arbStorageString, createFakeStorage, createThrowingStorage } from '../helpers/arbitraries.js';
import {
  TOP_SCORES_KEY, TOP_SIZE, parseTopScores, insertScore, loadTop, saveTop, recordTop,
} from '../../src/scoreStore.js';
const arbList = fc.array(arbScore, { maxLength: 12 }).map((l) => l.sort((a, b) => b - a).slice(0, TOP_SIZE));
const sortedDesc = (l) => l.every((n, i) => i === 0 || l[i - 1] >= n);
describe('Property 47: top scores', () => {
  it('insertScore keeps the list sorted, capped and containing the best scores', () => {
    fc.assert(
      fc.property(arbList, arbScore, (list, score) => {
        const before = list.slice();
        const next = insertScore(list, score);
        expect(list).toEqual(before);
        expect(next.length).toBe(Math.min(TOP_SIZE, list.length + 1));
        expect(sortedDesc(next)).toBe(true);
        expect(next).toEqual(before.concat(score).sort((a, b) => b - a).slice(0, TOP_SIZE));
      }),
      { numRuns: 100 }
    );
  });
  it('reads back what was saved', () => {
    fc.assert(
      fc.property(arbList, (list) => {
        const storage = createFakeStorage();
        expect(saveTop(storage, list)).toBe(true);
        expect(storage.getItem(TOP_SCORES_KEY)).toBe(JSON.stringify(list));
        expect(loadTop(storage)).toEqual(list);
      }),
      { numRuns: 100 }
    );
  });
  it('parseTopScores always returns a sorted list of at most 5 non-negative integers', () => {
    fc.assert(
      fc.property(fc.oneof(arbStorageString, fc.json().map(String), fc.constant(null)), (raw) => {
        const list = parseTopScores(raw);
        expect(list.length).toBeLessThanOrEqual(TOP_SIZE);
        expect(sortedDesc(list)).toBe(true);
        list.forEach((n) => expect(Number.isSafeInteger(n) && n >= 0).toBe(true));
      }),
      { numRuns: 100 }
    );
  });
  it('reads corrupt data as an empty list', () => {
    const bad = [null, '', 'abc', '{}', '[1,', '[-1]', '[1.5]', '["3"]', '[null]', '"5"', '7', '[1e999]'];
    bad.forEach((raw) => expect(parseTopScores(raw)).toEqual([]));
  });
  it('never throws when storage fails and recordTop keeps the list', () => {
    const storage = createThrowingStorage();
    expect(loadTop(storage)).toEqual([]);
    expect(saveTop(storage, [1])).toBe(false);
    expect(() => recordTop(storage, 5, [3])).not.toThrow();
  });
  it('recordTop persists a change and leaves storage untouched otherwise', () => {
    const storage = createFakeStorage();
    const full = [9, 8, 7, 6, 5];
    expect(recordTop(storage, 4, full)).toBe(full);
    expect(recordTop(storage, 0, full)).toBe(full);
    expect(storage.getItem(TOP_SCORES_KEY)).toBe(null);
    expect(recordTop(storage, 10, full)).toEqual([10, 9, 8, 7, 6]);
    expect(loadTop(storage)).toEqual([10, 9, 8, 7, 6]);
  });
});
