// Validates: Requirements 1.6
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);
const { renderConfigScript, JSON_PATH, OUT_PATH } = require('../../scripts/sync-config.js');

describe('generated config parity', () => {
  it('GAME_CONFIG deep-equals the parsed game-config.json', () => {
    const parsed = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
    const generated = require('../../src/game-config.js');
    expect(generated.GAME_CONFIG).toEqual(parsed);
  });

  it('renderConfigScript reproduces src/game-config.js byte for byte', () => {
    const raw = fs.readFileSync(JSON_PATH, 'utf8');
    const onDisk = fs.readFileSync(OUT_PATH, 'utf8');
    expect(renderConfigScript(JSON.parse(raw))).toBe(onDisk);
    expect(renderConfigScript(raw)).toBe(onDisk);
  });
});
