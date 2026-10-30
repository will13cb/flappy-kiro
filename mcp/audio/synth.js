// Procedural chiptune sound synthesis for Flappy Kiro. Deterministic: same preset and seed, same samples.
// Every preset returns { samples: Float64Array in [-1, 1], sampleRate }.
import { encodeWav } from './wav.js';

const SFX_RATE = 44100;
const MUSIC_RATE = 22050; // music is long; half rate keeps files small and suits square waves
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

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const square = (p, duty) => ((p / TAU) % 1 < duty ? 1 : -1);
const triangle = (p) => 1 - 4 * Math.abs(((p / TAU) % 1) - 0.5);

// One looping track. Its length is an exact number of bars and every note's envelope reaches 0
// before the note ends, so the end joins the start without a click.
function track({ bpm, chords, scale, leadSteps, leadDuty, hats }, rng) {
  const sr = MUSIC_RATE;
  const beat = 60 / bpm;
  const n = Math.round(chords.length * 4 * beat * sr);
  const out = new Float64Array(n);

  function note(startS, lenS, hz, gain, wave) {
    const i0 = Math.round(startS * sr);
    const len = Math.round(lenS * sr);
    const attack = Math.round(0.005 * sr);
    const release = Math.min(Math.round(0.04 * sr), len >> 1);
    let phase = 0;
    for (let k = 0; k < len && i0 + k < n; k++) {
      phase += (TAU * hz) / sr;
      out[i0 + k] += wave(phase) * Math.min(1, k / attack, (len - k) / release) * gain;
    }
  }

  // Bass: the chord root on each beat, the fifth on beat 3 (triangle wave).
  chords.forEach((root, bar) => {
    for (let b = 0; b < 4; b++) {
      note((bar * 4 + b) * beat, beat * 0.9, midiHz(root - 24 + (b === 2 ? 7 : 0)), 0.55, triangle);
    }
  });

  // Lead: a seeded walk over two octaves of the scale, restarting on the chord root each bar, with rests.
  const stepLen = (4 * beat) / leadSteps;
  chords.forEach((root, bar) => {
    let degree = Math.max(0, scale.indexOf(root % 12));
    for (let k = 0; k < leadSteps; k++) {
      if (k > 0) {
        const r = rng();
        const move = r < 0.4 ? -1 : r < 0.8 ? 1 : r < 0.9 ? 2 : -2;
        degree = Math.max(0, Math.min(scale.length * 2 - 1, degree + move));
        if (rng() < 0.18) continue; // rest
      }
      const m = 72 + scale[degree % scale.length] + 12 * Math.floor(degree / scale.length);
      note(bar * 4 * beat + k * stepLen, stepLen * 0.85, midiHz(m), 0.32, (p) => square(p, leadDuty));
    }
  });

  // Hi-hats: short noise ticks on the off-beats.
  if (hats) {
    for (let b = 0; b < chords.length * 4; b++) {
      const i0 = Math.round((b + 0.5) * beat * sr);
      const len = Math.round(0.03 * sr);
      for (let k = 0; k < len && i0 + k < n; k++) out[i0 + k] += (rng() * 2 - 1) * 0.18 * (1 - k / len);
    }
  }
  return { samples: normalize(out, -16), sampleRate: sr };
}

// Menu: calm and floaty. C - Am - F - G twice at 92 bpm, quarter-note lead, no drums.
const musicMenu = (rng) =>
  track({ bpm: 92, chords: [60, 57, 53, 55, 60, 57, 53, 55], scale: [0, 2, 4, 7, 9], leadSteps: 4, leadDuty: 0.5, hats: false }, rng);

// Game: driving. Am - F - C - G twice at 140 bpm, eighth-note lead, off-beat hi-hats.
const musicGame = (rng) =>
  track({ bpm: 140, chords: [57, 53, 60, 55, 57, 53, 60, 55], scale: [9, 0, 2, 4, 7], leadSteps: 8, leadDuty: 0.25, hats: true }, rng);

export const PRESETS = {
  flap: { kind: 'sfx', description: 'Short upward whoosh for a flap', file: 'flap.wav', render: flap, seed: 1 },
  score: { kind: 'sfx', description: 'Two-tone chime when a wall pair is passed', file: 'score.wav', render: score, seed: 1 },
  hit: { kind: 'sfx', description: 'Low thud for a collision', file: 'hit.wav', render: hit, seed: 1 },
  music_menu: { kind: 'music', description: 'Calm looping title-screen music (92 bpm, about 21 s)', file: 'music-menu.wav', render: musicMenu, seed: 7 },
  music_game: { kind: 'music', description: 'Driving looping in-game music (140 bpm, about 14 s)', file: 'music-game.wav', render: musicGame, seed: 11 },
};

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
