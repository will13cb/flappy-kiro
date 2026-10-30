// Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.7, 14.3
import { describe, it, expect, vi } from 'vitest';

import { toLogical, mapKey, attachInput } from '../../src/input.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

function makeTarget(extra = {}) {
  const listeners = [];
  return {
    listeners,
    addEventListener(type, fn, options) {
      listeners.push({ type, fn, options });
    },
    removeEventListener(type, fn) {
      const i = listeners.findIndex((l) => l.type === type && l.fn === fn);
      if (i >= 0) listeners.splice(i, 1);
    },
    dispatch(type, event = {}) {
      listeners.filter((l) => l.type === type).forEach((l) => l.fn(event));
    },
    ...extra,
  };
}

function setup({ rect, doc, win } = {}) {
  const canvas = makeTarget({
    getBoundingClientRect: () => rect || { left: 0, top: 0, width: DEFAULT_CONFIG.world.WIDTH, height: DEFAULT_CONFIG.world.HEIGHT },
  });
  const d = doc || makeTarget({ hidden: false, visibilityState: 'visible' });
  const w = win || makeTarget();
  const onInput = vi.fn();
  const onToggleMute = vi.fn();
  const detach = attachInput({ cfg: DEFAULT_CONFIG, canvas, doc: d, win: w, onInput, onToggleMute });
  return { canvas, doc: d, win: w, onInput, onToggleMute, detach };
}

describe('toLogical', () => {
  it('converts a click on a scaled, offset canvas to logical coordinates', () => {
    const { WIDTH, HEIGHT } = DEFAULT_CONFIG.world;
    const rect = { left: 10, top: 20, width: WIDTH / 2, height: HEIGHT / 2 };
    const p = toLogical(DEFAULT_CONFIG, rect, 10 + WIDTH / 4, 20 + HEIGHT / 4);
    expect(p.x).toBeCloseTo(WIDTH / 2);
    expect(p.y).toBeCloseTo(HEIGHT / 2);
  });
});

describe('mapKey', () => {
  it.each([
    [{ key: ' ' }, 'space'],
    [{ key: 'Enter' }, 'enter'],
    [{ key: 'ArrowUp' }, 'up'],
    [{ key: 'ArrowDown' }, 'down'],
    [{ key: 'p' }, 'pause'],
    [{ key: 'Escape' }, 'pause'],
  ])('maps %o to %s', (event, kind) => {
    expect(mapKey(event).input).toBe(kind);
  });

  it('only prevents default for space', () => {
    expect(mapKey({ key: ' ' }).preventDefault).toBe(true);
    expect(mapKey({ key: 'Enter' }).preventDefault).toBe(false);
  });

  it('maps M to mute and ignores repeats and unknown keys', () => {
    expect(mapKey({ key: 'm' })).toEqual({ mute: true });
    expect(mapKey({ key: ' ', repeat: true })).toBeNull();
    expect(mapKey({ key: 'x' })).toBeNull();
  });
});

describe('attachInput', () => {
  it('routes keydown on win and prevents default for space only', () => {
    const { win, onInput } = setup();
    const space = { key: ' ', preventDefault: vi.fn() };
    const enter = { key: 'Enter', preventDefault: vi.fn() };
    win.dispatch('keydown', space);
    win.dispatch('keydown', enter);
    win.dispatch('keydown', { key: 'ArrowUp', preventDefault: vi.fn() });
    expect(onInput.mock.calls.map((c) => c[0])).toEqual([{ kind: 'space' }, { kind: 'enter' }, { kind: 'up' }]);
    expect(space.preventDefault).toHaveBeenCalledTimes(1);
    expect(enter.preventDefault).not.toHaveBeenCalled();
  });

  it('falls back to doc for keydown when no win is given', () => {
    const doc = makeTarget({ hidden: false });
    const canvas = makeTarget({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 1, height: 1 }) });
    const onInput = vi.fn();
    attachInput({ cfg: DEFAULT_CONFIG, canvas, doc, win: null, onInput });
    // jsdom-less Node has no window, so keydown must land on doc
    doc.dispatch('keydown', { key: 'Enter' });
    expect(onInput).toHaveBeenCalledWith({ kind: 'enter' });
  });

  it('M toggles mute without emitting input', () => {
    const { win, onInput, onToggleMute } = setup();
    win.dispatch('keydown', { key: 'M' });
    expect(onToggleMute).toHaveBeenCalledTimes(1);
    expect(onInput).not.toHaveBeenCalled();
  });

  it('mousedown on a scaled canvas emits the logical point', () => {
    const { WIDTH, HEIGHT } = DEFAULT_CONFIG.world;
    const rect = { left: 5, top: 5, width: WIDTH * 2, height: HEIGHT * 2 };
    const { canvas, onInput } = setup({ rect });
    canvas.dispatch('mousedown', { clientX: 5 + WIDTH, clientY: 5 + HEIGHT });
    expect(onInput).toHaveBeenCalledWith({ kind: 'pointer', x: WIDTH / 2, y: HEIGHT / 2 });
  });

  it('touchstart uses changedTouches, falls back to touches, prevents default, is non-passive', () => {
    const { canvas, onInput } = setup();
    const reg = canvas.listeners.find((l) => l.type === 'touchstart');
    expect(reg.options).toEqual({ passive: false });

    const e1 = { changedTouches: [{ clientX: 10, clientY: 20 }], touches: [{ clientX: 99, clientY: 99 }], preventDefault: vi.fn() };
    canvas.dispatch('touchstart', e1);
    expect(onInput).toHaveBeenLastCalledWith({ kind: 'pointer', x: 10, y: 20 });
    expect(e1.preventDefault).toHaveBeenCalled();

    const e2 = { touches: [{ clientX: 30, clientY: 40 }], preventDefault: vi.fn() };
    canvas.dispatch('touchstart', e2);
    expect(onInput).toHaveBeenLastCalledWith({ kind: 'pointer', x: 30, y: 40 });
    expect(e2.preventDefault).toHaveBeenCalled();
  });

  it('visibilitychange emits hidden only when the document is hidden', () => {
    const { doc, onInput } = setup();
    doc.dispatch('visibilitychange');
    expect(onInput).not.toHaveBeenCalled();
    doc.hidden = true;
    doc.dispatch('visibilitychange');
    expect(onInput).toHaveBeenCalledWith({ kind: 'hidden' });
    doc.hidden = false;
    doc.visibilityState = 'hidden';
    doc.dispatch('visibilitychange');
    expect(onInput).toHaveBeenCalledTimes(2);
  });

  it('detach removes every listener', () => {
    const { canvas, doc, win, onInput, detach } = setup();
    detach();
    expect(canvas.listeners).toHaveLength(0);
    expect(doc.listeners).toHaveLength(0);
    expect(win.listeners).toHaveLength(0);
    win.dispatch('keydown', { key: ' ' });
    canvas.dispatch('mousedown', { clientX: 1, clientY: 1 });
    expect(onInput).not.toHaveBeenCalled();
  });
});
