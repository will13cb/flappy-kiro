// Ghosty skins, unlocked by the best medal ever earned. Pure.
import { medalRank } from './medals.js';

// unlock: medal needed (null = always). style: how the renderer draws the ghost and the trail.
const SKINS = [
  { id: 'classic', name: 'CLASSIC', unlock: null },
  { id: 'pumpkin', name: 'PUMPKIN', unlock: 'bronze' },
  { id: 'rainbow', name: 'RAINBOW TRAIL', unlock: 'silver' },
  { id: 'gold', name: 'GOLD', unlock: 'gold' },
  { id: 'starfield', name: 'STARFIELD', unlock: 'platinum' },
];

const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];
const isUnlocked = (id, bestMedal) => medalRank(bestMedal) >= medalRank(skinById(id).unlock);

// Steps through every skin (locked ones are shown) in dir (-1 or +1), wrapping around.
function cycleSkin(currentId, dir) {
  const i = SKINS.findIndex((s) => s.id === currentId);
  return SKINS[(Math.max(0, i) + dir + SKINS.length) % SKINS.length].id;
}

export { SKINS, skinById, isUnlocked, cycleSkin };
