# Ghosty Sprite Specification

## Overview

Ghosty is the player character. This document defines the sprite size, animation states and hitbox. Values match `src/config.js` (`ghost.SPRITE_SIZE`, `ghost.HITBOX_RADIUS`).

## Source asset

- Current file: `assets/ghosty.png` (1290 x 1567 px, RGBA). This is a single high-resolution image, not a sprite sheet.
- The game draws it scaled down to 32 x 32 logical pixels with image smoothing disabled.
- Idle, flap and death frames below need either new artwork or runtime transforms of the single image (see "Frame sources").

## Dimensions

| Property | Value |
|---|---|
| Sprite size | 32 x 32 px |
| Origin (rotation pivot) | Center of the sprite (16, 16) |
| Horizontal position | Fixed at x = 120 (sprite center) |
| Hitbox shape | Circle |
| Hitbox radius | 12 px |
| Hitbox center | Sprite center |
| Margin outside hitbox | 4 px at the horizontal and vertical extremes (16 - 12) |

The circle is inscribed with a 4 px margin on each side, so near misses at the sprite edge do not count as hits. Collisions test the circle against pipe rectangles (nearest point on the rectangle to the circle center is within 12 px) and against the ground and ceiling using the circle's bottom and top (center y +/- 12).

## Animation states

All frames are 32 x 32 px. Frame times are in milliseconds.

### Idle (Main_Menu, start of round)

| Frame | Description | Duration |
|---|---|---|
| idle_0 | Ghost at rest, body level | 300 ms |
| idle_1 | Ghost shifted 1 px up (gentle float) | 300 ms |

Loops. Used on the main menu, where the ghost holds a fixed position.

### Flap (Playing)

| Frame | Description | Duration |
|---|---|---|
| flap_0 | Body stretched upward, trailing edge raised | 60 ms |
| flap_1 | Neutral body | 60 ms |
| flap_2 | Body squashed slightly, trailing edge lowered | 80 ms |

Plays once on each jump, then returns to idle_0 until the next jump. A new jump restarts the sequence. Rotation follows vertical velocity: tilted up while rising, level at zero velocity, tilted down while falling.

### Death (Game_Over)

| Frame | Description | Duration |
|---|---|---|
| death_0 | Eyes crossed, body flashed white | 100 ms |
| death_1 | Normal colors, tilted 45 degrees down | 100 ms |
| death_2 | Flashed white, tilted 90 degrees down | 100 ms |
| death_3 | Normal colors, tilted 90 degrees down | 100 ms |
| death_4 | Final resting frame (held until restart) | until restart |

The first four frames fill the 500 ms crash animation while the ghost falls to the ground. death_4 is held after the animation ends.

## Frame sources

Choose one:

1. **Runtime transforms of one image (no new art).** Idle uses a 1 px vertical offset. Flap uses scale factors (1.0 x 1.15, 1.0 x 1.0, 1.1 x 0.9). Death uses rotation and a white tint flash. Works with the existing `assets/ghosty.png`.
2. **Sprite sheet (new art).** A horizontal strip of 10 frames (2 idle, 3 flap, 5 death), 320 x 32 px, saved as `assets/ghosty-sheet.png`, frames ordered as listed above.

## Other visual rules

- Invincibility blink: alternates visible and hidden every 100 ms for 1500 ms after a round starts.
- Placeholder if the image fails to load: a 24 x 24 px white square centered on the sprite center, so the hitbox is still readable.

## Notes on consistency with the spec

The spec currently defines a 48 x 48 px sprite and a 32 x 32 px square hitbox. This document uses 32 x 32 px and a 12 px circle as requested, so the requirements and design are aligned to this document. `src/config.js` already uses these values.
