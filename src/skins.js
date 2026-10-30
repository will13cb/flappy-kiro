// Ghosty skins (body looks) and trails (what follows Ghosty), each unlocked by the best medal ever
// earned. The two are chosen independently. Pure.
import { medalRank } from './medals.js';

// unlock: medal needed (null = always). The renderer owns the colours.
const SKINS = [
  { id: 'classic', name: 'CLASSIC', unlock: null },
  { id: 'pumpkin', name: 'PUMPKIN', unlock: 'bronze' },
  { id: 'gold', name: 'GOLD', unlock: 'gold' },
  { id: 'starfield', name: 'STARFIELD', unlock: 'platinum' },
];

const TRAILS = [
  { id: 'soft', name: 'SOFT', unlock: null },
  { id: 'ember', name: 'EMBER', unlock: 'bronze' },
  { id: 'rainbow', name: 'RAINBOW', unlock: 'silver' },
  { id: 'stardust', name: 'STARDUST', unlock: 'gold' },
];

const byId = (list, id) => list.find((x) => x.id === id) || list[0];
const skinById = (id) => byId(SKINS, id);
const trailById = (id) => byId(TRAILS, id);
const unlockedIn = (list, id, bestMedal) => medalRank(bestMedal) >= medalRank(byId(list, id).unlock);
const isUnlocked = (id, bestMedal) => unlockedIn(SKINS, id, bestMedal);
const isTrailUnlocked = (id, bestMedal) => unlockedIn(TRAILS, id, bestMedal);

// Steps through every item (locked ones are shown) in dir (-1 or +1), wrapping around.
function cycle(list, currentId, dir) {
  const i = list.findIndex((x) => x.id === currentId);
  return list[(Math.max(0, i) + dir + list.length) % list.length].id;
}
const cycleSkin = (currentId, dir) => cycle(SKINS, currentId, dir);
const cycleTrail = (currentId, dir) => cycle(TRAILS, currentId, dir);

// The item dir steps away from currentId, for showing the previous and next choices.
const neighbour = (list, currentId, dir) => byId(list, cycle(list, currentId, dir));

export {
  SKINS, TRAILS, skinById, trailById, isUnlocked, isTrailUnlocked, cycleSkin, cycleTrail, neighbour,
};
