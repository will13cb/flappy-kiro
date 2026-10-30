// Writes the generated game audio: the score chime, the game over sound, the forest wind loop and one theme per
// screen (menu, sky, forest, castle, space) into assets/.
// jump.wav is a provided recording and is never touched.
// Run with: npm run generate-audio
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRESETS, SHIPPED_PRESETS, renderPresetWav } from '../mcp/audio/synth.js';

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');
for (const name of SHIPPED_PRESETS) {
  const out = path.join(ASSETS, PRESETS[name].file);
  const bytes = renderPresetWav(name);
  fs.writeFileSync(out, bytes);
  console.log(`Wrote assets/${PRESETS[name].file} (${bytes.length} bytes)`);
}
