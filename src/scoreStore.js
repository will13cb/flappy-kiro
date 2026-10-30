// Flappy Kiro score store: High_Score persistence in local storage.
// The single key holds the decimal string of a non-negative integer; anything else reads as 0.
// Every storage access is wrapped in try/catch so a round is never interrupted.

const KEY = 'flappyKiro.highScore';
// The top list is a JSON array of up to TOP_SIZE non-negative integers, sorted descending.
const TOP_KEY = 'flappyKiro.topScores';
const TOP_SIZE = 5;

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

// string|null -> sorted, capped list of non-negative integers; corrupt data reads as []
function parseTopScores(raw) {
  if (typeof raw !== 'string') return [];
  let list;
  try {
    list = JSON.parse(raw);
  } catch (e) {
    return [];
  }
  if (!Array.isArray(list)) return [];
  if (!list.every((n) => Number.isSafeInteger(n) && n >= 0)) return [];
  return list.slice().sort((a, b) => b - a).slice(0, TOP_SIZE);
}
// Returns a new list with score added, sorted descending and capped. The input is not mutated.
function insertScore(list, score) {
  return list.concat(score).sort((a, b) => b - a).slice(0, TOP_SIZE);
}
function loadTop(storage) {
  try {
    return parseTopScores(storage.getItem(TOP_KEY));
  } catch (e) {
    return [];
  }
}
// Returns true when the write succeeded.
function saveTop(storage, list) {
  try {
    storage.setItem(TOP_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
}
// Inserts the score, saves only when the list changed, and returns the resulting list.
// A score of 0 is not worth a place on the board.
function recordTop(storage, score, list) {
  if (!(score > 0)) return list;
  const next = insertScore(list, score);
  if (next.length === list.length && next.every((n, i) => n === list[i])) return list;
  saveTop(storage, next);
  return next;
}
export {
  KEY as HIGH_SCORE_KEY, TOP_KEY as TOP_SCORES_KEY, TOP_SIZE, parseHighScore, load, save, recordIfHigher,
  parseTopScores, insertScore, loadTop, saveTop, recordTop,
};
