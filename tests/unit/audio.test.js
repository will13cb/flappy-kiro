// Validates: Requirements 11.3, 11.4, 19.5, 19.6
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createAudioPlayer, soundsFor, SOUND_NAMES } = require('../../src/audio.js');

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
