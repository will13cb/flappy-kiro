// Feature: flappy-kiro, Property 36: Menu navigation
// **Validates: Requirements 17.2, 17.3**
// Note: only the menu-module part is tested here. "Up and Down change nothing in any other
// mode" depends on game.js handleInput, which is not built yet; the menu module exposes no
// per-mode navigation, so that part is left to the game tests.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { initialMenu, navigate, activate, buttonsFor } from '../../src/menu.js';

const arbDir = fc.constantFrom('up', 'down');
const opposite = (d) => (d === 'up' ? 'down' : 'up');
const arbMenu = fc.record({
  selected: fc.constantFrom('PLAY', 'HIGH_SCORES'),
  panelOpen: fc.boolean(),
});

describe('Property 36: menu navigation', () => {
  it('starts on PLAY with the panel closed', () => {
    expect(initialMenu()).toEqual({ selected: 'PLAY', panelOpen: false });
  });

  it('keeps the selection among the available buttons for any input sequence', () => {
    fc.assert(
      fc.property(fc.array(arbDir, { maxLength: 50 }), (dirs) => {
        let m = initialMenu();
        const available = buttonsFor('Main_Menu', m);
        for (const d of dirs) {
          m = navigate(m, d);
          expect(available).toContain(m.selected);
          expect(m.panelOpen).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('restores the previous selection after a direction and its opposite', () => {
    fc.assert(
      fc.property(arbMenu, arbDir, (menu, d) => {
        const closed = { ...menu, panelOpen: false };
        expect(navigate(navigate(closed, d), opposite(d))).toEqual(closed);
      }),
      { numRuns: 100 }
    );
  });

  it('changes nothing while the panel is open', () => {
    fc.assert(
      fc.property(arbMenu, fc.array(arbDir, { maxLength: 20 }), (menu, dirs) => {
        const open = activate({ ...menu, panelOpen: false }, 'HIGH_SCORES');
        expect(open.panelOpen).toBe(true);
        let m = open;
        for (const d of dirs) m = navigate(m, d);
        expect(m).toEqual(open);
      }),
      { numRuns: 100 }
    );
  });
});
