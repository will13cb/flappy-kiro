
// Generates assets/score.wav: a 16-bit mono PCM chime of about 0.2 s made of
// two soft sine tones a major third apart (880 Hz, then 1108.73 Hz after 80 ms),
// following audio-assets.md. Run with: npm run generate-score-wav

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SAMPLE_RATE = 44100;
export const DURATION_S = 0.2;
const PEAK = Math.pow(10, -14 / 20); // about -14 dBFS
const ATTACK_S = 0.005;
const FADE_OUT_S = 0.005; // short tail fade so the file ends at silence
const DECAY_S = 0.15; // time for each tone to decay to about -60 dB
const TONES = [
  { freq: 880, startS: 0 },
  { freq: 880 * Math.pow(2, 4 / 12), startS: 0.08 }, // major third above
];

/** Builds the sample values (floats in [-PEAK, PEAK]). */
function buildSamples() {
  const total = Math.round(SAMPLE_RATE * DURATION_S);
  const tau = DECAY_S / Math.log(1000);
  const samples = new Float64Array(total);
  for (const tone of TONES) {
    for (let i = Math.round(tone.startS * SAMPLE_RATE); i < total; i++) {
      const t = i / SAMPLE_RATE - tone.startS;
      const attack = Math.min(1, t / ATTACK_S);
      const decay = Math.exp(-t / tau);
      samples[i] += Math.sin(2 * Math.PI * tone.freq * t) * attack * decay;
    }
  }
  // Final fade out, then normalize to the target peak.
  const fadeLen = Math.round(FADE_OUT_S * SAMPLE_RATE);
  for (let k = 0; k < fadeLen; k++) samples[total - 1 - k] *= k / fadeLen;
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  for (let i = 0; i < total; i++) samples[i] = (samples[i] / max) * PEAK;
  return samples;
}

/** Returns the bytes of the WAV file as a Buffer. Pure: no file access. */
export function buildScoreWav() {
  const samples = buildSamples();
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(Math.round(samples[i] * 32767), 44 + i * 2);
  }
  return buf;
}


if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = path.join(__dirname, '..', 'assets', 'score.wav');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const bytes = buildScoreWav();
  fs.writeFileSync(out, bytes);
  console.log(`Wrote ${out} (${bytes.length} bytes)`);
}
