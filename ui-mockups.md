# UI Mockups

All screens use the 480 x 640 logical canvas and the pixel font `"Press Start 2P", monospace`. Coordinates are logical pixels from the top-left. Mockups are text diagrams; proportions are approximate.

## 1. Main menu

```
+------------------------------------------+
|                                          |
|                                          |
|             FLAPPY  KIRO                 |  title, centered, y = 140
|                                          |
|                 (ghost)                  |  ghost floats, y = 320
|                                          |
|             +------------+               |
|             |    PLAY    |               |  button, y = 400
|             +------------+               |
|             +------------+               |
|             | HIGH SCORES|               |  button, y = 460
|             +------------+               |
|         Press SPACE or tap to play       |  hint, y = 520
|==========================================|
|  ground                                  |  y = 560 to 640
+------------------------------------------+
```

- Buttons are 200 x 44 px, centered horizontally, 16 px apart.
- PLAY starts a round (same as a Jump_Input on the menu).
- HIGH SCORES opens a panel showing the stored High_Score. Only one value is stored today, so the panel shows "BEST: N" and a BACK button. Storing a list of scores would need a new requirement.
- Selected button is highlighted with a white border; keyboard: Up/Down to move, Space or Enter to activate.
- Sound toggle icon (top right, 32 x 32 px) and pause icon are hidden on the menu.

## 2. In-game HUD

```
+------------------------------------------+
|  [mute]                        [pause]   |  icons, y = 16
|                                          |
|                   12                     |  current score, y = 60
|                                          |
|        ||            ||                  |
|        ||            ||                  |  pipes
|        ||   (ghost)  ||                  |
|        ||            ||                  |
|        ||            ||                  |
|==========================================|
|  ground                                  |
+------------------------------------------+
```

- Current score: centered at the top, large (32 px font), white with a dark outline so it reads over clouds and pipes.
- Updates in the same frame a pipe pair is passed.
- Mute icon (top left) and pause icon (top right) are 32 x 32 px with 16 px margin, semi-transparent until hovered.
- While invincible (first 1.5 s) the ghost blinks.

## 3. Pause overlay

```
+------------------------------------------+
|                   12                     |
|          (dimmed game scene)             |
|                 PAUSED                   |  y = 280
|          Press P to resume               |  y = 320
+------------------------------------------+
```

- The scene is frozen and dimmed with a 50% black layer. The score stays visible.

## 4. Game over screen

```
+------------------------------------------+
|          (dimmed game scene)             |
|                                          |
|              GAME OVER                   |  y = 160
|                                          |
|     +--------------------------+         |
|     |  SCORE            12     |         |  panel, y = 220 to 340
|     |  BEST             27     |         |
|     |  NEW BEST!               |         |  only on a new high score
|     +--------------------------+         |
|                                          |
|             +------------+               |
|             |  RESTART   |               |  button, y = 400
|             +------------+               |
|        Press SPACE or tap to restart     |  hint, y = 460
+------------------------------------------+
```

- The overlay appears after the 500 ms crash animation ends.
- Final score and best score are right-aligned inside the panel.
- RESTART and Space/tap input are ignored for 500 ms after the game over starts, to avoid accidental restarts.
- A new high score shows "NEW BEST!" in a highlight color and nothing otherwise.

## Color palette (retro)

| Use | Color |
|---|---|
| Sky | #70C5CE |
| Pipes | #5DB02A with #3E7A1B outline |
| Ground | #DED895 with #8B7B3A top stripe |
| Text | #FFFFFF with #2B2B2B outline |
| Overlay dim | #000000 at 50% |
| Highlight | #FFD54A |

These are suggested starting colors. The reference screenshot `img/example-ui.png` could not be read, so check them against it.

## Differences from the current spec

- The spec's main menu has no buttons and no high score list. The PLAY and HIGH SCORES buttons and the BEST panel are additions.
- The spec shows the score only while Playing or Paused, which matches the HUD above.
