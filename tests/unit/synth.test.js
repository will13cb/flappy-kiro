import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PRESETS, renderPreset, renderPresetWav, buildScoreWav } from '../../mcp/audio/synth.js';
import { encodeWav, peakDbfs } from '../../mcp/audio/wav.js';
import { ROOT } from '../helpers/mcp-client.js';

const duration = ({ samples, sampleRate }) => samples.length / sampleRate;

describe('synth presets', () => {
  it('render the expected lengths and stay under full scale', () => {
    const expected = { flap: 0.12, score: 0.2, hit: 0.35, music_menu: (8 * 4 * 60) / 92, music_game: (8 * 4 * 60) / 140 };
    for (const name of Object.keys(PRESETS)) {
      const r = renderPreset(name);
      expect(duration(r)).toBeCloseTo(expected[name], 2);
      expect(peakDbfs(r.samples)).toBeLessThan(-7);
      expect(peakDbfs(r.samples)).toBeGreaterThan(-20);
    }
  });

  it('are deterministic per seed and vary with the seed', () => {
    expect(renderPresetWav('music_game', 3).equals(renderPresetWav('music_game', 3))).toBe(true);
    expect(renderPresetWav('music_game', 3).equals(renderPresetWav('music_game', 4))).toBe(false);
    expect(renderPresetWav('hit', 1).equals(renderPresetWav('hit', 2))).toBe(false);
  });

  it('end at silence so effects do not click and music loops cleanly', () => {
    for (const name of Object.keys(PRESETS)) {
      const { samples } = renderPreset(name);
      expect(Math.abs(samples[samples.length - 1])).toBeLessThan(1e-3);
      expect(Math.abs(samples[0])).toBeLessThan(0.05);
    }
  });

  it('match the committed generated files', () => {
    for (const name of ['score', 'music_menu', 'music_game']) {
      const onDisk = fs.readFileSync(path.join(ROOT, 'assets', PRESETS[name].file));
      expect(onDisk.equals(renderPresetWav(name))).toBe(true);
    }
    expect(buildScoreWav().equals(renderPresetWav('score'))).toBe(true);
  });

  it('reject unknown presets and bad seeds', () => {
    expect(() => renderPreset('laser')).toThrow(/unknown preset/);
    expect(() => renderPreset('__proto__')).toThrow(/unknown preset/);
    for (const bad of [-1, 1.5, 2 ** 32, '1']) expect(() => renderPreset('flap', bad)).toThrow(/seed/);
  });
});

describe('encodeWav', () => {
  it('writes a 16-bit mono PCM header and clamps out-of-range samples', () => {
    const buf = encodeWav(Float64Array.from([0, 2, -2]), 8000);
    expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
    expect(buf.readUInt32LE(24)).toBe(8000);
    expect(buf.readUInt16LE(34)).toBe(16);
    expect([buf.readInt16LE(44), buf.readInt16LE(46), buf.readInt16LE(48)]).toEqual([0, 32767, -32767]);
  });
});
