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
// Best medal ever and the chosen skin and trail, stored as plain strings next to the high score.
const MEDAL_KEY = "flappyKiro.bestMedal";
const SKIN_KEY = "flappyKiro.skin";
const TRAIL_KEY = "flappyKiro.trail";
const MODE_KEY = "flappyKiro.playMode";
// Best score per single-world mode: a JSON object of world id -> non-negative integer.
const WORLD_BESTS_KEY = "flappyKiro.worldBests";
function readKey(storage, key) {
  try {
    return storage.getItem(key);
  } catch (e) {
    return null;
  }
}
function writeKey(storage, key, value) {
  try {
    storage.setItem(key, value);
    return true;
  } catch (e) {
    return false;
  }
}
// isValid(medal) decides what counts as a medal; anything else reads as none (null).
function loadBestMedal(storage, isValid) {
  const raw = readKey(storage, MEDAL_KEY);
  return isValid(raw) ? raw : null;
}
// Saves and returns the better of the two medals; storage is touched only when it improves.
function recordBestMedal(storage, medal, stored, better) {
  const best = better(stored, medal);
  if (best !== stored && best !== null) writeKey(storage, MEDAL_KEY, best);
  return best;
}
function loadSkin(storage, isValid) {
  const raw = readKey(storage, SKIN_KEY);
  return isValid(raw) ? raw : null;
}
const saveSkin = (storage, id) => writeKey(storage, SKIN_KEY, id);
function loadTrail(storage, isValid) {
  const raw = readKey(storage, TRAIL_KEY);
  return isValid(raw) ? raw : null;
}
const saveTrail = (storage, id) => writeKey(storage, TRAIL_KEY, id);
function loadPlayMode(storage, isValid) {
  const raw = readKey(storage, MODE_KEY);
  return isValid(raw) ? raw : null;
}
const savePlayMode = (storage, id) => writeKey(storage, MODE_KEY, id);
// ids: the world ids to keep. Corrupt data or bad values read as 0 for that world.
function loadWorldBests(storage, ids) {
  let parsed = null;
  try {
    parsed = JSON.parse(readKey(storage, WORLD_BESTS_KEY));
  } catch (e) {
    parsed = null;
  }
  const out = {};
  ids.forEach((id) => {
    const v = parsed && typeof parsed === 'object' ? parsed[id] : undefined;
    out[id] = Number.isSafeInteger(v) && v >= 0 ? v : 0;
  });
  return out;
}
// Saves and returns new bests when score beats the stored one for that world; otherwise untouched.
function recordWorldBest(storage, id, score, bests) {
  if (!(score > (bests[id] || 0))) return bests;
  const next = Object.assign({}, bests, { [id]: score });
  writeKey(storage, WORLD_BESTS_KEY, JSON.stringify(next));
  return next;
}
export {
  KEY as HIGH_SCORE_KEY, TOP_KEY as TOP_SCORES_KEY, TOP_SIZE, parseHighScore, load, save, recordIfHigher,
  parseTopScores, insertScore, loadTop, saveTop, recordTop,
  MEDAL_KEY, SKIN_KEY, TRAIL_KEY, loadBestMedal, recordBestMedal, loadSkin, saveSkin, loadTrail, saveTrail,
  MODE_KEY, WORLD_BESTS_KEY, loadPlayMode, savePlayMode, loadWorldBests, recordWorldBest,
};
