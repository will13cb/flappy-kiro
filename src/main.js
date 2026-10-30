// Flappy Kiro main loop and wiring (browser shell).
// startApp({ win, doc, canvas, storage, raf, now, rng, deps }) wires config, game, audio, assets, input
// and renderer, and starts the requestAnimationFrame loop. Everything is injectable so it runs under Node.
//   deps.modules   optional override of the FlappyKiro module set (tests)
//   deps.assetDeps optional { createImage, createAudio } passed to loadAssets
// Sounds have one loading path: assets.loadAssets creates the audio elements (no <audio> tags in index.html).
// The loop never waits for assets; sprites and sounds appear as they finish loading.
(function (root) {
  'use strict';

  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const browserApi = typeof window !== 'undefined' && window.FlappyKiro ? window.FlappyKiro : null;

  function defaultModules() {
    if (isNode && !browserApi) {
      return Object.assign(
        {},
        require('./config.js'),
        require('./physics.js'),
        require('./game.js'),
        require('./scoreStore.js'),
        require('./audio.js'),
        require('./assets.js'),
        require('./input.js'),
        require('./renderer.js')
      );
    }
    return browserApi || {};
  }

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
  function startApp(opts) {
    const o = opts || {};
    const deps = o.deps || {};
    const m = deps.modules || defaultModules();
    const win = o.win || (typeof window !== 'undefined' ? window : null);
    const doc = o.doc || (typeof document !== 'undefined' ? document : null);
    const canvas = o.canvas || (doc && doc.getElementById ? doc.getElementById('game-canvas') : null);
    const rng = o.rng || Math.random;
    const raf = o.raf || (win && win.requestAnimationFrame ? win.requestAnimationFrame.bind(win) : null);
    const log = deps.log || (typeof console !== 'undefined' ? console : undefined);
    const storage = safeStorage(win, o.storage);

    let cfg;
    try {
      cfg = m.loadConfig(win && win.location ? win.location.search : '', log);
    } catch (e) {
      const message = 'Flappy Kiro could not start: ' + (e && e.message ? e.message : String(e));
      showConfigError(doc, canvas, message);
      return { error: e, message };
    }

    const state = m.createGame(cfg, m.load(storage), rng);
    const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;

    const assets = { sprite: null, sheet: null };
    const soundEls = { jump: null, score: null, game_over: null };
    const audio = m.createAudioPlayer(soundEls); // keeps the soundEls reference, filled once loaded
    const createCanvas = doc && doc.createElement
      ? (w, h) => {
          const c = doc.createElement('canvas');
          c.width = w;
          c.height = h;
          return c;
        }
      : undefined;

    const loaded = Promise.resolve()
      .then(() => m.loadAssets(cfg, deps.assetDeps))
      .then((a) => {
        assets.sprite = a.sprite;
        assets.sheet = a.sheet;
        Object.assign(soundEls, a.sounds);
        return assets;
      })
      .catch(() => assets);

    const queue = [];
    let last = null;
    let running = true;
    let rafId = null;

    function pushInput(input) {
      queue.push(input);
    }

    function toggleMute() {
      return audio.toggleMute();
    }

    function processEvents(events) {
      if (!events || events.length === 0) return;
      m.soundsFor(events).forEach((name) => audio.play(name));
      events.forEach((ev) => {
        if (ev.type === 'toggleMute') {
          audio.toggleMute();
        } else if (ev.type === 'gameOver') {
          state.highScore = m.recordIfHigher(storage, ev.score, state.highScore);
        }
      });
    }

    // One simulation + draw step for timestamp ts (milliseconds).
    function step(ts) {
      const t = typeof ts === 'number' ? ts : o.now ? o.now() : 0;
      const raw = last === null ? 0 : (t - last) / 1000;
      last = t;
      const dt = m.clampDt(cfg, raw);

      while (queue.length > 0) {
        processEvents(m.handleInput(state, queue.shift(), { rng }));
      }
      processEvents(m.update(state, dt, { rng }));

      if (ctx) m.render(ctx, state, assets, { muted: audio.isMuted(), createCanvas });
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

    const detachInput = m.attachInput({
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
      if (canvas && win) m.fitCanvas(canvas, cfg, win.innerWidth, win.innerHeight);
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

  function autoStart() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const go = () => startApp({ win: window, doc: document });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true });
    else go();
  }

  const api = { startApp };

  if (typeof module !== 'undefined' && module.exports) {
    Object.assign(module.exports, api);
  }
  if (typeof window !== 'undefined') {
    window.FlappyKiro = window.FlappyKiro || {};
    Object.assign(window.FlappyKiro, api);
    autoStart();
  }
})(typeof window !== 'undefined' ? (window.FlappyKiro = window.FlappyKiro || {}) : {});
