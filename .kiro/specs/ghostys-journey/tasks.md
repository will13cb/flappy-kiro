# Implementation Plan: Ghosty's Journey

## Overview

Nine small, sequential tasks in the order given. Each builds only on earlier tasks and ends at a stop point so the user can commit and push. The agent cannot drive a browser: verification is the user running `python3 -m http.server 8000` and opening the URLs listed, plus a headless check or one small unit test where useful. After each task run `npx vitest --run`; all 52 existing test files must keep passing. Run commands without an `export PATH=...` prefix, and keep temporary scripts in `scripts/` and delete them when done.

## Tasks

- [x] 1. pointsPerWorld tunable, world index and ?world= param
  - [x] 1.1 Add the tunable and validation in `src/config.js`
    - Add `world.POINTS_PER_WORLD: 5` to `BASE`, `pointsPerWorld: ['world', 'POINTS_PER_WORLD']` to `TUNABLE`, and rule `world.pointsPerWorld` (integer >= 1) to `validateConfig`.
    - Make `parseOverrides` ignore the `world` param without a warning.
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 Create `src/worlds.js` with the `WORLDS` table and index helpers
    - Add `worldIndexFor`, `worldKind`, `loopOf`, `startScoreFor`, `parseStartWorld`. Overlays are empty for now.
    - Add `state.worldIndex` and `state.startWorld` to `game.js`; `startRound` starts at `startScoreFor`. `main.js` sets `state.startWorld` from `location.search`.
    - Draw a small debug label "WORLD: name" in `renderer.js` HUD so the index is visible.
    - _Requirements: 1.4, 2.1, 2.2, 2.3, 2.4_
  - [x] 1.3 Verify and add a unit test
    - Add `tests/unit/worlds.test.js` with a few examples. Fix any existing tests broken by the new config group by passing a large `POINTS_PER_WORLD` in their cfg.
    - Run `npx vitest --run`.
    - User checks `?world=castle&pointsPerWorld=3` (label shows castle, score starts at 6) and `?pointsPerWorld=0` (falls back to default with a console warning).
    - Stop for the user to commit and push.
    - _Requirements: 1.3, 2.2, 2.3_

- [x] 2. Title card, transition and invincibility on entry
  - [x] 2.1 Add `mergeWorld`, `buildWorldConfigs` and the transition logic
    - In `config.js` add `mergeWorld` and the `timing.TITLE_CARD_MS` and `timing.WORLD_INVINCIBILITY_MS` constants with validation. In `worlds.js` add `buildWorldConfigs`, `configFor`, `titleFor`; `loadConfig` validates all World_Configs.
    - In `game.js` add `baseCfg`, `transition` (drain, card), the spawn gate, the cfg swap, `WORLD_INVINCIBILITY_MS` and the `worldEntered` event.
    - _Requirements: 3.1, 3.3, 4.1, 4.2, 4.3, 4.5, 4.6_
  - [x] 2.2 Draw the title card and the palette crossfade
    - In `renderer.js` add `PALETTES` (sky identical to current colors, other worlds as placeholders), `activePalette`, `mixPalette`, the card overlay with fade in and out, and the crossfade.
    - _Requirements: 4.3, 4.4_
  - [x] 2.3 Verify and add a unit test
    - Add a small `tests/unit/` example for `titleFor` and the transition timing, or extend `worlds.test.js`. Run `npx vitest --run`.
    - User checks `?pointsPerWorld=2`: after 2 points pipes stop, the card shows "WORLD 2 - THE FOREST" for about 1.5 s, the colors crossfade and Ghosty blinks about 1 s.
    - Stop for the user to commit and push.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 3. Forest: visuals and telegraphed wind
  - [x] 3.1 Add the `twist` group, wind logic and validation
    - Add the `twist` group to `BASE`, the Forest overlay (`WIND_FORCE: 120`), rules `twist.windVsGravity` and the adjusted `reach.fall` and `reach.climb`.
    - Create `src/twists.js` with `stepWind`. Add the optional `windAccel` argument to `physics.stepGhost`. Step wind in `game.js` while Playing and reset it on world change.
    - _Requirements: 3.4, 5.2, 5.3, 5.5_
  - [x] 3.2 Draw the Forest
    - Create `src/worldArt.js` with the trunk obstacle, falling leaves, the gust cue (arrow and streaming leaves during telegraph and gust). Fill in the Forest palette in `renderer.js`.
    - _Requirements: 5.1, 5.4_
  - [x] 3.3 Verify and add a unit test
    - Add `tests/unit/twists.test.js` (calm, telegraph, gust order; force ramps without a jump). Run `npx vitest --run`.
    - User checks `?world=forest`: about 1 s before each gust the arrow shows and leaves stream in its direction, then the push builds smoothly. Trunks match the hitboxes.
    - Stop for the user to commit and push.
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 4. Castle: visuals and moving gaps
  - [x] 4.1 Add moving gaps
    - Add the Castle overlay (`GAP_AMPLITUDE: 24`) and rules `twist.amplitudeFits` and `twist.gapFollow`. Extend `twists.js` with `initPair` and `slideGaps`; make `pipes.spawnPair` use `baseCenter` for the previous center. Call both from `game.js`.
    - _Requirements: 3.4, 6.2, 6.3, 6.4_
  - [x] 4.2 Draw the Castle
    - In `worldArt.js` add the pillar obstacle with battlement caps and flickering torches. Fill in the Castle palette.
    - _Requirements: 6.1_
  - [x] 4.3 Verify and add a test
    - Extend `twists.test.js` with examples that the gap center stays within `GAP_CENTER_MIN..MAX`. Run `npx vitest --run`.
    - User checks `?world=castle`: gaps drift slowly, never leave the playfield, and collisions match the drawn pillars.
    - Stop for the user to commit and push.
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 5. Space: visuals and low gravity
  - [x] 5.1 Add the Space overlay
    - Add `gravityScale: 0.65` and `jumpScale: 0.8` handling to `buildWorldConfigs`, then the Space overlay. Confirm the Space World_Config passes `reach.fall` and `reach.climb`.
    - _Requirements: 3.2, 7.1, 7.3, 7.4_
  - [x] 5.2 Draw Space
    - In `worldArt.js` add asteroid columns and twinkling stars. Fill in the Space palette (black sky).
    - _Requirements: 7.2_
  - [x] 5.3 Verify
    - Extend `worlds.test.js` to assert every World_Config validates. Run `npx vitest --run`.
    - User checks `?world=space`: Ghosty is floaty but controllable, and the ceiling still kills.
    - Stop for the user to commit and push.
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 6. Loop and per-world difficulty ramp
  - [x] 6.1 Add per-world speed and looping
    - Add `speed.WORLD_SPEED_SPAN`, `speed.LOOP_SPEED_FACTOR` and rule `speed.span`. Extend `buildWorldConfigs` with `speedScale`, interval 1, `MAX_SPEED = min(base, initial + span)` and loops up to the last valid loop (`maxLoop`).
    - In `game.js` compute `speed = speedForScore(cfg, score - worldIndex × P)`. Make `titleFor` add the "LOOP n" line.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - [x] 6.2 Verify
    - Use a temporary `scripts/` headless script to print each world's initial and max speed and the `maxLoop` cap, then delete it. Extend `worlds.test.js` with the speed order example. Run `npx vitest --run`.
    - User checks `?world=space&pointsPerWorld=2` and plays on: the next world is Sky with "LOOP 2" and each world starts calm.
    - Stop for the user to commit and push.
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 7. Juice
  - [x] 7.1 Add particles and shake
    - Add the `fx` group to `BASE`. Create `src/particles.js` (puff, burst, "+1" popup, step, cap). In `game.js` emit on `jump`, score and Transition card, step particles, and set `shakeMs` on crash. Use the internal hash source, not the gameplay `rng`.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  - [x] 7.2 Draw particles and the shake
    - In `renderer.js` draw particles (leaves in Forest, stardust in Space) and the "+1" text, and translate the canvas by the shake offset.
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [x] 7.3 Verify and add a unit test
    - Add `tests/unit/particles.test.js` (cap respected, `rng` untouched). Run `npx vitest --run`.
    - User checks flap puffs per world, the floating "+1", about 200 ms of shake on a crash, and the burst during the title card.
    - Stop for the user to commit and push.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 8. Medals
  - [x] 8.1 Add medals
    - Create `src/medals.js` (`medalFor`, `betterMedal`, `MEDAL_ORDER`). Read `state.bestMedal` for the display from `medalFor(highScore, P)` for now.
    - _Requirements: 10.1, 10.2_
  - [x] 8.2 Draw medals on the game-over panel
    - In `renderer.js` draw the run's Medal next to the score and the best Medal next to the best score; no Medal below 1×P.
    - _Requirements: 10.3_
  - [x] 8.3 Verify and add a unit test
    - Add `tests/unit/medals.test.js` (thresholds at 0, P-1, P, 2P, 3P, 4P). Run `npx vitest --run`.
    - User checks with `?pointsPerWorld=1`: score 0 shows no medal, then Bronze, Silver, Gold and Platinum at 1 to 4.
    - Stop for the user to commit and push.
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 9. Trail and skins
  - [x] 9.1 Add the trail and best-medal storage
    - Add the `trail` group to `BASE`. Sample ghost positions in `game.js` into `state.trail` while Playing. In `scoreStore.js` add `loadBestMedal`, `recordBestMedal`, `loadSkin`, `saveSkin` with the existing try/catch pattern; wire them in `main.js` on `gameOver` and startup.
    - _Requirements: 11.1, 11.2, 11.3_
  - [x] 9.2 Add skins and the selector
    - Create `src/skins.js`. Map `ArrowLeft` and `ArrowRight` to `left` and `right` in `input.js`; handle them in the Main_Menu branch of `handleInput`; add `SKIN_PREV` and `SKIN_NEXT` rects to `menu.js`.
    - In `renderer.js` draw the trail, recolored sprite copies (built once with `createCanvas`), the rainbow trail and the selector with locked labels.
    - _Requirements: 11.1, 11.4, 11.5, 11.6_
  - [x] 9.3 Verify and add a unit test
    - Add `tests/unit/skins.test.js` (unlock rules and cycling). Update `input.test.js` for the new keys. Run `npx vitest --run`.
    - User checks the trail while playing, locked skins on a fresh storage, unlocks after earning each medal (`?pointsPerWorld=1` is fast), and that the choice persists after a reload.
    - Stop for the user to commit and push.
    - _Requirements: 11.1, 11.2, 11.4, 11.5, 11.6_

## Notes

- There are no optional tasks: the user excluded new property-based tests, and each task carries at most one small unit test per new module.
- Every task depends only on earlier tasks.
- The agent does not push or commit; each stop point is for the user.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["2.1"] },
    { "id": 4, "tasks": ["2.2"] },
    { "id": 5, "tasks": ["2.3"] },
    { "id": 6, "tasks": ["3.1"] },
    { "id": 7, "tasks": ["3.2"] },
    { "id": 8, "tasks": ["3.3"] },
    { "id": 9, "tasks": ["4.1"] },
    { "id": 10, "tasks": ["4.2"] },
    { "id": 11, "tasks": ["4.3"] },
    { "id": 12, "tasks": ["5.1"] },
    { "id": 13, "tasks": ["5.2"] },
    { "id": 14, "tasks": ["5.3"] },
    { "id": 15, "tasks": ["6.1"] },
    { "id": 16, "tasks": ["6.2"] },
    { "id": 17, "tasks": ["7.1"] },
    { "id": 18, "tasks": ["7.2"] },
    { "id": 19, "tasks": ["7.3"] },
    { "id": 20, "tasks": ["8.1"] },
    { "id": 21, "tasks": ["8.2"] },
    { "id": 22, "tasks": ["8.3"] },
    { "id": 23, "tasks": ["9.1"] },
    { "id": 24, "tasks": ["9.2"] },
    { "id": 25, "tasks": ["9.3"] }
  ]
}
```
