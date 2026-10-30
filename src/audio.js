// Flappy Kiro audio: Audio_Player with mute and looping music, plus the pure event and mode mappings.
// Elements are injected, so no browser API is touched at load time.
const SOUND_NAMES = ['jump', 'score', 'game_over'];
const MUSIC_NAMES = ['menu', 'sky', 'forest', 'castle', 'space']; // one theme per world kind, in WORLDS order
const AMBIENT_NAMES = ['wind'];
const MUSIC_VOLUME = 0.45; // music sits under the effects
const BED_EASE = 0.04; // share of the remaining volume gap closed per frame
const WIND_VOLUME = { calm: 0.18, telegraph: 0.45, gust: 0.8 }; // the loop swells with the forest gusts
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

// sounds: { jump, score, game_over }; music: { menu, sky, forest, castle, space }; ambient: { wind }.
// Any element may be null (failed asset). The objects are read on use, so the shell can fill
// them in after loading finishes.
function createAudioPlayer(sounds, music, ambient) {
  const els = sounds || {};
  const tracks = music || {};
  const beds = ambient || {};
  let bed = null; // ambient loop that should be playing, or null
  let bedTarget = 0;
  let bedVolume = 0; // eased towards bedTarget so gusts swell instead of stepping
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

  function startBed() {
    const el = bed && beds[bed];
    if (!el || muted) return;
    el.loop = true;
    el.volume = bedVolume;
    if (el.paused !== false) safePlay(el);
  }

  function stopBed() {
    const el = bed && beds[bed];
    if (el && typeof el.pause === 'function') el.pause();
  }

  // Called every frame with the wanted ambient loop (or null) and its volume (0 to 1).
  // Changing only the volume of a playing loop is cheap, so this is safe per frame.
  function setAmbient(name, volume) {
    if (name !== bed) {
      stopBed();
      bed = name;
      bedVolume = 0; // a new loop fades in
    }
    bedTarget = volume || 0;
    bedVolume += (bedTarget - bedVolume) * BED_EASE;
    const el = bed && beds[bed];
    if (el) el.volume = bedVolume;
    if (bed) startBed();
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
    startBed();
  }

  function toggleMute() {
    muted = !muted;
    if (muted) {
      pauseTrack();
      stopBed();
    } else {
      startTrack();
      startBed();
    }
    return muted;
  }

  function isMuted() {
    return muted;
  }

  return { play, setMusic, setAmbient, resumeMusic, toggleMute, isMuted };
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

// Mode and world kind -> music: the menu theme on Main_Menu, the world's own theme while Playing (held,
// not restarted, while Paused), silence on Game_Over so the spoken "game over" is heard.
function musicFor(mode, worldKind) {
  if (mode === 'Main_Menu') return { track: 'menu', paused: false };
  const world = MUSIC_NAMES[1 + (worldKind || 0)] || MUSIC_NAMES[1];
  if (mode === 'Playing') return { track: world, paused: false };
  if (mode === 'Paused') return { track: world, paused: true };
  return { track: null, paused: false };
}

// Wind plays under the Forest theme (world kind 1) while a round runs, louder through each gust.
// phase is the twist's wind phase: 'calm', 'telegraph' or 'gust'.
function ambientFor(mode, worldKind, phase) {
  if (mode !== 'Playing' || worldKind !== 1) return { track: null, volume: 0 };
  return { track: 'wind', volume: WIND_VOLUME[phase] === undefined ? WIND_VOLUME.calm : WIND_VOLUME[phase] };
}

export { createAudioPlayer, soundsFor, musicFor, ambientFor, SOUND_NAMES, MUSIC_NAMES, AMBIENT_NAMES, MUSIC_VOLUME, WIND_VOLUME, BED_EASE };
