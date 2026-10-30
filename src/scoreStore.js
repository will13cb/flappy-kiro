// Flappy Kiro score store: High_Score persistence in local storage.
// The single key holds the decimal string of a non-negative integer; anything else reads as 0.
// Every storage access is wrapped in try/catch so a round is never interrupted.
(function (root) {
  'use strict';

  const KEY = 'flappyKiro.highScore';

  // string|null -> non-negative integer, else 0
  function parseHighScore(raw) {
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return 0;
    const n = Number(raw);
    return Number.isSafeInteger(n) ? n : 0;
  }

  function load(storage) {
    try {
      return parseHighScore(storage.getItem(KEY));
    } catch (e) {
      return 0;
    }
  }

  // Returns true when the write succeeded.
  function save(storage, score) {
    try {
      storage.setItem(KEY, String(score));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Saves and returns the new high score only if score > stored; otherwise storage is untouched.
  function recordIfHigher(storage, score, stored) {
    if (score > stored) {
      save(storage, score);
      return score;
    }
    return stored;
  }

  const api = { HIGH_SCORE_KEY: KEY, parseHighScore, load, save, recordIfHigher };

  if (typeof window !== 'undefined') {
    window.FlappyKiro = window.FlappyKiro || {};
    Object.assign(window.FlappyKiro, api);
  }
  if (typeof module !== 'undefined' && module.exports) {
    Object.assign(module.exports, api);
  }
})(typeof window !== 'undefined' ? (window.FlappyKiro = window.FlappyKiro || {}) : {});
