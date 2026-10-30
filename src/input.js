// Flappy Kiro input: key mapping, pointer coordinate mapping and DOM wiring.
// The mapping functions are pure; attachInput takes injectable targets so it also runs under Node.

const KEY_MAP = {
  ' ': 'space',
  Space: 'space',
  Spacebar: 'space',
  Enter: 'enter',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Tab: 'tab',
  p: 'pause',
  P: 'pause',
  Escape: 'pause',
};

// Canvas client coordinates -> logical coordinates.
function toLogical(cfg, rect, clientX, clientY) {
  return {
    x: ((clientX - rect.left) * cfg.world.WIDTH) / rect.width,
    y: ((clientY - rect.top) * cfg.world.HEIGHT) / rect.height,
  };
}

// Maps a keydown event to { input } , { mute: true } or null. Repeats are ignored.
// Returns { input: string, preventDefault: boolean } | { mute: true } | null.
function mapKey(event) {
  if (!event || event.repeat === true) return null;
  const key = event.key !== undefined ? event.key : event.code;
  if (key === 'm' || key === 'M') return { mute: true };
  let kind = KEY_MAP[key];
  if (!kind && event.code === 'Space') kind = 'space';
  if (!kind) return null;
  return { input: kind, preventDefault: kind === 'space' || kind === 'tab' };
}

// Wires DOM events. opts: { cfg, canvas, doc, win, onInput(input), onToggleMute() }.
// Returns a detach function.
function attachInput(opts) {
  const { cfg, canvas, onInput } = opts;
  const doc = opts.doc || (typeof document !== 'undefined' ? document : null);
  const win = opts.win || (typeof window !== 'undefined' ? window : null);
  const onToggleMute = opts.onToggleMute || function () {};
  const cleanups = [];

  function listen(target, type, handler, options) {
    if (!target || !target.addEventListener) return;
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener && target.removeEventListener(type, handler, options));
  }

  listen(win || doc, 'keydown', (event) => {
    const m = mapKey(event);
    if (!m) return;
    if (m.mute) {
      onToggleMute();
      return;
    }
    if (m.preventDefault && event.preventDefault) event.preventDefault();
    onInput({ kind: m.input });
  });

  function pointer(clientX, clientY) {
    const p = toLogical(cfg, canvas.getBoundingClientRect(), clientX, clientY);
    onInput({ kind: 'pointer', x: p.x, y: p.y });
  }

  listen(canvas, 'mousedown', (event) => pointer(event.clientX, event.clientY));
  listen(
    canvas,
    'touchstart',
    (event) => {
      const t = event.changedTouches && event.changedTouches[0] ? event.changedTouches[0] : event.touches && event.touches[0];
      if (!t) return;
      if (event.preventDefault) event.preventDefault();
      pointer(t.clientX, t.clientY);
    },
    { passive: false }
  );

  listen(doc, 'visibilitychange', () => {
    if (doc.hidden || doc.visibilityState === 'hidden') onInput({ kind: 'hidden' });
  });

  return function detach() {
    cleanups.forEach((fn) => fn());
    cleanups.length = 0;
  };
}

export { toLogical, mapKey, attachInput };
