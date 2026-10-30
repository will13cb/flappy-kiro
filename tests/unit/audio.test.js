// Validates: Requirements 11.3, 11.4, 19.5, 19.6
import { describe, it, expect } from 'vitest';

import { createAudioPlayer, soundsFor, musicFor, ambientFor, SOUND_NAMES, MUSIC_VOLUME, WIND_VOLUME, BED_EASE } from '../../src/audio.js';

function fakeEl(opts = {}) {
  const el = {
    currentTime: 0,
    plays: 0,
    timesAtPlay: [],
    play() {
      el.plays += 1;
      el.timesAtPlay.push(el.currentTime);
      if (opts.throws) throw new Error('blocked');
      if (opts.rejects) return Promise.reject(new Error('NotAllowedError'));
      return Promise.resolve();
    },
  };
  return el;
}

describe('createAudioPlayer', () => {
  it('resets currentTime to 0 before each replay', () => {
    const jump = fakeEl();
    const p = createAudioPlayer({ jump, score: fakeEl(), game_over: fakeEl() });
    jump.currentTime = 0.15;
    p.play('jump');
    jump.currentTime = 0.1;
    p.play('jump');
    expect(jump.plays).toBe(2);
    expect(jump.timesAtPlay).toEqual([0, 0]);
  });

  it('swallows a rejecting play() promise', async () => {
    const jump = fakeEl({ rejects: true });
    const p = createAudioPlayer({ jump });
    expect(() => p.play('jump')).not.toThrow();
    await new Promise((r) => setTimeout(r, 0)); // no unhandled rejection
    expect(jump.plays).toBe(1);
  });

  it('swallows a synchronously throwing play()', () => {
    const p = createAudioPlayer({ jump: fakeEl({ throws: true }) });
    expect(() => p.play('jump')).not.toThrow();
  });

  it('a missing element is a no-op for that sound only', () => {
    const jump = fakeEl();
    const p = createAudioPlayer({ jump, score: null, game_over: fakeEl() });
    expect(() => p.play('score')).not.toThrow();
    expect(() => p.play('unknown')).not.toThrow();
    p.play('jump');
    expect(jump.plays).toBe(1);
  });

  it('missing score element leaves jump and game over working', () => {
    const jump = fakeEl();
    const over = fakeEl();
    const p = createAudioPlayer({ jump, score: null, game_over: over });
    p.play('score');
    p.play('jump');
    p.play('game_over');
    expect(jump.plays).toBe(1);
    expect(over.plays).toBe(1);
  });

  it('works with no elements at all', () => {
    const p = createAudioPlayer({ jump: null, score: null, game_over: null });
    expect(() => p.play('jump')).not.toThrow();
    expect(() => createAudioPlayer()).not.toThrow();
  });

  it('toggleMute returns the new value and mute silences play', () => {
    const jump = fakeEl();
    const p = createAudioPlayer({ jump });
    expect(p.isMuted()).toBe(false);
    expect(p.toggleMute()).toBe(true);
    expect(p.isMuted()).toBe(true);
    p.play('jump');
    expect(jump.plays).toBe(0);
    expect(p.toggleMute()).toBe(false);
    p.play('jump');
    expect(jump.plays).toBe(1);
  });
});

describe('soundsFor', () => {
  it('maps jump, scored and gameOver in order', () => {
    const events = [{ type: 'jump' }, { type: 'scored' }, { type: 'gameOver' }, { type: 'jump' }];
    expect(soundsFor(events)).toEqual(['jump', 'score', 'game_over', 'jump']);
  });

  it('ignores other events and empty input', () => {
    expect(soundsFor([{ type: 'flap' }, null, {}])).toEqual([]);
    expect(soundsFor([])).toEqual([]);
    expect(soundsFor(undefined)).toEqual([]);
  });

  it('only emits names listed in SOUND_NAMES', () => {
    expect(SOUND_NAMES).toEqual(['jump', 'score', 'game_over']);
    const out = soundsFor([{ type: 'jump' }, { type: 'scored' }, { type: 'gameOver' }]);
    out.forEach((n) => expect(SOUND_NAMES).toContain(n));
  });
});

describe('music', () => {
  function track() {
    const el = {
      paused: true, loop: false, volume: 1, currentTime: 0, plays: 0, pauses: 0,
      play() { el.plays += 1; el.paused = false; return Promise.resolve(); },
      pause() { el.pauses += 1; el.paused = true; },
    };
    return el;
  }

  it('maps modes to tracks', () => {
    expect(musicFor('Main_Menu')).toEqual({ track: 'menu', paused: false });
    expect(musicFor('Playing', 0)).toEqual({ track: 'sky', paused: false });
    expect(musicFor('Playing', 1)).toEqual({ track: 'forest', paused: false });
    expect(musicFor('Playing', 2)).toEqual({ track: 'castle', paused: false });
    expect(musicFor('Playing', 3)).toEqual({ track: 'space', paused: false });
    expect(musicFor('Paused', 2)).toEqual({ track: 'castle', paused: true });
    expect(musicFor('Game_Over', 2)).toEqual({ track: null, paused: false });
  });
  it('plays wind only in the Forest while Playing, louder through a gust', () => {
    expect(ambientFor('Playing', 1, 'calm')).toEqual({ track: 'wind', volume: WIND_VOLUME.calm });
    expect(ambientFor('Playing', 1, 'telegraph').volume).toBeGreaterThan(WIND_VOLUME.calm);
    expect(ambientFor('Playing', 1, 'gust').volume).toBeGreaterThan(ambientFor('Playing', 1, 'telegraph').volume);
    for (const [mode, kind] of [['Playing', 0], ['Playing', 2], ['Paused', 1], ['Game_Over', 1], ['Main_Menu', 1]]) {
      expect(ambientFor(mode, kind, 'gust')).toEqual({ track: null, volume: 0 });
    }
  });
  it('loops the wind, fades it in, stops it on leaving and silences it when muted', () => {
    const wind = track();
    const p = createAudioPlayer({}, {}, { wind });
    p.setAmbient('wind', 0.8);
    expect(wind).toMatchObject({ plays: 1, loop: true });
    expect(wind.volume).toBeCloseTo(0.8 * BED_EASE);
    for (let i = 0; i < 400; i++) p.setAmbient('wind', 0.8);
    expect(wind.volume).toBeCloseTo(0.8, 2);
    p.toggleMute();
    expect(wind.paused).toBe(true);
    p.setAmbient('wind', 0.8);
    expect(wind.plays).toBe(1);
    p.toggleMute();
    expect(wind.plays).toBe(2);
    p.setAmbient(null, 0);
    expect(wind.paused).toBe(true);
    expect(() => createAudioPlayer().setAmbient('wind', 1)).not.toThrow();
  });

  it('loops the wanted track, switches from the start, and is a no-op when unchanged', () => {
    const menu = track();
    const game = track();
    const p = createAudioPlayer({}, { menu, sky: game });
    p.setMusic('menu', false);
    p.setMusic('menu', false);
    expect(menu).toMatchObject({ plays: 1, loop: true, volume: MUSIC_VOLUME });
    menu.currentTime = 5;
    p.setMusic('sky', false);
    expect(menu).toMatchObject({ paused: true, currentTime: 0 });
    expect(game.plays).toBe(1);
  });

  it('pausing keeps the position; null stops the track', () => {
    const game = track();
    const p = createAudioPlayer({}, { sky: game });
    p.setMusic('sky', false);
    game.currentTime = 3;
    p.setMusic('sky', true);
    expect(game).toMatchObject({ paused: true, currentTime: 3 });
    p.setMusic('sky', false);
    expect(game.plays).toBe(2);
    p.setMusic(null, false);
    expect(game).toMatchObject({ paused: true, currentTime: 0 });
  });

  it('mute pauses music and unmute resumes it', () => {
    const menu = track();
    const p = createAudioPlayer({}, { menu });
    p.setMusic('menu', false);
    p.toggleMute();
    expect(menu.paused).toBe(true);
    p.setMusic('menu', false);
    p.resumeMusic();
    expect(menu.plays).toBe(1);
    p.toggleMute();
    expect(menu.plays).toBe(2);
  });

  it('resumeMusic retries a track that loaded late or was blocked by autoplay', () => {
    const music = { menu: null };
    const p = createAudioPlayer({}, music);
    p.setMusic('menu', false);
    const menu = track();
    music.menu = menu;
    p.resumeMusic();
    expect(menu.plays).toBe(1);
    menu.paused = true; // play() was blocked
    p.resumeMusic();
    expect(menu.plays).toBe(2);
  });

  it('missing or failing music elements never throw', () => {
    const p = createAudioPlayer({}, { sky: { play() { throw new Error('blocked'); }, pause() {} } });
    expect(() => p.setMusic('menu', false)).not.toThrow();
    expect(() => p.setMusic('sky', false)).not.toThrow();
    expect(() => createAudioPlayer().setMusic('sky', false)).not.toThrow();
  });
});
