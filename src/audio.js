// Flappy Kiro audio: Audio_Player with mute and looping music, plus the pure event and mode mappings.
// Elements are injected, so no browser API is touched at load time.
const SOUND_NAMES = ['jump', 'score', 'game_over'];
const MUSIC_NAMES = ['menu', 'game'];
const MUSIC_VOLUME = 0.6; // music sits under the effects
const EVENT_SOUND = { jump: 'jump', scored: 'score', gameOver: 'game_over' };

// Swallows a rejected play() promise: blocked or broken audio never interrupts the game.
function safePlay(el) {
  try {
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(function () {});
  } catch (e) {
    // same as a rejection
  }
}

// sounds: { jump, score, game_over }; music: { menu, game }. Any element may be null (failed asset).
// Both objects are read on use, so the shell can fill them in after loading finishes.
function createAudioPlayer(sounds, music) {
  const els = sounds || {};
  const tracks = music || {};
  let muted = false;
  let track = null; // music track that should be playing, or null
  let trackPaused = false;

  function play(name) {
    if (muted) return;
    const el = els[name];
    if (!el) return;
    el.currentTime = 0;
    safePlay(el);
  }

  function startTrack() {
    const el = track && tracks[track];
    if (!el || muted || trackPaused) return;
    el.loop = true;
    el.volume = MUSIC_VOLUME;
    if (el.paused !== false) safePlay(el);
  }

  function pauseTrack() {
    const el = track && tracks[track];
    if (el && typeof el.pause === 'function') el.pause();
  }

  // Called every frame with the wanted track (or null) and whether it is paused.
  // Switching tracks restarts the new one from the beginning; pausing keeps the position.
  function setMusic(name, paused) {
    const wantPaused = !!paused;
    if (name === track && wantPaused === trackPaused) return;
    if (name !== track) {
      pauseTrack();
      const old = track && tracks[track];
      if (old) old.currentTime = 0;
      track = name;
    }
    trackPaused = wantPaused;
    if (trackPaused) pauseTrack();
    else startTrack();
  }

  // Retries the current track: browsers block audio until the first user gesture, and music
  // elements may finish loading after setMusic was called.
  function resumeMusic() {
    startTrack();
  }

  function toggleMute() {
    muted = !muted;
    if (muted) pauseTrack();
    else startTrack();
    return muted;
  }

  function isMuted() {
    return muted;
  }

  return { play, setMusic, resumeMusic, toggleMute, isMuted };
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

// Mode -> music: menu music on Main_Menu, game music while Playing (held, not restarted, while Paused),
// silence on Game_Over so the spoken "game over" is heard.
function musicFor(mode) {
  if (mode === 'Main_Menu') return { track: 'menu', paused: false };
  if (mode === 'Playing') return { track: 'game', paused: false };
  if (mode === 'Paused') return { track: 'game', paused: true };
  return { track: null, paused: false };
}

export { createAudioPlayer, soundsFor, musicFor, SOUND_NAMES, MUSIC_NAMES, MUSIC_VOLUME };
