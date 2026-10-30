import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PRESETS, SHIPPED_PRESETS, renderPreset, renderPresetWav, buildScoreWav } from '../../mcp/audio/synth.js';
import { encodeWav, peakDbfs } from '../../mcp/audio/wav.js';
import { ROOT } from '../helpers/mcp-client.js';

const duration = ({ samples, sampleRate }) => samples.length / sampleRate;

describe('synth presets', () => {
  it('render the expected lengths and stay under full scale', { timeout: 30000 }, () => {
    const bars = (bpm) => (8 * 4 * 60) / bpm;
    const expected = {
      flap: 0.12, score: 0.2, hit: 0.35, game_over: 0.9, wind: 10,
      music_menu: bars(96), music_sky: bars(108), music_forest: bars(92), music_castle: bars(84), music_space: bars(76),
    };
    for (const name of Object.keys(PRESETS)) {
      const r = renderPreset(name);
      expect(duration(r)).toBeCloseTo(expected[name], 2);
      expect(peakDbfs(r.samples)).toBeLessThan(-7);
      expect(peakDbfs(r.samples)).toBeGreaterThan(-20);
    }
  });

  it('are deterministic per seed and vary with the seed', { timeout: 30000 }, () => {
    expect(renderPresetWav('music_sky', 3).equals(renderPresetWav('music_sky', 3))).toBe(true);
    expect(renderPresetWav('music_sky', 3).equals(renderPresetWav('music_sky', 4))).toBe(false);
    expect(renderPresetWav('hit', 1).equals(renderPresetWav('hit', 2))).toBe(false);
  });

  it('end at silence so effects do not click and music loops cleanly', { timeout: 30000 }, () => {
    for (const name of Object.keys(PRESETS)) {
      const { samples } = renderPreset(name);
      expect(Math.abs(samples[samples.length - 1])).toBeLessThan(1e-3);
      expect(Math.abs(samples[0])).toBeLessThan(0.05);
    }
  });

  it('match the committed generated files', { timeout: 30000 }, () => {
    for (const name of SHIPPED_PRESETS) {
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
