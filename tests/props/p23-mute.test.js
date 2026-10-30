// Feature: flappy-kiro, Property 23: Mute suppresses every sound
// **Validates: Requirements 11.2, 11.4, 19.4**
// Audio-module part only: toggling mute from game.js/main.js is not covered here.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createAudioPlayer, SOUND_NAMES } = require('../../src/audio.js');

// Fake element: records the currentTime seen at each play() call.
// mode: 'ok' | 'reject' | 'throw'
function fakeElement(mode) {
  const el = {
    currentTime: 42,
    calls: [],
    play() {
      el.calls.push(el.currentTime);
      if (mode === 'throw') throw new Error('blocked');
      if (mode === 'reject') return Promise.reject(new Error('autoplay blocked'));
      return Promise.resolve();
    },
  };
  return el;
}

const arbAction = fc.oneof(
  fc.constant({ kind: 'toggle' }),
  fc.record({ kind: fc.constant('play'), name: fc.constantFrom(...SOUND_NAMES) })
);

// Per sound: missing, working, rejecting or throwing element.
const arbMode = fc.constantFrom(null, 'ok', 'reject', 'throw');
const arbCase = fc.record({
  modes: fc.record({ jump: arbMode, score: arbMode, game_over: arbMode }),
  actions: fc.array(arbAction, { maxLength: 60 }),
});

describe('Property 23: mute suppresses every sound', () => {
  it('plays a sound iff not muted and its element exists, restarting from 0', () => {
    fc.assert(
      fc.property(arbCase, ({ modes, actions }) => {
        const els = {};
        for (const n of SOUND_NAMES) els[n] = modes[n] === null ? null : fakeElement(modes[n]);
        const player = createAudioPlayer(els);

        let muted = false;
        const expected = { jump: 0, score: 0, game_over: 0 };
        for (const a of actions) {
          if (a.kind === 'toggle') {
            muted = !muted;
            expect(player.toggleMute()).toBe(muted);
          } else {
            if (!muted && els[a.name]) expected[a.name] += 1;
            // Must never throw, whatever the element does.
            expect(() => player.play(a.name)).not.toThrow();
          }
          expect(player.isMuted()).toBe(muted);
        }
        for (const n of SOUND_NAMES) {
          if (els[n]) {
            expect(els[n].calls.length).toBe(expected[n]);
            // Each play restarts from the beginning.
            expect(els[n].calls.every((t) => t === 0)).toBe(true);
          }
        }
      }),
      { numRuns: 200 }
    );
  });

  it('does not touch currentTime while muted', () => {
    const el = fakeElement('ok');
    const player = createAudioPlayer({ jump: el, score: null, game_over: null });
    player.toggleMute();
    player.play('jump');
    expect(el.calls).toEqual([]);
    expect(el.currentTime).toBe(42);
  });
});
