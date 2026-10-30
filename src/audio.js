// Flappy Kiro audio: Audio_Player with mute, and the pure soundsFor event mapping.
// Elements are injected, so no browser API is touched at load time.
(function (root) {
  'use strict';
  const SOUND_NAMES = ['jump', 'score', 'game_over'];
  const EVENT_SOUND = { jump: 'jump', scored: 'score', gameOver: 'game_over' };

  // elements: { jump, score, game_over }; any may be null/undefined (failed asset).
  function createAudioPlayer(elements) {
    const els = elements || {};
    let muted = false;
    function play(name) {
      if (muted) return;
      const el = els[name];
      if (!el) return;
      try {
        el.currentTime = 0;
        const p = el.play();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } catch (e) {
        // blocked or broken audio never interrupts the game
      }
    }
    function toggleMute() {
      muted = !muted;
      return muted;
    }
    function isMuted() {
      return muted;
    }
    return { play, toggleMute, isMuted };
  }

  // Events -> sound names, one per jump, scored or gameOver event, in order.
  function soundsFor(events) {
    const out = [];
    (events || []).forEach(function (ev) {
      const type = ev && ev.type;
      if (Object.prototype.hasOwnProperty.call(EVENT_SOUND, type)) out.push(EVENT_SOUND[type]);
    });
    return out;
  }

  const api = { createAudioPlayer, soundsFor, SOUND_NAMES };
  if (typeof window !== 'undefined') {
    window.FlappyKiro = window.FlappyKiro || {};
    Object.assign(window.FlappyKiro, api);
  }
  if (typeof module !== 'undefined' && module.exports) {
    Object.assign(module.exports, api);
  }
})(typeof window !== 'undefined' ? (window.FlappyKiro = window.FlappyKiro || {}) : {});
