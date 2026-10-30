// Procedural chiptune sound synthesis for Flappy Kiro. Deterministic: same preset and seed, same samples.
// Every preset returns { samples: Float64Array in [-1, 1], sampleRate }.
import { encodeWav } from './wav.js';

const SFX_RATE = 44100;
const MUSIC_RATE = 22050; // music is long; half rate keeps files small and suits soft sine tones
const TAU = 2 * Math.PI;
const db = (d) => Math.pow(10, d / 20);

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalize(samples, peakDb) {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  if (max === 0) return samples;
  const k = db(peakDb) / max;
  for (let i = 0; i < samples.length; i++) samples[i] *= k;
  return samples;
}

// Linear fade over the last fadeS seconds so every file ends at silence.
function fadeOut(samples, sampleRate, fadeS) {
  const n = Math.min(samples.length, Math.round(fadeS * sampleRate));
  for (let k = 0; k < n; k++) samples[samples.length - 1 - k] *= k / n;
  return samples;
}

// Score: two soft sine tones a major third apart (880 Hz, then 1108.73 Hz after 80 ms), 0.2 s, -14 dBFS.
// Kept byte-identical to the original assets/score.wav.
export const SCORE_DURATION_S = 0.2;
function score() {
  const total = Math.round(SFX_RATE * SCORE_DURATION_S);
  const tau = 0.15 / Math.log(1000);
  const samples = new Float64Array(total);
  for (const tone of [{ freq: 880, startS: 0 }, { freq: 880 * Math.pow(2, 4 / 12), startS: 0.08 }]) {
    for (let i = Math.round(tone.startS * SFX_RATE); i < total; i++) {
      const t = i / SFX_RATE - tone.startS;
      samples[i] += Math.sin(TAU * tone.freq * t) * Math.min(1, t / 0.005) * Math.exp(-t / tau);
    }
  }
  const fadeLen = Math.round(0.005 * SFX_RATE);
  for (let k = 0; k < fadeLen; k++) samples[total - 1 - k] *= k / fadeLen;
  // Same arithmetic order as the original generator, so the file bytes do not change.
  let max = 0;
  for (const v of samples) max = Math.max(max, Math.abs(v));
  for (let i = 0; i < total; i++) samples[i] = (samples[i] / max) * db(-14);
  return { samples, sampleRate: SFX_RATE };
}

// Flap: a short upward whoosh, a sine sweep 380 -> 900 Hz over soft noise, 0.12 s.
function flap(rng) {
  const dur = 0.12;
  const n = Math.round(SFX_RATE * dur);
  const s = new Float64Array(n);
  let phase = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SFX_RATE;
    const x = t / dur;
    phase += (TAU * (380 + 520 * x * x)) / SFX_RATE;
    lp += 0.25 * (rng() * 2 - 1 - lp); // one-pole low-pass keeps the noise soft
    const env = Math.min(1, t / 0.004) * Math.exp(-t / 0.035);
    s[i] = (0.7 * Math.sin(phase) + 0.5 * lp) * env;
  }
  return { samples: normalize(fadeOut(s, SFX_RATE, 0.01), -10), sampleRate: SFX_RATE };
}

// Hit: a low thud for collisions, a sine dropping 150 -> 45 Hz with a short noise crack, 0.35 s.
function hit(rng) {
  const dur = 0.35;
  const n = Math.round(SFX_RATE * dur);
  const s = new Float64Array(n);
  let phase = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SFX_RATE;
    phase += (TAU * (45 + 105 * Math.exp(-t / 0.06))) / SFX_RATE;
    lp += 0.35 * (rng() * 2 - 1 - lp);
    const body = Math.sin(phase) * Math.min(1, t / 0.002) * Math.exp(-t / 0.12);
    s[i] = body + 0.6 * lp * Math.exp(-t / 0.018);
  }
  return { samples: normalize(fadeOut(s, SFX_RATE, 0.02), -8), sampleRate: SFX_RATE };
}

// Game over: a soft low thud followed by two gentle falling sine notes (G4, then D4), 0.9 s.
// No noise crack and no voice: it marks the crash without startling the player.
function gameOver() {
  const n = Math.round(SFX_RATE * 0.9);
  const s = new Float64Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SFX_RATE;
    phase += (TAU * (50 + 70 * Math.exp(-t / 0.08))) / SFX_RATE;
    s[i] += Math.sin(phase) * Math.min(1, t / 0.004) * Math.exp(-t / 0.1);
  }
  [[392, 0.1], [293.66, 0.32]].forEach(([hz, startS]) => {
    for (let i = Math.round(startS * SFX_RATE); i < n; i++) {
      const t = i / SFX_RATE - startS;
      s[i] += 0.45 * (Math.sin(TAU * hz * t) + 0.15 * Math.sin(TAU * hz * 2 * t)) * Math.min(1, t / 0.02) * Math.exp(-t / 0.18);
    }
  });
  return { samples: normalize(fadeOut(s, SFX_RATE, 0.05), -12), sampleRate: SFX_RATE };
}

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const smooth = (x) => {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
};

// One soft voice: sine partials with a smooth attack and release, and an optional exponential
// decay for plucks. The release always reaches 0 before lenS, so no note can click.
function voice(out, sr, v) {
  const i0 = Math.round(v.startS * sr);
  const len = Math.min(Math.round(v.lenS * sr), out.length - i0);
  for (let k = 0; k < len; k++) {
    const t = k / sr;
    const env = smooth(t / v.attackS) * smooth((v.lenS - t) / v.releaseS) * (v.decayS ? Math.exp(-t / v.decayS) : 1);
    let s = 0;
    for (let p = 0; p < v.partials.length; p++) s += v.partials[p] * Math.sin(TAU * v.hz * (p + 1) * t);
    out[i0 + k] += s * env * v.gain;
  }
}

// Gentle one-pole low-pass: takes the edge off every partial.
function lowpass(buf, sr, cutoffHz) {
  const a = 1 - Math.exp((-TAU * cutoffHz) / sr);
  let y = 0;
  for (let i = 0; i < buf.length; i++) {
    y += a * (buf[i] - y);
    buf[i] = y;
  }
}

// Soft echo that wraps around the loop, so the tail of the last bar fades into the first.
function wrapEcho(buf, delaySamples, feedback) {
  const src = Float64Array.from(buf);
  for (let i = 0; i < buf.length; i++) buf[(i + delaySamples) % buf.length] += src[i] * feedback;
}

// ---- Themes -------------------------------------------------------------------------------------
// Every theme is 8 bars of 4/4 built from the same small kit (voices, plucks, a hand drum and a
// noise tick) but with its own tempo, key, rhythm and instruments, so each world sounds different.
// Everything is mixed quietly and low-passed. The length is an exact number of bars and the
// ends are faded, so the loop joins without a click.

const MAJOR = [0, 4, 7];
const MINOR = [0, 3, 7];

const INSTRUMENT = {
  marimba: { attackS: 0.003, releaseS: 0.05, decayS: 0.22, partials: [1, 0.05, 0.3] },
  bell: { attackS: 0.004, releaseS: 0.08, decayS: 0.4, partials: [1, 0.3, 0.1] },
  flute: { attackS: 0.07, releaseS: 0.2, decayS: 0, partials: [1, 0.1] },
  harpsichord: { attackS: 0.002, releaseS: 0.04, decayS: 0.22, partials: [1, 0.7, 0.45, 0.3, 0.15] },
  bass: { attackS: 0.006, releaseS: 0.08, decayS: 0.4, partials: [1, 0.45, 0.15] },
  sub: { attackS: 0.04, releaseS: 0.15, decayS: 0, partials: [1, 0.25] },
  blip: { attackS: 0.003, releaseS: 0.04, decayS: 0.1, partials: [1, 0.45, 0.15] },
  ping: { attackS: 0.01, releaseS: 0.6, decayS: 1.1, partials: [1, 0.25] },
};

// Plays a note at a position in beats; lenBeats is cut off at the end of the loop.
function note(c, beatPos, midi, lenBeats, gain, inst) {
  const startS = beatPos * c.beat;
  if (startS >= c.totalS) return;
  voice(c.out, c.sr, { ...inst, startS, lenS: Math.min(lenBeats * c.beat, c.totalS - startS), hz: midiHz(midi), gain });
}

// Soft pad for one bar: each chord tone twice, a hair apart, so it breathes. Bars overlap by half.
function padBar(c, bar, rootMidi, tones, gain, partials) {
  const overlap = c.barS * 0.5;
  const startS = Math.max(0, bar * c.barS - overlap / 2);
  const endS = Math.min(c.totalS, (bar + 1) * c.barS + overlap / 2);
  const base = { startS, lenS: endS - startS, attackS: c.barS * 0.4, releaseS: c.barS * 0.4, partials: partials || [1] };
  tones.forEach((tone, i) => {
    const hz = midiHz(rootMidi + tone);
    voice(c.out, c.sr, { ...base, hz, gain });
    voice(c.out, c.sr, { ...base, hz: hz + 0.25 + i * 0.07, gain: gain * 0.6 });
  });
}

// Hand drum or kick: a sine that falls from f0 to f1.
function thump(c, beatPos, gain, f0 = 110, f1 = 45, decayS = 0.07) {
  const i0 = Math.round(beatPos * c.beat * c.sr);
  const n = Math.min(Math.round(decayS * 5 * c.sr), c.out.length - i0);
  let phase = 0;
  for (let k = 0; k < n; k++) {
    const t = k / c.sr;
    phase += (TAU * (f1 + (f0 - f1) * Math.exp(-t / 0.03))) / c.sr;
    c.out[i0 + k] += Math.sin(phase) * smooth(t / 0.002) * Math.exp(-t / decayS) * smooth((n - k) / (0.01 * c.sr)) * gain;
  }
}

// Short burst of high-passed noise: a shaker, a tap or a soft snare.
function tick(c, beatPos, gain, lenS, bright) {
  const i0 = Math.round(beatPos * c.beat * c.sr);
  const n = Math.min(Math.round(lenS * c.sr), c.out.length - i0);
  let lp = 0;
  for (let k = 0; k < n; k++) {
    const x = c.rng() * 2 - 1;
    lp += bright * (x - lp);
    c.out[i0 + k] += (x - lp) * (1 - k / n) * gain;
  }
}

// Plucked string (Karplus-Strong): a short noise burst that rings and fades like a guitar.
function guitar(c, beatPos, midi, gain) {
  const i0 = Math.round(beatPos * c.beat * c.sr);
  const period = Math.max(2, Math.round(c.sr / midiHz(midi)));
  const ring = Math.min(Math.round(0.9 * c.sr), c.out.length - i0);
  const buf = new Float64Array(period);
  for (let i = 0; i < period; i++) buf[i] = c.rng() * 2 - 1;
  const fade = Math.round(0.04 * c.sr);
  for (let k = 0; k < ring; k++) {
    const idx = k % period;
    const v = buf[idx];
    buf[idx] = 0.5 * (v + buf[(idx + 1) % period]) * 0.997;
    c.out[i0 + k] += v * gain * Math.min(1, (ring - k) / fade);
  }
}

// Builds one theme. build(c) writes the parts; then the mix is low-passed, echoed and normalised.
// echo: [[delay in beats, feedback], ...] taps that wrap around the loop.
function track({ bpm, bars, cutoff, echo, build }, rng) {
  const sr = MUSIC_RATE;
  const beat = 60 / bpm;
  const totalS = bars * 4 * beat;
  const out = new Float64Array(Math.round(totalS * sr));
  build({ sr, out, beat, barS: 4 * beat, totalS, rng });
  lowpass(out, sr, cutoff);
  echo.forEach(([beats, feedback]) => wrapEcho(out, Math.round(beats * beat * sr), feedback));
  fadeOut(out, sr, 0.08);
  for (let i = 0; i < 0.08 * sr; i++) out[i] *= i / (0.08 * sr);
  return { samples: normalize(out, -16), sampleRate: sr };
}

// Plays rows of 8 eighth-note slots (0 = rest), one row per bar.
function melody(c, rows, gain, inst, lenBeats) {
  rows.forEach((row, bar) => row.forEach((midi, slot) => {
    if (midi) note(c, bar * 4 + slot * 0.5, midi, lenBeats, gain, inst);
  }));
}

// Menu: friendly and bouncy. C - Am - F - G, a marimba tune, a walking bass and a light pulse. 96 bpm.
const musicMenu = (rng) => track({
  bpm: 96, bars: 8, cutoff: 3000, echo: [[1.5, 0.2]],
  build(c) {
    const roots = [48, 45, 41, 43, 48, 45, 41, 43];
    const kinds = [MAJOR, MINOR, MAJOR, MAJOR, MAJOR, MINOR, MAJOR, MAJOR];
    roots.forEach((r, bar) => {
      padBar(c, bar, r + 12, kinds[bar], 0.14);
      [0, 1, 2, 3].forEach((b) => note(c, bar * 4 + b, r + (b === 2 ? 7 : b === 3 ? 12 : 0), 0.9, 0.5, INSTRUMENT.bass));
      thump(c, bar * 4, 0.4);
      thump(c, bar * 4 + 2, 0.3);
      tick(c, bar * 4 + 1, 0.12, 0.05, 0.4);
      tick(c, bar * 4 + 3, 0.12, 0.05, 0.4);
    });
    melody(c, [
      [76, 0, 79, 0, 84, 0, 79, 76], [76, 0, 81, 0, 79, 0, 76, 0],
      [77, 0, 81, 0, 84, 0, 81, 77], [79, 0, 83, 0, 86, 79, 0, 0],
      [84, 0, 79, 76, 79, 0, 84, 0], [81, 0, 76, 0, 72, 0, 76, 81],
      [77, 0, 81, 77, 84, 0, 81, 0], [79, 74, 79, 83, 86, 0, 83, 0],
    ], 0.34, INSTRUMENT.marimba, 1);
  },
}, rng);

// Sky: breezy and bright. C - G - Am - F, a rolling bell arpeggio, a flute line and a soft shaker. 108 bpm.
const musicSky = (rng) => track({
  bpm: 108, bars: 8, cutoff: 3400, echo: [[0.75, 0.3]],
  build(c) {
    const roots = [48, 43, 45, 41, 48, 43, 45, 41];
    const kinds = [MAJOR, MAJOR, MINOR, MAJOR, MAJOR, MAJOR, MINOR, MAJOR];
    const lead = [[84, 79], [83, 79], [81, 84], [81, 77], [84, 88], [86, 83], [84, 81], [79, 81]];
    const order = [0, 1, 2, 3, 2, 1, 2, 1];
    roots.forEach((r, bar) => {
      const tones = [kinds[bar][0], kinds[bar][1], kinds[bar][2], 12];
      padBar(c, bar, r + 12, kinds[bar], 0.12);
      order.forEach((idx, i) => note(c, bar * 4 + i * 0.5, r + 24 + tones[idx], 0.8, 0.26, INSTRUMENT.bell));
      note(c, bar * 4, r, 1.8, 0.5, INSTRUMENT.bass);
      note(c, bar * 4 + 2, r + 7, 1.8, 0.45, INSTRUMENT.bass);
      note(c, bar * 4, lead[bar][0], 2, 0.3, INSTRUMENT.flute);
      note(c, bar * 4 + 2, lead[bar][1], 2, 0.3, INSTRUMENT.flute);
      thump(c, bar * 4, 0.3);
      thump(c, bar * 4 + 2, 0.22);
      for (let i = 0; i < 4; i++) tick(c, bar * 4 + i + 0.5, 0.1, 0.03, 0.7);
    });
  },
}, rng);

// Forest: folk. Dm - C - Bb - C, a fingerpicked guitar, a hand drum, a breathy flute. 92 bpm.
const musicForest = (rng) => track({
  bpm: 92, bars: 8, cutoff: 2600, echo: [[1, 0.22]],
  build(c) {
    const chords = [[50, 57, 62, 65], [48, 55, 60, 64], [46, 53, 58, 62], [48, 55, 60, 64]];
    const pick = [0, 2, 3, 2, 1, 2, 3, 2];
    const flute = [
      [[0, 74, 1.5], [2, 77, 1], [3, 76, 1]], [[0, 72, 2], [2, 76, 2]],
      [[0, 70, 1.5], [2, 74, 1], [3, 72, 1]], [[0, 72, 2], [2, 67, 2]],
      [[0, 77, 1.5], [2, 81, 1], [3, 79, 1]], [[0, 76, 2], [2, 72, 2]],
      [[0, 74, 1], [1, 72, 1], [2, 70, 2]], [[0, 72, 4]],
    ];
    for (let bar = 0; bar < 8; bar++) {
      const chord = chords[bar % 4];
      pick.forEach((idx, i) => guitar(c, bar * 4 + i * 0.5, chord[idx], 0.5));
      padBar(c, bar, chord[0] + 12, bar % 4 === 0 ? MINOR : MAJOR, 0.1);
      flute[bar].forEach(([b, midi, len]) => note(c, bar * 4 + b, midi, len, 0.3, INSTRUMENT.flute));
      thump(c, bar * 4, 0.7, 90, 55, 0.12);
      thump(c, bar * 4 + 2, 0.45, 90, 55, 0.12);
      thump(c, bar * 4 + 3.5, 0.35, 90, 55, 0.12);
    }
  },
}, rng);

// Castle: a stately march in A minor. Am - F - Dm - E, a harpsichord tune, a plucked bass, kick and snare. 84 bpm.
const musicCastle = (rng) => track({
  bpm: 84, bars: 8, cutoff: 2800, echo: [[1, 0.18]],
  build(c) {
    const roots = [45, 41, 38, 40, 45, 41, 38, 40];
    const kinds = [MINOR, MAJOR, MINOR, MAJOR, MINOR, MAJOR, MINOR, MAJOR];
    roots.forEach((r, bar) => {
      padBar(c, bar, r + 12, kinds[bar], 0.16, [1, 0.35, 0.15]);
      note(c, bar * 4, r, 1.6, 0.55, INSTRUMENT.bass);
      note(c, bar * 4 + 2, r + 7, 1.6, 0.5, INSTRUMENT.bass);
      thump(c, bar * 4, 0.6);
      thump(c, bar * 4 + 2, 0.5);
      tick(c, bar * 4 + 1, 0.3, 0.09, 0.35);
      tick(c, bar * 4 + 3, 0.3, 0.09, 0.35);
    });
    melody(c, [
      [81, 0, 0, 81, 84, 0, 83, 81], [77, 0, 0, 77, 81, 0, 79, 77],
      [74, 0, 0, 74, 77, 0, 76, 74], [76, 0, 0, 76, 80, 0, 83, 80],
      [84, 0, 0, 84, 88, 0, 86, 84], [81, 0, 0, 77, 79, 0, 77, 81],
      [77, 0, 0, 74, 77, 0, 81, 77], [80, 0, 76, 0, 83, 0, 80, 0],
    ], 0.3, INSTRUMENT.harpsichord, 0.7);
  },
}, rng);

// Space: a slow synth groove. Em - C - D - D, a 16th-note arpeggio, a sub bass, pings and a deep echo. 76 bpm.
const musicSpace = (rng) => track({
  bpm: 76, bars: 8, cutoff: 3200, echo: [[0.75, 0.42], [1.5, 0.28]],
  build(c) {
    const roots = [40, 36, 43, 38, 40, 36, 43, 38];
    const kinds = [MINOR, MAJOR, MAJOR, MAJOR, MINOR, MAJOR, MAJOR, MAJOR];
    const pings = [0, 91, 0, 90, 0, 88, 0, 93];
    const order = [0, 1, 2, 3, 2, 1, 2, 3, 1, 2, 3, 2, 3, 2, 1, 2];
    roots.forEach((r, bar) => {
      const tones = [kinds[bar][0], kinds[bar][1], kinds[bar][2], 12];
      padBar(c, bar, r + 12, kinds[bar], 0.16);
      note(c, bar * 4, r, 4, 0.55, INSTRUMENT.sub);
      order.forEach((idx, i) => {
        if (i % 8 !== 7) note(c, bar * 4 + i * 0.25, r + 36 + tones[idx], 0.45, 0.2, INSTRUMENT.blip);
      });
      if (pings[bar]) note(c, bar * 4, pings[bar], 3.5, 0.22, INSTRUMENT.ping);
      thump(c, bar * 4, 0.35, 80, 40);
      thump(c, bar * 4 + 2, 0.25, 80, 40);
    });
  },
}, rng);

// Forest wind: low-passed noise that swells twice and falls to silence at both ends, so it loops
// without a click. A faint whistle rises and falls with each gust.
export const WIND_DURATION_S = 10;
function wind(rng) {
  const sr = MUSIC_RATE;
  const n = Math.round(WIND_DURATION_S * sr);
  const s = new Float64Array(n);
  let lp1 = 0;
  let lp2 = 0;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const swell = Math.pow(Math.sin((Math.PI * 2 * i) / n), 2); // two gusts per loop, 0 at both ends
    const a = 0.01 + 0.05 * swell; // a stronger gust is brighter
    lp1 += a * (rng() * 2 - 1 - lp1);
    lp2 += a * (lp1 - lp2);
    phase += (TAU * (380 + 160 * swell)) / sr;
    s[i] = (lp2 * 6 + Math.sin(phase) * 0.06 * swell * swell) * (0.15 + 0.85 * swell) * swell;
  }
  return { samples: normalize(fadeOut(s, sr, 0.05), -14), sampleRate: sr };
}

const barsS = (bpm) => Math.round((8 * 4 * 60) / bpm);
export const PRESETS = {
  flap: { kind: 'sfx', description: 'Short upward whoosh for a flap', file: 'flap.wav', render: flap, seed: 1 },
  score: { kind: 'sfx', description: 'Two-tone chime when a wall pair is passed', file: 'score.wav', render: score, seed: 1 },
  hit: { kind: 'sfx', description: 'Low thud for a collision', file: 'hit.wav', render: hit, seed: 1 },
  game_over: { kind: 'sfx', description: 'Soft thud and two gentle falling notes for a crash (0.9 s)', file: 'game_over.wav', render: gameOver, seed: 1 },
  wind: { kind: 'ambient', description: 'Looping forest wind with two soft gusts (10 s)', file: 'wind.wav', render: wind, seed: 5 },
  music_menu: { kind: 'music', description: `Friendly looping title-screen theme (96 bpm, about ${barsS(96)} s)`, file: 'music-menu.wav', render: musicMenu, seed: 7 },
  music_sky: { kind: 'music', description: `Breezy looping Sky theme (108 bpm, about ${barsS(108)} s)`, file: 'music-sky.wav', render: musicSky, seed: 11 },
  music_forest: { kind: 'music', description: `Folk-style looping Forest theme (92 bpm, about ${barsS(92)} s)`, file: 'music-forest.wav', render: musicForest, seed: 13 },
  music_castle: { kind: 'music', description: `Marching looping Castle theme (84 bpm, about ${barsS(84)} s)`, file: 'music-castle.wav', render: musicCastle, seed: 17 },
  music_space: { kind: 'music', description: `Slow synth looping Space theme (76 bpm, about ${barsS(76)} s)`, file: 'music-space.wav', render: musicSpace, seed: 19 },
};

// Presets whose rendered files ship in assets/ (jump.wav is a recording).
export const SHIPPED_PRESETS = ['score', 'game_over', 'wind', 'music_menu', 'music_sky', 'music_forest', 'music_castle', 'music_space'];

export function renderPreset(name, seed) {
  if (!Object.prototype.hasOwnProperty.call(PRESETS, name)) {
    throw new Error('unknown preset: ' + name + ' (known: ' + Object.keys(PRESETS).join(', ') + ')');
  }
  const s = seed === undefined ? PRESETS[name].seed : seed;
  if (!Number.isInteger(s) || s < 0 || s > 0xffffffff) throw new Error('seed must be an integer from 0 to 4294967295');
  return PRESETS[name].render(mulberry32(s));
}

export function renderPresetWav(name, seed) {
  const { samples, sampleRate } = renderPreset(name, seed);
  return encodeWav(samples, sampleRate);
}

// Bytes of assets/score.wav.
export const buildScoreWav = () => renderPresetWav('score');
export const SCORE_SAMPLE_RATE = SFX_RATE;
