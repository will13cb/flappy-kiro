import { describe, it, expect } from 'vitest';
import {
  emptyData, submitScore, getLeaderboard, getPlayer, listAchievements, normalizeName, ACHIEVEMENTS,
} from '../../mcp/leaderboard/leaderboard.js';

const T = (n) => `2025-01-01T00:00:${String(n).padStart(2, '0')}.000Z`;

function play(runs) {
  let data = emptyData();
  const results = [];
  runs.forEach(([name, score], i) => {
    const out = submitScore(data, name, score, T(i));
    data = out.data;
    results.push(out.result);
  });
  return { data, results };
}

describe('submitScore', () => {
  it('records a first run as a new best and unlocks first achievements', () => {
    const { results } = play([['Ana', 3]]);
    expect(results[0]).toMatchObject({ player: 'Ana', score: 3, previousBest: null, isNewBest: true, bestScore: 3, rank: 1, totalPlayers: 1 });
    expect(results[0].unlockedAchievements.map((a) => a.id)).toEqual(['first_flight', 'first_point']);
  });

  it('keeps the best score, counts runs and totals, and never re-unlocks', () => {
    const { data, results } = play([['Ana', 12], ['ana', 5], ['ANA', 30]]);
    expect(results[1]).toMatchObject({ isNewBest: false, previousBest: 12, bestScore: 12 });
    expect(results[1].unlockedAchievements).toEqual([]);
    expect(results[2]).toMatchObject({ isNewBest: true, bestScore: 30, player: 'ANA' });
    expect(results[2].unlockedAchievements.map((a) => a.id)).toEqual(['score_25']);
    const p = getPlayer(data, 'ana');
    expect(p).toMatchObject({ runs: 3, totalScore: 47, bestScore: 30, bestAt: T(2), averageScore: 15.7 });
  });

  it('does not mutate the input data', () => {
    const data = emptyData();
    const snapshot = structuredClone(data);
    submitScore(data, 'Bo', 4, T(0));
    expect(data).toEqual(snapshot);
  });

  it('rejects invalid names and scores', () => {
    const d = emptyData();
    for (const bad of ['', '   ', 'x'.repeat(21), '<script>', 7, null]) {
      expect(() => submitScore(d, bad, 1, T(0))).toThrow(/player/);
    }
    for (const bad of [-1, 1.5, NaN, '3', 1_000_001]) {
      expect(() => submitScore(d, 'Ana', bad, T(0))).toThrow(/score/);
    }
  });

  it('normalises whitespace and treats names case-insensitively', () => {
    expect(normalizeName('  Big   Ghost ')).toEqual({ id: 'big ghost', name: 'Big Ghost' });
  });

  it('stores "__proto__" as an ordinary player without touching prototypes', () => {
    const { data } = play([['__proto__', 2]]);
    expect(Object.getPrototypeOf(data.players)).toBe(Object.prototype);
    expect(getPlayer(data, '__proto__').bestScore).toBe(2);
    expect({}.bestScore).toBeUndefined();
  });
});

describe('rankings', () => {
  it('ranks by best score, ties share a rank and the earlier best is listed first', () => {
    const { data } = play([['Cy', 10], ['Ana', 20], ['Bo', 10], ['Di', 5]]);
    const board = getLeaderboard(data, 10);
    expect(board.totalPlayers).toBe(4);
    expect(board.entries.map((e) => [e.rank, e.player])).toEqual([[1, 'Ana'], [2, 'Cy'], [2, 'Bo'], [4, 'Di']]);
    expect(getPlayer(data, 'bo').rank).toBe(2);
  });

  it('honours the limit and validates it', () => {
    const { data } = play([['A', 1], ['B', 2], ['C', 3]]);
    expect(getLeaderboard(data, 2).entries.map((e) => e.player)).toEqual(['C', 'B']);
    expect(() => getLeaderboard(data, 0)).toThrow(/limit/);
    expect(getLeaderboard(emptyData()).entries).toEqual([]);
  });

  it('reports the rank after a submission', () => {
    const { results } = play([['Ana', 20], ['Bo', 30]]);
    expect(results[1]).toMatchObject({ rank: 1, totalPlayers: 2 });
  });
});

describe('achievements', () => {
  it('unlocks run-count and total-score achievements', () => {
    const runs = Array.from({ length: 10 }, () => ['Ana', 10]);
    const { data } = play(runs);
    const unlocked = getPlayer(data, 'Ana').achievements.filter((a) => a.unlockedAt).map((a) => a.id);
    expect(unlocked).toEqual(expect.arrayContaining(['runs_10', 'total_100', 'score_10']));
    expect(unlocked).not.toContain('runs_50');
  });

  it('lists every achievement with unlock counts', () => {
    const { data } = play([['Ana', 0], ['Bo', 1]]);
    const list = listAchievements(data);
    expect(list).toHaveLength(ACHIEVEMENTS.length);
    expect(list.find((a) => a.id === 'first_flight').unlockedBy).toBe(2);
    expect(list.find((a) => a.id === 'first_point').unlockedBy).toBe(1);
  });

  it('throws for an unknown player', () => {
    expect(() => getPlayer(emptyData(), 'Nobody')).toThrow(/unknown player/);
  });
});
