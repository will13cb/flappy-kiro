// Flappy Kiro asset loading. Each asset loads independently; a failure replaces only that asset.
//   sprite: ghosty.png  -> on failure null, and drawFallbackSprite draws a 24x24 white square
//   sheet:  optional ghosty-sheet.png -> on failure null, the renderer uses transforms of the sprite (silent)
//   sounds: jump / score / game_over -> on failure null (silence, see Audio_Player)
//   music: one theme per screen and world; ambient: the forest wind loop (same fallback)
// Browser APIs are injectable: deps = { createImage, createAudio }. Without them, globals are used if present.

const SPRITE_FILE = 'assets/ghosty.png';
const SOUND_FILES = {
  jump: 'assets/jump.wav',
  score: 'assets/score.wav',
  game_over: 'assets/game_over.wav',
};
const MUSIC_FILES = {
  menu: 'assets/music-menu.wav',
  sky: 'assets/music-sky.wav',
  forest: 'assets/music-forest.wav',
  castle: 'assets/music-castle.wav',
  space: 'assets/music-space.wav',
};
const AMBIENT_FILES = { wind: 'assets/wind.wav' };
const DEFAULT_SHEET_FILE = 'assets/ghosty-sheet.png';
const FALLBACK_SIZE = 24;

function defaultDeps() {
  return {
    createImage: typeof Image !== 'undefined' ? () => new Image() : null,
    createAudio: typeof Audio !== 'undefined' ? () => new Audio() : null,
  };
}

// Resolves with the loaded image, or null on any failure. Never rejects.
function loadImage(src, createImage) {
  return new Promise((resolve) => {
    try {
      const img = createImage();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    } catch (e) {
      resolve(null);
    }
  });
}

// Resolves with the audio element once it can play, or null on any failure. Never rejects.
function loadSound(src, createAudio) {
  return new Promise((resolve) => {
    try {
      const el = createAudio();
      const ok = () => resolve(el);
      if (typeof el.addEventListener === 'function') {
        el.addEventListener('canplaythrough', ok, { once: true });
        el.addEventListener('error', () => resolve(null), { once: true });
      } else {
        el.oncanplaythrough = ok;
        el.onerror = () => resolve(null);
      }
      el.preload = 'auto';
      el.src = src;
      if (typeof el.load === 'function') el.load();
    } catch (e) {
      resolve(null);
    }
  });
}

// Always resolves: { sprite, sheet, sounds: { jump, score, game_over }, music: { menu, sky, forest, castle, space },
// ambient: { wind } }
// with null for failed assets.
function loadAssets(cfg, deps) {
  const d = Object.assign(defaultDeps(), deps || {});
  const sheetFile = (cfg && cfg.animation && cfg.animation.SHEET_FILE) || DEFAULT_SHEET_FILE;
  const imageOrNull = (src) => (d.createImage ? loadImage(src, d.createImage) : Promise.resolve(null));
  const soundOrNull = (src) => (d.createAudio ? loadSound(src, d.createAudio) : Promise.resolve(null));
  const loadGroup = (files) => {
    const names = Object.keys(files);
    return Promise.all(names.map((n) => soundOrNull(files[n]))).then((els) => {
      const out = {};
      names.forEach((n, i) => { out[n] = els[i]; });
      return out;
    });
  };
  return Promise.all([
    imageOrNull(SPRITE_FILE),
    imageOrNull(sheetFile),
    loadGroup(SOUND_FILES),
    loadGroup(MUSIC_FILES),
    loadGroup(AMBIENT_FILES),
  ]).then(([sprite, sheet, sounds, music, ambient]) => ({ sprite, sheet, sounds, music, ambient }));
}

// Fallback sprite: white 24x24 square centered on (cx, cy).
function drawFallbackSprite(ctx, cx, cy) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - FALLBACK_SIZE / 2, cy - FALLBACK_SIZE / 2, FALLBACK_SIZE, FALLBACK_SIZE);
}

export { loadAssets, loadImage, loadSound, drawFallbackSprite, FALLBACK_SIZE };
