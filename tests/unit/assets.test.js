// Validates: Requirements 1.4, 1.5, 1.7, 19.6
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { loadAssets, loadImage, loadSound, drawFallbackSprite, FALLBACK_SIZE } = require('../../src/assets.js');

const SPRITE = 'assets/ghosty.png';
const SOUNDS = { jump: 'assets/jump.wav', score: 'assets/score.wav', game_over: 'assets/game_over.wav' };
const cfg = { animation: { SHEET_FILE: 'assets/ghosty-sheet.png' } };

// Fake image: fires onload or onerror (async) depending on whether src is in the failing set.
function fakeImageFactory(failing, created = []) {
  return () => {
    const img = {
      onload: null,
      onerror: null,
      set src(v) {
        this._src = v;
        created.push(v);
        setTimeout(() => (failing.has(v) ? this.onerror && this.onerror() : this.onload && this.onload()), 0);
      },
      get src() { return this._src; },
    };
    return img;
  };
}

// Fake audio using addEventListener.
function fakeAudioFactory(failing) {
  return () => {
    const listeners = {};
    return {
      addEventListener(type, fn) { listeners[type] = fn; },
      load() {
        setTimeout(() => {
          const type = failing.has(this._src) ? 'error' : 'canplaythrough';
          listeners[type] && listeners[type]();
        }, 0);
      },
      set src(v) { this._src = v; },
      get src() { return this._src; },
    };
  };
}

describe('loadAssets fallbacks over all 16 failure subsets', () => {
  const all = [SPRITE, SOUNDS.jump, SOUNDS.score, SOUNDS.game_over];
  for (let mask = 0; mask < 16; mask++) {
    const failed = all.filter((_, i) => mask & (1 << i));
    it(`fails only [${failed.join(', ')}]`, async () => {
      const failing = new Set(failed);
      const res = await loadAssets(cfg, {
        createImage: fakeImageFactory(failing),
        createAudio: fakeAudioFactory(failing),
      });
      expect(res.sprite === null).toBe(failing.has(SPRITE));
      for (const name of Object.keys(SOUNDS)) {
        expect(res.sounds[name] === null).toBe(failing.has(SOUNDS[name]));
      }
      expect(res.sheet).not.toBeNull();
      expect(Object.keys(res.sounds).sort()).toEqual(['game_over', 'jump', 'score']);
    });
  }
});

describe('sheet fallback', () => {
  it('uses cfg.animation.SHEET_FILE and yields null sheet when it is missing, leaving others intact', async () => {
    const created = [];
    const res = await loadAssets(cfg, {
      createImage: fakeImageFactory(new Set([cfg.animation.SHEET_FILE]), created),
      createAudio: fakeAudioFactory(new Set()),
    });
    expect(created).toContain('assets/ghosty-sheet.png');
    expect(res.sheet).toBeNull();
    expect(res.sprite).not.toBeNull();
    expect(res.sounds.jump).not.toBeNull();
  });

  it('honors a custom sheet path', async () => {
    const created = [];
    await loadAssets({ animation: { SHEET_FILE: 'assets/custom.png' } }, {
      createImage: fakeImageFactory(new Set(), created),
      createAudio: fakeAudioFactory(new Set()),
    });
    expect(created).toContain('assets/custom.png');
  });
});

describe('missing browser APIs and throwing factories', () => {
  it('resolves all null without deps when Image/Audio globals are absent', async () => {
    const res = await loadAssets(cfg);
    expect(res).toEqual({ sprite: null, sheet: null, sounds: { jump: null, score: null, game_over: null } });
  });

  it('resolves null when factories throw', async () => {
    const boom = () => { throw new Error('nope'); };
    const res = await loadAssets(cfg, { createImage: boom, createAudio: boom });
    expect(res.sprite).toBeNull();
    expect(res.sheet).toBeNull();
    expect(res.sounds).toEqual({ jump: null, score: null, game_over: null });
  });
});

describe('loadImage / loadSound', () => {
  it('loadImage resolves the image on load and null on error', async () => {
    expect(await loadImage('ok.png', fakeImageFactory(new Set()))).not.toBeNull();
    expect(await loadImage('bad.png', fakeImageFactory(new Set(['bad.png'])))).toBeNull();
  });

  it('loadSound works with addEventListener', async () => {
    expect(await loadSound('ok.wav', fakeAudioFactory(new Set()))).not.toBeNull();
    expect(await loadSound('bad.wav', fakeAudioFactory(new Set(['bad.wav'])))).toBeNull();
  });

  it('loadSound works with onX handlers when addEventListener is absent', async () => {
    const make = (failing) => () => ({
      oncanplaythrough: null,
      onerror: null,
      set src(v) {
        setTimeout(() => (failing.has(v) ? this.onerror() : this.oncanplaythrough()), 0);
      },
    });
    expect(await loadSound('ok.wav', make(new Set()))).not.toBeNull();
    expect(await loadSound('bad.wav', make(new Set(['bad.wav'])))).toBeNull();
  });
});

describe('drawFallbackSprite', () => {
  it('fills a white 24x24 square centered on (cx, cy)', () => {
    const calls = [];
    const ctx = {
      fillStyle: null,
      fillRect(...a) { calls.push({ style: this.fillStyle, rect: a }); },
    };
    drawFallbackSprite(ctx, 100, 200);
    expect(FALLBACK_SIZE).toBe(24);
    expect(calls).toEqual([{ style: '#ffffff', rect: [88, 188, 24, 24] }]);
  });
});
