// Medals for how far a run got: one per world reached, from POINTS_PER_WORLD (P). Pure.
const MEDAL_ORDER = ['bronze', 'silver', 'gold', 'platinum'];

// null below 1×P; bronze at 1×P, silver 2×P, gold 3×P, platinum 4×P and above.
function medalFor(score, P) {
  const n = Math.min(MEDAL_ORDER.length, Math.floor(Math.max(0, score) / P));
  return n === 0 ? null : MEDAL_ORDER[n - 1];
}

const rank = (m) => (m === null ? 0 : MEDAL_ORDER.indexOf(m) + 1);
const betterMedal = (a, b) => (rank(b) > rank(a) ? b : a);
const isMedal = (m) => MEDAL_ORDER.includes(m);

export { MEDAL_ORDER, medalFor, betterMedal, isMedal, rank as medalRank };
