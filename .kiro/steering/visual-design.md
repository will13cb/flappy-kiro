---
inclusion: fileMatch
fileMatchPattern: ["src/renderer.js", "src/animation.js", "src/clouds.js", "src/assets.js", "assets/**", "*.md"]
---

# Flappy Kiro visual design

Retro pixel art on a fixed 480 x 640 logical canvas, scaled up with CSS and `image-rendering: pixelated`. The detailed sources are the sprite spec, the UI mockups and the reference screenshot. When they disagree, this file and the config win.

#[[file:ghosty-sprites.md]]
#[[file:ui-mockups.md]]

## Art direction

- Flat colours, hard edges and a small palette. No gradients, blur or anti-aliasing (`imageSmoothingEnabled = false`), and no sub-pixel art.
- Draw sprites and textures at whole-pixel coordinates. Only the ghost's rotation may land on fractional positions.
- Every colour comes from `PALETTE` in `src/renderer.js`. To add a colour, add a named entry there; never inline a hex value in a draw call.

| Name | Hex | Use |
|---|---|---|
| sky | `#70C5CE` | background fill |
| cloud | `#FFFFFF` | clouds (with per-layer alpha) |
| pipe | `#5DB02A` | wall body and cap fill |
| pipeOutline | `#3E7A1B` | wall outline, unselected button border |
| ground | `#DED895` | ground fill |
| groundStripe | `#8B7B3A` | ground top band and scrolling ticks |
| text / textOutline | `#FFFFFF` / `#2B2B2B` | all HUD text, outlined |
| highlight | `#FFD54A` | "NEW BEST!", mute cross |
| dim | `#000000` | pause and game-over overlay (alpha 0.5) |

- Text uses `"Press Start 2P", monospace` through `drawText`, always with the dark outline.

## Draw order (back to front)

1. Sky
2. Clouds (far layer first)
3. Walls (pipes)
4. Ground
5. Ghosty
6. HUD and overlays

The bottom wall body ends exactly at `GROUND_TOP`, and the ground is drawn after the walls so any wall texture that overhangs is covered. Don't change this order without updating the renderer test that checks it.

## Ghosty animations

Ghosty is a 32 x 32 sprite (`assets/ghosty.png`) centred on `(ghost.X, ghost.y)`. The hitbox is a 12 px radius circle on the same centre. Art must keep the 4 px margin between the circle and the sprite edge, so what looks like a hit is a hit.

Frame timing lives in `cfg.animation`, and `src/animation.js` selects the frame. The renderer only applies what the frame descriptor says (`offsetY`, `scaleX`, `scaleY`, `rotation`, `tint`), so never add per-frame logic to `renderer.js`.

| State | Mode | Frames | Look |
|---|---|---|---|
| Idle | Main_Menu | 2 x 300 ms, looping | 1 px bob (`offsetY` 0, -1) |
| Flap | Playing, restarted on every jump | 60 / 60 / 80 ms, then idle frame 0 | stretch 1.0 x 1.15, neutral, squash 1.1 x 0.9 |
| Death | Game_Over | 4 x `CRASH_FLASH_MS` (100 ms), then held | rotation 0° → 45° → 90° → 90°; white tint on frames 0 and 2 |

- **Tilt:** in Idle and Flap the sprite rotates with velocity (`tiltFor(vy)`). It noses up about 25° when rising and down about 70° when falling, linear up to 600 px/s. Tilt is never baked into the art.
- **Squash and stretch** scale around the sprite centre. Keep both factors within 0.85 to 1.15 so the silhouette reads.
- **Invincibility blink:** the ghost is hidden on odd `BLINK_MS` intervals while `invincibleMs > 0`. This is the only way to show invincibility; don't add other effects.
- **Crash flash:** tinted frames draw a cached all-white copy of the sprite, built once via `opts.createCanvas`, never per frame.
- **Optional sprite sheet** (`cfg.animation.SHEET_FILE`, `assets/ghosty-sheet.png`): a horizontal strip of 10 frames, each 32 x 32. Frames 0–1 are idle, 2–4 are flap and 5–9 are death. With a sheet, the transforms become identity (the art carries them), except tilt.
- **Fallbacks:**
  - If the sheet is missing, transforms of `ghosty.png` are used.
  - If `ghosty.png` is also missing, a 24 x 24 white square is drawn with the same transforms.
  - Neither case may show an error.

## Wall textures (pipes)

Each wall pair is four rectangles from `pipes.pipeRects`: top body, top cap, bottom body and bottom cap.
- The body is 64 px wide and the cap 72 x 24.
- Caps sit at the gap edges.
- The bottom body ends at `GROUND_TOP`.

Draw from those rectangles only. Visual extras must stay inside them, so the drawn wall and the hitbox always match.

**Current look:** a flat `pipe` fill with a 2 px `pipeOutline` inset border.

When adding texture:
- **Shading:** add a vertical light band (about 25% of the body width, a lighter green) and a dark band on the right edge. Caps get the same bands plus a 2 px darker bottom lip on the top cap and top lip on the bottom cap.
- **Pre-render:** draw one body column and one cap into small offscreen canvases at startup, or the first time they're needed. Fill bodies with `ctx.createPattern(…, 'repeat-y')`, or tile with `drawImage`. Never rebuild them per frame.
- **Alignment:** keep texture rows aligned to the rectangle's own top, so the pattern doesn't shimmer as walls scroll. Round `x` to whole pixels before drawing.
- **Colours:** add any new colours to `PALETTE` (for example `pipeLight`, `pipeDark`).
- **Zero-size rects:** skip them, as `drawPipes` already does.

## Background parallax

Parallax uses speed per layer and never moves the camera. Everything moves left in world space.

| Layer | Speed | Notes |
|---|---|---|
| Sky | 0 | flat fill |
| Clouds | `SPEED_MIN + DEPTH * (SPEED_MAX - SPEED_MIN)`, which is 15 / 35 / 55 px/s by default | 3 layers in `cfg.clouds.LAYERS`; wider clouds are nearer, so they're faster and more opaque (alpha 0.5 / 0.6 / 0.7) |
| Walls and ground | `state.speed`, 120 rising to 240 px/s | must move together: same speed, same `dt` |

- **Depth cues are size, speed and opacity together.** A nearer layer is never slower, smaller or more transparent than a farther one. Validation (`clouds.order` and `clouds.belowScroll`) keeps every cloud slower than the world scroll.
- **Freeze:** clouds and ground move only in Playing. They are frozen in Main_Menu, Paused and Game_Over, like the walls.
- **Wrap:** clouds wrap to the right edge once fully off the left edge. The ground scrolls by `groundOffset` modulo the 24 px tick, so nothing is ever allocated for background movement.
- **New layers** (hills, a city skyline, stars):
  - Add a `LAYERS`-style config entry with a `DEPTH` between the existing layers.
  - Derive its speed the same way, and draw it in depth order between sky and walls.
  - Use a pre-rendered strip that tiles horizontally, drawn twice at `-offset` and `width - offset`.
  - Keep it slower than the walls.
  - Keep its contrast lower than the walls and Ghosty, so the playfield stays readable.

## Readability rules

- Ghosty, the walls and the score must always stand out from the background. Background layers stay desaturated or low-alpha, and no background element may be green like the walls.
- Effects never change the hitbox or the timing. Visual polish must not touch `game.js` or the config values that drive collision.
- Keep the UI positions (buttons, icons, panel) from `src/menu.js`, so the drawn controls and the clickable areas share one source.
