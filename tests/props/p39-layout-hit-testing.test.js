// Feature: flappy-kiro, Property 39: Layout and hit testing
// **Validates: Requirements 17.1, 17.8, 17.9, 17.10**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbAnyConfig } from '../helpers/arbitraries.js';

import { buttonsFor, buttonRect, iconRect, iconsVisible, hitTest } from '../../src/menu.js';

const MODES = ['Main_Menu', 'Playing', 'Paused', 'Game_Over'];
const arbMode = fc.constantFrom(...MODES);
const arbMenu = fc.record({
  selected: fc.constantFrom('PLAY', 'HIGH_SCORES'),
  panelOpen: fc.boolean(),
});

const inside = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

// Controls that exist in a mode, with their rectangles.
function controls(cfg, mode, menu) {
  const list = buttonsFor(mode, menu).map((name) => ({ name, rect: buttonRect(cfg, name) }));
  if (iconsVisible(mode)) {
    for (const name of ['MUTE', 'PAUSE']) list.push({ name, rect: iconRect(cfg, name) });
  }
  return list;
}

// Points: random ones across the canvas plus ones on and around control edges.
function arbPoint(cfg) {
  const edges = [];
  for (const mode of MODES) {
    for (const panelOpen of [false, true]) {
      for (const { rect } of controls(cfg, mode, { selected: 'PLAY', panelOpen })) {
        for (const x of [rect.x - 1, rect.x, rect.x + rect.w - 1, rect.x + rect.w]) {
          for (const y of [rect.y - 1, rect.y, rect.y + rect.h - 1, rect.y + rect.h]) {
            edges.push([x, y]);
          }
        }
      }
    }
  }
  return fc.oneof(
    fc.tuple(
      fc.integer({ min: 0, max: cfg.world.WIDTH }),
      fc.integer({ min: 0, max: cfg.world.HEIGHT })
    ),
    fc.constantFrom(...edges)
  );
}

const arbCase = arbAnyConfig.chain((cfg) =>
  fc.record({
    cfg: fc.constant(cfg),
    mode: arbMode,
    menu: arbMenu,
    pt: arbPoint(cfg),
  })
);

describe('Property 39: layout and hit testing', () => {
  it('lays out menu buttons centered, BUTTON_GAP apart, and icons in their corners', () => {
    fc.assert(
      fc.property(arbAnyConfig, (cfg) => {
        const u = cfg.ui;
        const play = buttonRect(cfg, 'PLAY');
        const hs = buttonRect(cfg, 'HIGH_SCORES');
        for (const r of [play, hs, buttonRect(cfg, 'BACK'), buttonRect(cfg, 'RESTART')]) {
          expect(r.w).toBe(u.BUTTON_WIDTH);
          expect(r.h).toBe(u.BUTTON_HEIGHT);
          // Horizontally centered: equal margins on both sides.
          expect(r.x).toBeCloseTo(cfg.world.WIDTH - (r.x + r.w), 9);
        }
        expect(hs.y - (play.y + play.h)).toBeCloseTo(u.BUTTON_GAP, 9);

        const mute = iconRect(cfg, 'MUTE');
        const pause = iconRect(cfg, 'PAUSE');
        for (const r of [mute, pause]) {
          expect(r.w).toBe(u.ICON_SIZE);
          expect(r.h).toBe(u.ICON_SIZE);
          expect(r.y).toBe(u.ICON_MARGIN);
        }
        expect(mute.x).toBe(u.ICON_MARGIN);
        expect(cfg.world.WIDTH - (pause.x + pause.w)).toBeCloseTo(u.ICON_MARGIN, 9);
      }),
      { numRuns: 100 }
    );
  });

  it('shows icons only in Playing and Paused, never in Main_Menu', () => {
    expect(iconsVisible('Playing')).toBe(true);
    expect(iconsVisible('Paused')).toBe(true);
    expect(iconsVisible('Main_Menu')).toBe(false);
    expect(iconsVisible('Game_Over')).toBe(false);
  });

  it('hits a control iff the point is in its half-open rectangle and it exists in the mode', () => {
    fc.assert(
      fc.property(arbCase, ({ cfg, mode, menu, pt: [x, y] }) => {
        const hits = controls(cfg, mode, menu).filter((c) => inside(c.rect, x, y));
        // No point hits two controls.
        expect(hits.length).toBeLessThanOrEqual(1);
        const result = hitTest(cfg, { mode, menu }, x, y);
        expect(result).toBe(hits.length ? hits[0].name : null);
        if (mode === 'Main_Menu') expect(['MUTE', 'PAUSE']).not.toContain(result);
      }),
      { numRuns: 100 }
    );
  });

  it('treats left/top edges as inside and right/bottom edges as outside', () => {
    fc.assert(
      fc.property(arbAnyConfig, arbMode, arbMenu, (cfg, mode, menu) => {
        for (const { name, rect } of controls(cfg, mode, menu)) {
          const s = { mode, menu };
          expect(hitTest(cfg, s, rect.x, rect.y)).toBe(name);
          expect(hitTest(cfg, s, rect.x + rect.w - 1, rect.y + rect.h - 1)).toBe(name);
          expect(hitTest(cfg, s, rect.x + rect.w, rect.y)).not.toBe(name);
          expect(hitTest(cfg, s, rect.x, rect.y + rect.h)).not.toBe(name);
          expect(hitTest(cfg, s, rect.x - 1, rect.y)).not.toBe(name);
          expect(hitTest(cfg, s, rect.x, rect.y - 1)).not.toBe(name);
        }
      }),
      { numRuns: 100 }
    );
  });
});
