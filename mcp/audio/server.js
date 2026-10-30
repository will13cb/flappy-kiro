// Flappy Kiro audio MCP server (stdio). Renders sound effects and music presets to WAV files in
// AUDIO_OUT_DIR (default assets/generated), which must be inside the project.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createMcpServer } from '../lib/stdio-server.js';
import { PRESETS, renderPreset } from './synth.js';
import { encodeWav, peakDbfs } from './wav.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,40}\.wav$/;

export function resolveOutDir(dir) {
  const out = path.resolve(ROOT, dir || 'assets/generated');
  if (out !== ROOT && !out.startsWith(ROOT + path.sep)) throw new Error('output directory must be inside the project');
  return out;
}

export function createAudioServer({ outDir }) {
  const tools = [
    {
      name: 'list_presets',
      description: 'Sound presets this server can render: flap, score, hit, menu music and game music.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: () =>
        Object.entries(PRESETS).map(([preset, p]) => ({
          preset, kind: p.kind, description: p.description, defaultFile: p.file, defaultSeed: p.seed,
        })),
    },
    {
      name: 'generate_sound',
      description: 'Render a preset to a 16-bit mono WAV in the generated-audio folder. A different seed gives a variation (new melody for music, new noise for effects).',
      inputSchema: {
        type: 'object',
        properties: {
          preset: { type: 'string', enum: Object.keys(PRESETS) },
          seed: { type: 'integer', minimum: 0, maximum: 4294967295 },
          file: { type: 'string', description: 'Output file name such as flap-2.wav (lowercase letters, digits, _ and -). Defaults to the preset file name.' },
        },
        required: ['preset'],
        additionalProperties: false,
      },
      handler: ({ preset, seed, file }) => {
        const name = file === undefined ? PRESETS[preset] && PRESETS[preset].file : file;
        const { samples, sampleRate } = renderPreset(preset, seed);
        if (!FILE_PATTERN.test(name)) throw new Error('file must match ' + FILE_PATTERN);
        const bytes = encodeWav(samples, sampleRate);
        fs.mkdirSync(outDir, { recursive: true });
        const target = path.join(outDir, name);
        fs.writeFileSync(target, bytes);
        return {
          file: path.relative(ROOT, target),
          preset,
          seed: seed === undefined ? PRESETS[preset].seed : seed,
          durationS: Math.round((samples.length / sampleRate) * 1000) / 1000,
          sampleRate,
          bytes: bytes.length,
          peakDbfs: Math.round(peakDbfs(samples) * 10) / 10,
        };
      },
    },
  ];
  return createMcpServer({ name: 'flappy-kiro-audio', version: '1.0.0', tools });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outDir = resolveOutDir(process.env.AUDIO_OUT_DIR);
  createAudioServer({ outDir }).listen();
  process.stderr.write('flappy-kiro-audio: writing to ' + outDir + '\n');
}
