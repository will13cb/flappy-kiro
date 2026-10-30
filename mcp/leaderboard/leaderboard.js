// Leaderboard logic: pure functions over a plain data object { version, players: { [id]: Player } }.
// Player: { name, bestScore, bestAt, runs, totalScore, achievements: { [id]: unlockedAt } }.
// Nothing here touches the file system or the clock; `now` is passed in as an ISO string.

export const MAX_NAME_LENGTH = 20;
export const MAX_SCORE = 1_000_000;
const NAME_PATTERN = /^[A-Za-z0-9 _-]+$/;

// check(player, run) -> boolean. Evaluated after the run is applied.
export const ACHIEVEMENTS = [
  { id: 'first_flight', name: 'First Flight', description: 'Finish your first run', check: (p) => p.runs >= 1 },
  { id: 'first_point', name: 'Through the Gap', description: 'Score at least 1 point in a run', check: (_p, r) => r.score >= 1 },
  { id: 'score_10', name: 'Getting the Hang of It', description: 'Score 10 in a run', check: (_p, r) => r.score >= 10 },
  { id: 'score_25', name: 'Steady Wings', description: 'Score 25 in a run', check: (_p, r) => r.score >= 25 },
  { id: 'score_50', name: 'Ghost Pilot', description: 'Score 50 in a run', check: (_p, r) => r.score >= 50 },
  { id: 'score_100', name: 'Phantom Ace', description: 'Score 100 in a run', check: (_p, r) => r.score >= 100 },
  { id: 'runs_10', name: 'Persistent Spirit', description: 'Play 10 runs', check: (p) => p.runs >= 10 },
  { id: 'runs_50', name: 'Haunting Habit', description: 'Play 50 runs', check: (p) => p.runs >= 50 },
  { id: 'total_100', name: 'Centurion', description: 'Score 100 points in total', check: (p) => p.totalScore >= 100 },
  { id: 'total_1000', name: 'Thousand Gaps', description: 'Score 1000 points in total', check: (p) => p.totalScore >= 1000 },
];

export function emptyData() {
  return { version: 1, players: {} };
}

// Trims and validates a display name; the case-insensitive form is the player id.
export function normalizeName(raw) {
  if (typeof raw !== 'string') throw new Error('player must be a string');
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > MAX_NAME_LENGTH) {
    throw new Error('player must be 1 to ' + MAX_NAME_LENGTH + ' characters');
  }
  if (!NAME_PATTERN.test(name)) throw new Error('player may only contain letters, digits, spaces, _ and -');
  return { id: name.toLowerCase(), name };
}

export function validateScore(score) {
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    throw new Error('score must be an integer from 0 to ' + MAX_SCORE);
  }
  return score;
}

// Records one finished run. Returns { data, result }; the input data is not mutated.
export function submitScore(data, rawName, rawScore, now) {
  const { id, name } = normalizeName(rawName);
  const score = validateScore(rawScore);
  const prev = Object.prototype.hasOwnProperty.call(data.players, id) ? data.players[id] : null;
  const previousBest = prev ? prev.bestScore : null;
  const isNewBest = prev === null || score > prev.bestScore;

  const player = {
    name, // latest spelling wins
    bestScore: isNewBest ? score : prev.bestScore,
    bestAt: isNewBest ? now : prev.bestAt,
    runs: (prev ? prev.runs : 0) + 1,
    totalScore: (prev ? prev.totalScore : 0) + score,
    achievements: { ...(prev ? prev.achievements : {}) },
  };
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (!player.achievements[a.id] && a.check(player, { score })) {
      player.achievements[a.id] = now;
      unlocked.push(publicAchievement(a));
    }
  }

  // A computed key always creates an own property, so even an id like "__proto__" is stored as data.
  const next = { ...data, players: { ...data.players, [id]: player } };
  const standing = rankOf(next, id);
  return {
    data: next,
    result: {
      player: name,
      score,
      previousBest,
      isNewBest,
      bestScore: player.bestScore,
      rank: standing.rank,
      totalPlayers: standing.totalPlayers,
      unlockedAchievements: unlocked,
    },
  };
}

// Sorted by best score (high first); ties go to whoever reached it first, then by name.
function sortedPlayers(data) {
  return Object.entries(data.players).sort(([, a], [, b]) =>
    b.bestScore - a.bestScore || a.bestAt.localeCompare(b.bestAt) || a.name.localeCompare(b.name)
  );
}

// Standard competition ranking: equal best scores share a rank (1, 2, 2, 4).
function withRanks(data) {
  const list = sortedPlayers(data);
  let rank = 0;
  return list.map(([id, p], i) => {
    if (i === 0 || p.bestScore !== list[i - 1][1].bestScore) rank = i + 1;
    return { id, rank, player: p };
  });
}

function rankOf(data, id) {
  const ranked = withRanks(data);
  const entry = ranked.find((r) => r.id === id);
  return { rank: entry ? entry.rank : null, totalPlayers: ranked.length };
}

export function getLeaderboard(data, limit = 10) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('limit must be an integer from 1 to 100');
  const ranked = withRanks(data);
  return {
    totalPlayers: ranked.length,
    entries: ranked.slice(0, limit).map(({ rank, player: p }) => ({
      rank,
      player: p.name,
      bestScore: p.bestScore,
      runs: p.runs,
      achievements: Object.keys(p.achievements).length,
    })),
  };
}

export function getPlayer(data, rawName) {
  const { id } = normalizeName(rawName);
  if (!Object.prototype.hasOwnProperty.call(data.players, id)) throw new Error('unknown player: ' + rawName);
  const p = data.players[id];
  const { rank, totalPlayers } = rankOf(data, id);
  return {
    player: p.name,
    rank,
    totalPlayers,
    bestScore: p.bestScore,
    bestAt: p.bestAt,
    runs: p.runs,
    totalScore: p.totalScore,
    averageScore: Math.round((p.totalScore / p.runs) * 10) / 10,
    achievements: ACHIEVEMENTS.map((a) => ({
      ...publicAchievement(a),
      unlockedAt: p.achievements[a.id] || null,
    })),
  };
}

export function listAchievements(data) {
  const players = Object.values(data.players);
  return ACHIEVEMENTS.map((a) => ({
    ...publicAchievement(a),
    unlockedBy: players.filter((p) => p.achievements[a.id]).length,
  }));
}

function publicAchievement(a) {
  return { id: a.id, name: a.name, description: a.description };
}
