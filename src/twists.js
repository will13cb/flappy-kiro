// World twists: Forest wind gusts and Castle moving gaps. Pure; randomness only via rng.
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// Wind cycles calm -> telegraph -> gust -> calm. The direction (+1 down, -1 up) is drawn when
// the telegraph starts, so the cue always shows it ~1 s ahead. The force ramps in and out
// over WIND_RAMP_MS, so it is never a step. With WIND_FORCE 0 the wind stays calm.
function initialWind() {
  return { phase: 'calm', timerMs: 0, dir: 1, force: 0 };
}

function stepWind(cfg, wind, dtMs, rng) {
  const t = cfg.twist;
  if (!(t.WIND_FORCE > 0)) return wind.phase === 'calm' && wind.force === 0 ? wind : initialWind();
  let { phase, timerMs, dir } = wind;
  timerMs += dtMs;
  if (phase === 'calm' && timerMs >= t.WIND_CALM_MS) {
    phase = 'telegraph';
    timerMs = 0;
    dir = rng() < 0.5 ? -1 : 1;
  } else if (phase === 'telegraph' && timerMs >= t.WIND_TELEGRAPH_MS) {
    phase = 'gust';
    timerMs = 0;
  } else if (phase === 'gust' && timerMs >= t.WIND_GUST_MS) {
    phase = 'calm';
    timerMs = 0;
  }
  let force = 0;
  if (phase === 'gust') {
    const ramp = Math.min(timerMs, t.WIND_GUST_MS - timerMs) / t.WIND_RAMP_MS;
    force = dir * t.WIND_FORCE * smooth(ramp);
  }
  return { phase, timerMs, dir, force };
}

// Moving gaps: the base center is kept away from the edges by the amplitude, so the sliding
// center never leaves [GAP_CENTER_MIN, GAP_CENTER_MAX]. The sine starts at 0 (no jump on spawn).
function initPair(cfg, pair) {
  const a = cfg.twist.GAP_AMPLITUDE;
  if (!(a > 0)) return pair;
  const lo = cfg.pipes.GAP_CENTER_MIN + a;
  const hi = cfg.pipes.GAP_CENTER_MAX - a;
  const baseCenter = Math.min(hi, Math.max(lo, pair.gapCenter));
  return Object.assign({}, pair, { baseCenter, gapCenter: baseCenter, ageMs: 0 });
}

function slideGaps(cfg, pairs, dtMs) {
  const a = cfg.twist.GAP_AMPLITUDE;
  const periodMs = cfg.twist.GAP_PERIOD_S * 1000;
  return pairs.map((p) => {
    if (p.baseCenter === undefined || !(a > 0)) return p;
    const ageMs = p.ageMs + dtMs;
    const gapCenter = p.baseCenter + a * Math.sin((2 * Math.PI * ageMs) / periodMs);
    return Object.assign({}, p, { ageMs, gapCenter });
  });
}

export { initialWind, stepWind, initPair, slideGaps };
