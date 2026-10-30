// Writes the generated game audio: assets/score.wav, assets/music-menu.wav, assets/music-game.wav.
// jump.wav and game_over.wav are provided recordings and are never touched.
// Run with: npm run generate-audio
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRESETS, renderPresetWav } from '../mcp/audio/synth.js';

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');
for (const name of ['score', 'music_menu', 'music_game']) {
  const out = path.join(ASSETS, PRESETS[name].file);
  const bytes = renderPresetWav(name);
  fs.writeFileSync(out, bytes);
  console.log(`Wrote assets/${PRESETS[name].file} (${bytes.length} bytes)`);
}
