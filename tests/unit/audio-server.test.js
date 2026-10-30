// End-to-end: spawns the real audio MCP server, writing into a throwaway folder inside the project.
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, startMcpServer } from '../helpers/mcp-client.js';
import { resolveOutDir } from '../../mcp/audio/server.js';

const DIR = path.join('tests', '.tmp-audio-' + process.pid);
afterAll(() => fs.rmSync(path.join(ROOT, DIR), { recursive: true, force: true }));

describe('audio MCP server', () => {
  it('lists presets and writes WAV files inside its output folder only', async () => {
    const s = startMcpServer('mcp/audio/server.js', { AUDIO_OUT_DIR: DIR });
    const init = await s.request('initialize', { protocolVersion: '2024-11-05' });
    expect(init.result.serverInfo.name).toBe('flappy-kiro-audio');

    const presets = await s.call('list_presets', {});
    expect(presets.data.map((p) => p.preset)).toEqual(['flap', 'score', 'hit', 'game_over', 'wind', 'music_menu', 'music_sky', 'music_forest', 'music_castle', 'music_space']);

    const flap = await s.call('generate_sound', { preset: 'flap' });
    expect(flap.data).toMatchObject({ file: path.join(DIR, 'flap.wav'), durationS: 0.12, sampleRate: 44100 });
    expect(fs.readFileSync(path.join(ROOT, flap.data.file)).toString('ascii', 0, 4)).toBe('RIFF');

    const variant = await s.call('generate_sound', { preset: 'music_castle', seed: 42, file: 'game-42.wav' });
    expect(variant.data).toMatchObject({ seed: 42, file: path.join(DIR, 'game-42.wav') });

    for (const file of ['../escape.wav', 'a/b.wav', 'UPPER.wav', 'x.mp3']) {
      const bad = await s.call('generate_sound', { preset: 'flap', file });
      expect(bad.isError).toBe(true);
    }
    expect((await s.call('generate_sound', { preset: 'nope' })).isError).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'tests', 'escape.wav'))).toBe(false);
    s.stop();
  }, 20000);

  it('refuses an output folder outside the project', () => {
    expect(() => resolveOutDir('../outside')).toThrow(/inside the project/);
    expect(() => resolveOutDir('/tmp')).toThrow(/inside the project/);
    expect(resolveOutDir()).toBe(path.join(ROOT, 'assets', 'generated'));
  });
});
