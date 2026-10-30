// Feature: flappy-kiro, Property 15: Circle against rectangle uses a strict nearest-point distance
// **Validates: Requirements 6.6, 6.10, 6.11**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { nearestPoint, distanceSqToRect, circleHitsRect } from '../../src/collision.js';

// Half-integer values (k / 2) keep all squared distances exactly representable.
const half = (min, max) => fc.integer({ min: min * 2, max: max * 2 }).map((k) => k / 2);

const arbRectH = fc.record({
  x: half(-100, 100),
  y: half(-100, 100),
  w: half(1, 100),
  h: half(1, 100),
});
const arbRadiusH = half(0.5, 50);

// General case: any real circle and rectangle.
const arbRectAny = fc.record({
  x: fc.double({ min: -500, max: 500, noNaN: true }),
  y: fc.double({ min: -500, max: 500, noNaN: true }),
  w: fc.double({ min: 0.5, max: 500, noNaN: true }),
  h: fc.double({ min: 0.5, max: 500, noNaN: true }),
});
const arbCircleAny = fc.record({
  cx: fc.double({ min: -800, max: 800, noNaN: true }),
  cy: fc.double({ min: -800, max: 800, noNaN: true }),
  r: fc.double({ min: 0.5, max: 100, noNaN: true }),
});

// Exact touch: the circle center sits exactly r from one edge along an axis,
// with its other coordinate within the edge span.
const arbTouch = fc
  .tuple(arbRectH, arbRadiusH, fc.constantFrom('left', 'right', 'top', 'bottom'), fc.double({ min: 0, max: 1, noNaN: true }))
  .map(([rect, r, side, t]) => {
    const alongX = Math.round(t * rect.w * 2) / 2;
    const alongY = Math.round(t * rect.h * 2) / 2;
    let cx, cy;
    if (side === 'left') { cx = rect.x - r; cy = rect.y + alongY; }
    else if (side === 'right') { cx = rect.x + rect.w + r; cy = rect.y + alongY; }
    else if (side === 'top') { cx = rect.x + alongX; cy = rect.y - r; }
    else { cx = rect.x + alongX; cy = rect.y + rect.h + r; }
    return { rect, circle: { cx, cy, r } };
  });

// Diagonal corner: the circle center lies on the 45 degree line out of a corner.
const arbDiagonal = fc.tuple(
  arbRectH,
  half(1, 50),
  fc.constantFrom(-1, 1),
  fc.constantFrom(-1, 1),
  fc.constantFrom(0, 1),
  fc.constantFrom(0, 1)
);

function diagonalCircle(rect, r, sx, sy, cornerX, cornerY, scale) {
  const corner = { x: rect.x + cornerX * rect.w, y: rect.y + cornerY * rect.h };
  // Choose signs so the center is outside both edges meeting at that corner.
  const dirX = cornerX === 1 ? Math.abs(sx) : -Math.abs(sx);
  const dirY = cornerY === 1 ? Math.abs(sy) : -Math.abs(sy);
  const d = (r * scale) / Math.SQRT2;
  return { cx: corner.x + dirX * d, cy: corner.y + dirY * d, r };
}

describe('Property 15: circle against rectangle uses a strict nearest-point distance', () => {
  it('distance squared equals the squared distance to the nearest point', () => {
    fc.assert(
      fc.property(arbCircleAny, arbRectAny, (circle, rect) => {
        const p = nearestPoint(rect, circle.cx, circle.cy);
        expect(p.x).toBeGreaterThanOrEqual(rect.x);
        expect(p.x).toBeLessThanOrEqual(rect.x + rect.w);
        expect(p.y).toBeGreaterThanOrEqual(rect.y);
        expect(p.y).toBeLessThanOrEqual(rect.y + rect.h);
        const expected = (circle.cx - p.x) ** 2 + (circle.cy - p.y) ** 2;
        expect(distanceSqToRect(circle, rect)).toBe(expected);
        expect(circleHitsRect(circle, rect)).toBe(expected < circle.r * circle.r);
      }),
      { numRuns: 100 }
    );
  });

  it('has zero distance and a hit when the center is inside the rectangle', () => {
    fc.assert(
      fc.property(
        arbRectAny,
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0.5, max: 100, noNaN: true }),
        (rect, u, v, r) => {
          const circle = { cx: rect.x + u * rect.w, cy: rect.y + v * rect.h, r };
          expect(distanceSqToRect(circle, rect)).toBe(0);
          expect(circleHitsRect(circle, rect)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('reports no collision when exactly the radius away from an edge (exact touch)', () => {
    fc.assert(
      fc.property(arbTouch, ({ rect, circle }) => {
        expect(distanceSqToRect(circle, rect)).toBe(circle.r * circle.r);
        expect(circleHitsRect(circle, rect)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('reports a collision once the circle moves slightly closer than touching', () => {
    fc.assert(
      fc.property(arbTouch, ({ rect, circle }) => {
        // Move the center toward the rectangle by half a unit (exact in binary).
        const closer = { ...circle };
        if (circle.cx < rect.x) closer.cx += 0.25;
        else if (circle.cx > rect.x + rect.w) closer.cx -= 0.25;
        else if (circle.cy < rect.y) closer.cy += 0.25;
        else closer.cy -= 0.25;
        expect(circleHitsRect(closer, rect)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('treats the diagonal corner distance with a small tolerance around the radius', () => {
    fc.assert(
      fc.property(arbDiagonal, ([rect, r, sx, sy, cornerX, cornerY]) => {
        const inside = diagonalCircle(rect, r, sx, sy, cornerX, cornerY, 1 - 1e-6);
        const outside = diagonalCircle(rect, r, sx, sy, cornerX, cornerY, 1 + 1e-6);
        expect(circleHitsRect(inside, rect)).toBe(true);
        expect(circleHitsRect(outside, rect)).toBe(false);
        // Distance is the radius within floating point tolerance.
        const exact = diagonalCircle(rect, r, sx, sy, cornerX, cornerY, 1);
        expect(Math.sqrt(distanceSqToRect(exact, rect))).toBeCloseTo(r, 6);
      }),
      { numRuns: 100 }
    );
  });
});
