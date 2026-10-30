// Feature: flappy-kiro, Property 40: Pointer coordinate mapping
// **Validates: Requirements 9.1, 10.2, 10.3**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbAnyConfig } from '../helpers/arbitraries.js';

import { toLogical, attachInput } from '../../src/input.js';

const num = (min, max) => fc.double({ min, max, noNaN: true, noDefaultInfinity: true });

// Rectangle with positive size at any offset.
const arbCanvasRect = fc.record({
  left: num(-1000, 1000),
  top: num(-1000, 1000),
  width: num(10, 3000),
  height: num(10, 3000),
});

// A config, a rectangle and a logical point inside the play area.
const arbCase = arbAnyConfig.chain((cfg) =>
  fc.record({
    cfg: fc.constant(cfg),
    rect: arbCanvasRect,
    lx: num(0, cfg.world.WIDTH),
    ly: num(0, cfg.world.HEIGHT),
  })
);

const toClient = (cfg, rect, lx, ly) => ({
  cx: rect.left + (lx * rect.width) / cfg.world.WIDTH,
  cy: rect.top + (ly * rect.height) / cfg.world.HEIGHT,
});

describe('Property 40: pointer coordinate mapping', () => {
  it('round-trips a logical point through client coordinates', () => {
    fc.assert(
      fc.property(arbCase, ({ cfg, rect, lx, ly }) => {
        const { cx, cy } = toClient(cfg, rect, lx, ly);
        const p = toLogical(cfg, rect, cx, cy);
        expect(p.x).toBeCloseTo(lx, 6);
        expect(p.y).toBeCloseTo(ly, 6);
      }),
      { numRuns: 20 }
    );
  });

  it('maps rectangle corners to the logical corners', () => {
    fc.assert(
      fc.property(arbAnyConfig, arbCanvasRect, (cfg, rect) => {
        const tl = toLogical(cfg, rect, rect.left, rect.top);
        const br = toLogical(cfg, rect, rect.left + rect.width, rect.top + rect.height);
        expect(tl.x).toBeCloseTo(0, 6);
        expect(tl.y).toBeCloseTo(0, 6);
        expect(br.x).toBeCloseTo(cfg.world.WIDTH, 6);
        expect(br.y).toBeCloseTo(cfg.world.HEIGHT, 6);
      }),
      { numRuns: 20 }
    );
  });

  it('applies the same scale on both axes when the rectangle keeps the aspect ratio', () => {
    fc.assert(
      fc.property(
        arbAnyConfig,
        num(0.1, 5),
        num(-500, 500),
        num(-500, 500),
        num(-300, 1500),
        num(-300, 1500),
        num(-300, 1500),
        num(-300, 1500),
        (cfg, scale, left, top, ax, ay, bx, by) => {
          const rect = {
            left,
            top,
            width: cfg.world.WIDTH * scale,
            height: cfg.world.HEIGHT * scale,
          };
          const a = toLogical(cfg, rect, ax, ay);
          const b = toLogical(cfg, rect, bx, by);
          // Client deltas map to logical deltas by the single factor 1 / scale.
          expect(b.x - a.x).toBeCloseTo((bx - ax) / scale, 5);
          expect(b.y - a.y).toBeCloseTo((by - ay) / scale, 5);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('delivers the mapped point for mouse and touch events on the canvas', () => {
    fc.assert(
      fc.property(arbCase, fc.constantFrom('mousedown', 'touchstart'), ({ cfg, rect, lx, ly }, type) => {
        const handlers = {};
        const canvas = {
          getBoundingClientRect: () => rect,
          addEventListener: (t, h) => {
            handlers[t] = h;
          },
          removeEventListener: () => {},
        };
        const inputs = [];
        const detach = attachInput({
          cfg,
          canvas,
          doc: {},
          win: {},
          onInput: (i) => inputs.push(i),
        });
        const { cx, cy } = toClient(cfg, rect, lx, ly);
        const event =
          type === 'mousedown'
            ? { clientX: cx, clientY: cy }
            : { changedTouches: [{ clientX: cx, clientY: cy }], preventDefault() {} };
        handlers[type](event);
        detach();

        expect(inputs).toHaveLength(1);
        expect(inputs[0].kind).toBe('pointer');
        expect(inputs[0].x).toBeCloseTo(lx, 6);
        expect(inputs[0].y).toBeCloseTo(ly, 6);
      }),
      { numRuns: 20 }
    );
  });
});
