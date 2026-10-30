// Feature: flappy-kiro, Property 22: Key repeat is ignored
// **Validates: Requirements 10.5**
// Only the input-module part is tested here (game.js is not involved).
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { mapKey, attachInput } = require('../../src/input.js');

const KEYS = [' ', 'Enter', 'ArrowUp', 'ArrowDown', 'p', 'P', 'Escape', 'm', 'M'];
const arbKey = fc.constantFrom(...KEYS);

function setup() {
  const listeners = {};
  const win = {
    addEventListener: (t, h) => (listeners[t] = h),
    removeEventListener: () => {},
  };
  const inputs = [];
  let mutes = 0;
  attachInput({
    cfg: { world: { WIDTH: 400, HEIGHT: 600 } },
    canvas: { addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({}) },
    doc: { addEventListener() {}, removeEventListener() {} },
    win,
    onInput: (i) => inputs.push(i),
    onToggleMute: () => mutes++,
  });
  return { fire: (e) => listeners.keydown(e), inputs, mutes: () => mutes };
}

describe('Property 22: key repeat is ignored', () => {
  it('mapKey returns null for repeats and a mapping otherwise', () => {
    fc.assert(
      fc.property(arbKey, (key) => {
        expect(mapKey({ key, repeat: true })).toBeNull();
        expect(mapKey({ key, repeat: false })).not.toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('a repeated keydown produces no input; the same key without repeat produces exactly one', () => {
    fc.assert(
      fc.property(arbKey, fc.integer({ min: 1, max: 5 }), (key, n) => {
        const t = setup();
        const total = () => t.inputs.length + t.mutes();
        for (let i = 0; i < n; i++) t.fire({ key, repeat: true, preventDefault() {} });
        expect(total()).toBe(0);
        t.fire({ key, repeat: false, preventDefault() {} });
        expect(total()).toBe(1);
      }),
      { numRuns: 100 }
    );
  });
});
