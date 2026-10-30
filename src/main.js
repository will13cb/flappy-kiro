// Flappy Kiro main loop and wiring (browser shell).
// startApp({ win, doc, canvas, storage, raf, now, rng, deps }) wires config, game, audio, assets, input
// and renderer, and starts the requestAnimationFrame loop. Everything is injectable so it runs under Node.
//   deps.assetDeps optional { createImage, createAudio } passed to loadAssets
// Sounds have one loading path: assets.loadAssets creates the audio elements (no <audio> tags in index.html).
// The loop never waits for assets; sprites and sounds appear as they finish loading.
import { loadConfig } from './config.js';
import { clampDt } from './physics.js';
import { createGame, handleInput, update } from './game.js';
import { load as loadHighScore, loadTop, recordIfHigher, recordTop } from './scoreStore.js';
import { createAudioPlayer, soundsFor, musicFor } from './audio.js';
import { loadAssets } from './assets.js';
import { attachInput } from './input.js';
import { render, fitCanvas } from './renderer.js';
function showConfigError(doc, canvas, message) {
  if (canvas && canvas.style) canvas.style.display = 'none';
  if (canvas) canvas.hidden = true;
  const box = doc && doc.getElementById ? doc.getElementById('config-error') : null;
  if (box) {
    box.textContent = message;
    box.hidden = false;
  }
}

function safeStorage(win, storage) {
  if (storage !== undefined) return storage;
  try {
    return win && win.localStorage ? win.localStorage : null;
  } catch (e) {
    return null; // access can throw (privacy modes, sandboxed frames)
  }
}

// Returns a controller { cfg, state, audio, assets, frame(ts), step(ts), pushInput(input), toggleMute(),
// loaded, detach() } or { error } when the config fails to load.
export function startApp(opts) {
  const o = opts || {};
  const deps = o.deps || {};
  const win = o.win || (typeof window !== 'undefined' ? window : null);
  const doc = o.doc || (typeof document !== 'undefined' ? document : null);
  const canvas = o.canvas || (doc && doc.getElementById ? doc.getElementById('game-canvas') : null);
  const rng = o.rng || Math.random;
  const raf = o.raf || (win && win.requestAnimationFrame ? win.requestAnimationFrame.bind(win) : null);
  const log = deps.log || (typeof console !== 'undefined' ? console : undefined);
  const storage = safeStorage(win, o.storage);

  let cfg;
  try {
    cfg = loadConfig(win && win.location ? win.location.search : '', log);
  } catch (e) {
    const message = 'Flappy Kiro could not start: ' + (e && e.message ? e.message : String(e));
    showConfigError(doc, canvas, message);
    return { error: e, message };
  }

  const topScores = loadTop(storage);
  // BEST is the larger of the legacy single score and the top of the list.
  const state = createGame(cfg, Math.max(loadHighScore(storage), topScores[0] || 0), rng, topScores);
  const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;

  const assets = { sprite: null, sheet: null };
  const soundEls = { jump: null, score: null, game_over: null };
  const musicEls = { menu: null, game: null };
  const audio = createAudioPlayer(soundEls, musicEls); // keeps both references, filled once loaded
  const createCanvas = doc && doc.createElement
    ? (w, h) => {
        const c = doc.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
      }
    : undefined;

  const loaded = Promise.resolve()
    .then(() => loadAssets(cfg, deps.assetDeps))
    .then((a) => {
      assets.sprite = a.sprite;
      assets.sheet = a.sheet;
      Object.assign(soundEls, a.sounds);
      Object.assign(musicEls, a.music);
      audio.resumeMusic(); // start the current track now that it exists
      return assets;
    })
    .catch(() => assets);

  const queue = [];
  let last = null;
  let running = true;
  let rafId = null;

  function pushInput(input) {
    queue.push(input);
    audio.resumeMusic(); // runs inside the input event, so it unlocks music blocked by autoplay rules
  }

  function toggleMute() {
    return audio.toggleMute();
  }

  function processEvents(events) {
    if (!events || events.length === 0) return;
    soundsFor(events).forEach((name) => audio.play(name));
    events.forEach((ev) => {
      if (ev.type === 'toggleMute') {
        audio.toggleMute();
      } else if (ev.type === 'gameOver') {
        state.highScore = recordIfHigher(storage, ev.score, state.highScore);
        state.topScores = recordTop(storage, ev.score, state.topScores);
      }
    });
  }

  // One simulation + draw step for timestamp ts (milliseconds).
  function step(ts) {
    const t = typeof ts === 'number' ? ts : o.now ? o.now() : 0;
    const raw = last === null ? 0 : (t - last) / 1000;
    last = t;
    const dt = clampDt(cfg, raw);

    while (queue.length > 0) {
      processEvents(handleInput(state, queue.shift(), { rng }));
    }
    processEvents(update(state, dt, { rng }));
    const music = musicFor(state.mode);
    audio.setMusic(music.track, music.paused);

    if (ctx) render(ctx, state, assets, { muted: audio.isMuted(), createCanvas });
  }

  function schedule() {
    if (running && raf) rafId = raf(frame);
  }

  function frame(ts) {
    if (!running) return;
    try {
      step(ts);
    } finally {
      schedule(); // a failed frame must not stop the loop
    }
  }

  const detachInput = attachInput({
    cfg,
    canvas,
    doc,
    win,
    onInput: pushInput,
    onToggleMute: toggleMute,
  });

  function onVisible() {
    if (doc && !doc.hidden && doc.visibilityState !== 'hidden') last = null; // no huge dt after a hidden tab
  }
  function onResize() {
    if (canvas && win) fitCanvas(canvas, cfg, win.innerWidth, win.innerHeight);
  }
  if (doc && doc.addEventListener) doc.addEventListener('visibilitychange', onVisible);
  if (win && win.addEventListener) win.addEventListener('resize', onResize);
  onResize();

  schedule();

  function detach() {
    running = false;
    if (rafId !== null && win && win.cancelAnimationFrame) win.cancelAnimationFrame(rafId);
    detachInput();
    if (doc && doc.removeEventListener) doc.removeEventListener('visibilitychange', onVisible);
    if (win && win.removeEventListener) win.removeEventListener('resize', onResize);
  }

  return { cfg, state, audio, assets, loaded, frame, step, pushInput, toggleMute, detach };
}

// Browser entry: start once the DOM is ready. Skipped outside a browser (tests, Node).
if (typeof document !== 'undefined') {
  const go = () => startApp({ win: window, doc: document });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true });
  else go();
}
