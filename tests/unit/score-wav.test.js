import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { buildScoreWav, SAMPLE_RATE, DURATION_S } from '../../scripts/generate-score-wav.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ASSETS = path.join(ROOT, 'assets');

/** Reads fmt and data info from a WAV buffer by walking its chunks. */
function parseWav(buf) {
  const info = { fmt: null, dataOffset: -1, dataSize: 0 };
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') {
      info.fmt = {
        format: buf.readUInt16LE(pos + 8),
        channels: buf.readUInt16LE(pos + 10),
        sampleRate: buf.readUInt32LE(pos + 12),
        byteRate: buf.readUInt32LE(pos + 16),
        blockAlign: buf.readUInt16LE(pos + 20),
        bits: buf.readUInt16LE(pos + 22)
      };
    } else if (id === 'data') {
      info.dataOffset = pos + 8;
      info.dataSize = Math.min(size, buf.length - (pos + 8));
      break;
    }
    pos += 8 + size + (size % 2);
  }
  return info;
}

describe('generated score WAV', () => {
  const wav = buildScoreWav();
  const info = parseWav(wav);

  it('has a RIFF/WAVE header with consistent sizes', () => {
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    expect(wav.readUInt32LE(4)).toBe(wav.length - 8);
    expect(info.dataOffset).toBeGreaterThan(0);
    expect(info.dataSize).toBe(wav.length - info.dataOffset);
  });

  it('is 16-bit mono PCM at the exported sample rate', () => {
    expect(info.fmt).toEqual({
      format: 1,
      channels: 1,
      sampleRate: SAMPLE_RATE,
      byteRate: SAMPLE_RATE * 2,
      blockAlign: 2,
      bits: 16
    });
  });

  it('lasts about 0.2 s', () => {
    const seconds = info.dataSize / info.fmt.blockAlign / info.fmt.sampleRate;
    expect(DURATION_S).toBeCloseTo(0.2, 5);
    expect(seconds).toBeGreaterThan(0.18);
    expect(seconds).toBeLessThan(0.22);
  });

  it('has non-silent samples within range near -14 dBFS', () => {
    let peak = 0;
    for (let i = 0; i < info.dataSize; i += 2) {
      peak = Math.max(peak, Math.abs(wav.readInt16LE(info.dataOffset + i)));
    }
    const dbfs = 20 * Math.log10(peak / 32768);
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(32767);
    expect(dbfs).toBeGreaterThan(-15);
    expect(dbfs).toBeLessThan(-13);
  });

  it('ends at silence', () => {
    const last = wav.readInt16LE(wav.length - 2);
    expect(Math.abs(last)).toBeLessThan(50);
  });

  it('is deterministic', () => {
    expect(buildScoreWav().equals(wav)).toBe(true);
  });
});

describe('assets/score.wav', () => {
  it('exists and matches the generator output', () => {
    const file = path.join(ASSETS, 'score.wav');
    expect(fs.existsSync(file)).toBe(true);
    const onDisk = fs.readFileSync(file);
    expect(onDisk.toString('ascii', 0, 4)).toBe('RIFF');
    expect(onDisk.equals(buildScoreWav())).toBe(true);
  });
});

describe('existing sounds are valid and short', () => {
  // jump.wav and game_over.wav are provided recordings (game_over is a spoken "game over"),
  // so they are not trimmed to the audio-assets.md targets; only sanity-check them.
  for (const name of ['jump.wav', 'game_over.wav']) {
    it(`${name} is a readable WAV under 3 s`, () => {
      const { fmt, dataSize } = parseWav(fs.readFileSync(path.join(ASSETS, name)));
      const seconds = dataSize / fmt.blockAlign / fmt.sampleRate;
      expect(seconds).toBeGreaterThan(0);
      expect(seconds).toBeLessThan(3);
    });
  }
});
