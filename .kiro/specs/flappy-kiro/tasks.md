# Implementation Plan: Flappy Kiro

## Overview

Flappy Kiro is built in plain JavaScript as classic scripts sharing a global `FlappyKiro` namespace, so it runs from `file://` with no build step. Tunable values live in the workspace-root `game-config.json`; a small script generates `src/game-config.js` from it so the page can load it synchronously. The plan starts with project setup, the config sync and the config module, then builds the pure logic core (physics, pipes, collision with a circle hitbox, clouds, animation, menu, score store, game state machine), then the browser shell (audio including the score sound, assets, input with pointer mapping, renderer, `index.html`, main loop). Every logic module also exports through `module.exports` so vitest and fast-check can test it in Node. Each property-based test lives in its own file under `tests/props/` and reads all expected numbers from the config in use. All 47 correctness properties of the design are covered by one optional test sub-task each.

## Tasks

- [x] 1. Project setup for testing
  - [x] 1.1 Create `package.json`, vitest config and `.gitignore` entry
    - Create `package.json` (dev dependencies only) with `vitest` and `fast-check` pinned to exact versions (no `^` or `~`)
    - Add scripts: `test` (`vitest --run`), `sync-config` (`node scripts/sync-config.js`) and `generate-score-wav` (`node scripts/generate-score-wav.js`)
    - Add `vitest.config.js` with the Node environment and `tests/**/*.test.js` include pattern
    - Ensure `node_modules` is listed in `.gitignore`
    - _Requirements: 1.1_

- [x] 2. Config source and sync
  - [x] 2.1 Implement `scripts/sync-config.js` and generate `src/game-config.js`
    - Read `game-config.json` from the workspace root and write `src/game-config.js` containing only the parsed JSON assigned to `FlappyKiro.GAME_CONFIG` (and to `module.exports` in Node), with a "GENERATED, do not edit" header
    - Export a pure `renderConfigScript(json)` function so a test can reproduce the file content without touching the real file
    - Run the script once to create `src/game-config.js`
    - _Requirements: 1.1, 1.6_

  - [x] 2.2 Write parity test for the generated config
    - Create `tests/unit/config-parity.test.js`
    - Check that `GAME_CONFIG` from `src/game-config.js` deep-equals the parsed `game-config.json`, and that `renderConfigScript` reproduces `src/game-config.js` byte for byte
    - _Requirements: 1.6_

- [x] 3. Implement config module (`src/config.js`)
  - [x] 3.1 Implement mapping, extra base values, derived values and `buildConfig`
    - Write `mapJson(json)` (camelCase JSON to UPPER_SNAKE groups per the design table, ignoring `_comment`, reporting a missing key by path) and its inverse `unmapJson(base)`
    - Write `EXTRA_BASE` with the `ui` group (button, panel and icon geometry) and the `animation` group (`IDLE_FRAMES`, `FLAP_FRAMES`, `DEATH_FRAMES`, `DEATH_FINAL`, `SHEET_FILE`)
    - Write `derive(base)` computing `GROUND_TOP`, `MENU_GHOST_Y`, `JUMP_SPEED`, `HITBOX_MARGIN`, `CAP_INSET`, `GAP_CENTER_MIN`, `GAP_CENTER_MAX`, `SPAWN_X`, `MAX_DT`, `DEATH_FRAME_MS`, `LAYER_SPEEDS`, `BUTTON_X`, `MENU_STACK_BOTTOM`, `MUTE_ICON_X`, `PAUSE_ICON_X`, `ICON_Y`, `IDLE_TOTAL_MS`, `FLAP_TOTAL_MS` and `DEATH_TOTAL_MS`
    - Write the `TUNABLE` whitelist (gravity, jumpVelocity, hitboxRadius, gapHeight, gapMargin, pipeSpacing, maxGapShift, wallSpeed, speedIncrement, speedStepInterval, maxSpeed, invincibilityMs, crashMs, lockoutMs, cloudSpeedMin, cloudSpeedMax) and `buildConfig(overrides)` that ignores derived keys and deep-freezes every group
    - Read `FlappyKiro.GAME_CONFIG` (or `require('./game-config')` in Node); throw `game-config.js not loaded: run npm run sync-config` when it is missing
    - Attach to `FlappyKiro` in the browser and to `module.exports` in Node
    - _Requirements: 1.6, 4.5, 6.1, 6.3, 13.5, 17.1_

  - [x] 3.2 Implement `validateConfig` and `assertValidConfig`
    - Implement every rule in the design table: `number.finite`, `ghost.shape`, `ghost.radiusFits`, `ghost.jumpUp`, `ghost.insideWorld`, `pipes.capCoversBody`, `pipes.spacing`, `gap.heightVsHitbox` (`GAP_HEIGHT > 2 * HITBOX_RADIUS`), `gap.fitsAboveGround`, `gap.shiftPositive`, `speed.order`, `reach.fall`, `reach.climb`, `clouds.order`, `clouds.belowScroll`, `clouds.layers`, `timing.positive`, `anim.tables`, `anim.deathFitsCrash`, `ui.fits`
    - Collect all violations, each prefixed with its stable rule id
    - `assertValidConfig` throws `Invalid Flappy Kiro config:` followed by one line per error
    - Define `DEFAULT_CONFIG = buildConfig({})` and assert it is valid at module load
    - _Requirements: 4.4, 4.5, 4.6, 4.7, 6.1, 7.2, 7.7, 8.1, 12.5, 13.3, 13.5, 17.1_

  - [x] 3.3 Implement `parseOverrides` and `loadConfig`
    - Use `URLSearchParams`; ignore and warn on unknown names, empty values and non-finite numbers; last value wins
    - `loadConfig(search, log)` builds and validates; on invalid overrides it logs all violated rules and returns `DEFAULT_CONFIG`
    - _Requirements: 1.6, 4.4, 4.7, 13.5_

  - [x] 3.4 Create shared test helpers
    - Create `tests/helpers/arbitraries.js` with `arbConfig` (tunable values drawn relative to their defaults, built with `buildConfig`, kept only if `validateConfig` accepts), plus generators for ghost states, pipe lists, `dt` in (0, `MAX_DT`], scores, rectangles and circles, and arbitrary storage strings
    - Add a seeded `rng` helper and fake storage helpers (including one that throws)
    - _Requirements: 4.4, 4.5_

  - [x] 3.5 Write property test for config validation
    - Create `tests/props/p43-config-validation.test.js`
    - **Property 43: Config validation accepts the defaults and rejects each broken relationship**
    - Use one mutation function per rule id, plus a combination case checking that all rule ids are reported
    - **Validates: Requirements 4.4, 4.5, 4.6, 4.7, 6.1, 7.2, 7.7, 8.1, 12.5, 13.3, 13.5, 17.1**

  - [x] 3.6 Write property test for derived values
    - Create `tests/props/p44-derived-values.test.js`
    - **Property 44: Derived values follow from base values**
    - Include a check that derived keys passed as overrides are ignored and that the config is frozen at every level
    - **Validates: Requirements 4.5, 6.1, 6.3, 13.5, 17.1**

  - [x] 3.7 Write property test for JSON mapping round trip
    - Create `tests/props/p45-json-mapping.test.js`
    - **Property 45: JSON mapping round trip**
    - Generate JSON-shaped objects with the structure of `game-config.json`, including a `_comment` key that must be ignored
    - **Validates: Requirements 1.6**

  - [x] 3.8 Write property test for URL overrides
    - Create `tests/props/p46-url-overrides.test.js`
    - **Property 46: URL overrides are whitelisted, numeric and always yield a valid config**
    - Generate query strings from whitelisted finite numbers, whitelisted non-numeric text and unknown names, with a fake logger recording warnings
    - **Validates: Requirements 1.6, 4.4, 4.7, 13.5**

  - [x] 3.9 Write unit tests for config
    - Create `tests/unit/config.test.js`
    - Cover: default config is valid and deeply frozen; default values match the requirements (gravity 800, jump velocity -300, wall speed 120, gap height 140, pipe spacing 350, max gap shift 160, max speed 240, sprite size 32, hitbox radius 12); reachability gives 3 jumps, 1.125 s climb and about 0.632 s fall, both below `350 / 240`; missing `GAME_CONFIG` and an invalid default make startup throw with a clear message; `?gravity=1500&gapHeight=180` applies; `?gravity=abc`, `?gravity=` and `?foo=1` are ignored with a warning; `?gapHeight=20` falls back to defaults with a warning naming `gap.heightVsHitbox`; `arbConfig` rejects few candidates
    - _Requirements: 4.4, 4.7, 1.6_

- [x] 4. Implement physics (`src/physics.js`)
  - [x] 4.1 Implement ghost motion and tilt
    - `stepGhost(cfg, ghost, dt)` with semi-implicit Euler, `applyJump(cfg, ghost)` setting `JUMP_VELOCITY`, `tiltFor(vy)`, `clampDt(cfg, rawSeconds)`
    - _Requirements: 3.1, 3.2, 3.5, 3.6, 3.7, 12.5_

  - [x] 4.2 Write property test for gravity integration
    - Create `tests/props/p01-gravity.test.js`
    - **Property 1: Gravity integration**
    - **Validates: Requirements 3.1, 3.6**

  - [x] 4.3 Write property test for jump velocity
    - Create `tests/props/p02-jump.test.js`
    - **Property 2: Jump sets a fixed upward velocity**
    - **Validates: Requirements 3.2**

  - [x] 4.4 Write property test for tilt
    - Create `tests/props/p03-tilt.test.js`
    - **Property 3: Tilt follows the direction of motion**
    - **Validates: Requirements 3.5, 3.7**

  - [x] 4.5 Write property test for frame time clamp
    - Create `tests/props/p04-clamp-dt.test.js`
    - **Property 4: Frame time is clamped**
    - **Validates: Requirements 12.5**

- [x] 5. Implement pipes (`src/pipes.js`)
  - [x] 5.1 Implement pipe generation, movement and geometry
    - `gapCenterRange`, `chooseGapCenter` (clamp out-of-range `rng` values), `speedForScore`, `spawnPair`, `shouldSpawn`, `movePairs`, `removeOffscreen`, `pipeRects`
    - First pair of a round spawns at `x = WIDTH`; new pairs spawn when the last pair's `x <= SPAWN_X`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8, 4.10, 4.12_

  - [x] 5.2 Write property test for gap placement
    - Create `tests/props/p05-gap-position.test.js`
    - **Property 5: Gap position respects margins and shift limit**
    - **Validates: Requirements 4.5, 4.6**

  - [x] 5.3 Write property test for pipe geometry
    - Create `tests/props/p06-pipe-geometry.test.js`
    - **Property 6: Pipe pair geometry**
    - **Validates: Requirements 4.3, 4.4, 6.2**

  - [x] 5.4 Write property test for spawn rule
    - Create `tests/props/p07-spawn-rule.test.js`
    - **Property 7: Spawn rule**
    - **Validates: Requirements 4.2**

  - [x] 5.5 Write property test for scroll speed curve
    - Create `tests/props/p08-speed-curve.test.js`
    - **Property 8: Scroll speed curve**
    - **Validates: Requirements 4.10**

  - [x] 5.6 Write property test for off-screen removal
    - Create `tests/props/p10-offscreen-removal.test.js`
    - **Property 10: Off-screen pairs are removed**
    - **Validates: Requirements 4.12**

- [x] 6. Implement collision detection (`src/collision.js`)
  - [x] 6.1 Implement circle hitbox and nearest-point tests
    - `ghostCircle`, `nearestPoint`, `distanceSqToRect`, `circleHitsRect` (strict: distance squared below radius squared), `hitsPipe` (union of body and cap), `hitsGround` (`y + HITBOX_RADIUS >= GROUND_TOP`), `hitsCeiling` (`y - HITBOX_RADIUS <= 0`), `detect(cfg, ghost, pairs, invincible)`
    - A center inside a rectangle has distance 0; the margin outside the circle takes no part in any test; the pipe test is skipped when invincible while ground and ceiling are always tested
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 7.9, 7.10_

  - [x] 6.2 Write property test for the ghost hitbox
    - Create `tests/props/p14-ghost-hitbox.test.js`
    - **Property 14: Ghost hitbox is a circle centered on the sprite**
    - **Validates: Requirements 3.4, 6.1**

  - [x] 6.3 Write property test for circle against rectangle
    - Create `tests/props/p15-circle-rect.test.js`
    - **Property 15: Circle against rectangle uses a strict nearest-point distance**
    - Use a dedicated generator for exact-touch cases with integer and half-integer coordinates, and a diagonal-corner generator checked with a small tolerance on either side of the radius
    - **Validates: Requirements 6.6, 6.10, 6.11**

- [x] 7. Implement clouds (`src/clouds.js`)
  - [x] 7.1 Implement cloud creation, movement and wrap
    - `createClouds(cfg, rng)` using `LAYER_SPEEDS` and layer alpha; `moveClouds(cfg, clouds, dt)` with wrap beyond the right edge and unchanged `y`
    - _Requirements: 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.11_

  - [x] 7.2 Write property test for cloud creation
    - Create `tests/props/p24-cloud-creation.test.js`
    - **Property 24: Cloud creation rules**
    - **Validates: Requirements 13.2, 13.3, 13.4, 13.5**

  - [x] 7.3 Write property test for cloud movement
    - Create `tests/props/p25-cloud-movement.test.js`
    - **Property 25: Cloud movement and wrap**
    - **Validates: Requirements 13.6, 13.7, 13.11**

- [x] 8. Implement animation (`src/animation.js`)
  - [x] 8.1 Implement frame selection and placement
    - `frameAt`, `idleFrame`, `flapFrame`, `deathFrame` (timed frames then `DEATH_FINAL` held), `currentFrame(state)` choosing the animation from mode and timers, `frameDest` (the `SPRITE_SIZE` square centered on `(X, y)`), `sheetSource` (`index * SPRITE_SIZE` strip rectangle)
    - Frame descriptions carry index, sheet index, offset, scale, rotation and tint; idle and flap frames use `tiltFor(vy)` for rotation and death frames use the table rotation
    - With a sprite sheet the transform fields are identity; without it the same description drives runtime transforms of `ghosty.png`
    - _Requirements: 3.5, 3.7, 7.2, 7.14, 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7_

  - [x] 8.2 Write property test for idle frame selection
    - Create `tests/props/p29-idle-frame.test.js`
    - **Property 29: Idle frame selection**
    - Compare with an independent cumulative-sum implementation inside the test
    - **Validates: Requirements 18.1**

  - [x] 8.3 Write property test for flap frame selection
    - Create `tests/props/p30-flap-frame.test.js`
    - **Property 30: Flap frame selection and return to idle**
    - **Validates: Requirements 18.2, 18.4**

  - [x] 8.4 Write property test for death frames
    - Create `tests/props/p32-death-frames.test.js`
    - **Property 32: Death frames cover the crash and then hold**
    - **Validates: Requirements 7.2, 7.14, 18.5**

  - [x] 8.5 Write property test for frame placement
    - Create `tests/props/p33-frame-placement.test.js`
    - **Property 33: Frame placement and sheet source rectangles**
    - **Validates: Requirements 18.6, 18.7**

- [x] 9. Implement menu (`src/menu.js`)
  - [x] 9.1 Implement menu model, layout and hit testing
    - `initialMenu`, `buttonsFor(mode, menu)`, `buttonRect(cfg, name)` for PLAY, HIGH_SCORES, BACK and RESTART, `iconRect(cfg, name)` for MUTE and PAUSE, `iconsVisible(mode)`, `hitTest(cfg, state, x, y)` using half-open rectangles and only controls that exist in the current mode, `navigate(menu, dir)` wrapping over the button list and ignored while the panel is open, `activate(menu, name)` for HIGH_SCORES and BACK
    - _Requirements: 17.1, 17.2, 17.3, 17.5, 17.6, 17.8, 17.9, 17.10_

  - [x] 9.2 Write property test for menu navigation
    - Create `tests/props/p36-menu-navigation.test.js`
    - **Property 36: Menu navigation**
    - **Validates: Requirements 17.2, 17.3**

  - [x] 9.3 Write property test for layout and hit testing
    - Create `tests/props/p39-layout-hit-testing.test.js`
    - **Property 39: Layout and hit testing**
    - **Validates: Requirements 17.1, 17.8, 17.9, 17.10**

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement score store (`src/scoreStore.js`)
  - [x] 11.1 Implement High_Score persistence
    - `parseHighScore`, `load`, `save`, `recordIfHigher` using the key `flappyKiro.highScore`, with try/catch around every storage access
    - _Requirements: 2.4, 16.1, 16.2, 16.3, 16.5_

  - [x] 11.2 Write property test for high score round trip
    - Create `tests/props/p26-highscore-roundtrip.test.js`
    - **Property 26: High score round trip**
    - **Validates: Requirements 16.2, 16.4**

  - [x] 11.3 Write property test for invalid stored values
    - Create `tests/props/p27-invalid-stored.test.js`
    - **Property 27: Invalid stored values read as zero**
    - **Validates: Requirements 16.3**

  - [x] 11.4 Write property test for stored maximum
    - Create `tests/props/p28-stored-max.test.js`
    - **Property 28: Stored high score is the maximum**
    - **Validates: Requirements 16.1, 16.5**

- [ ] 12. Implement game state machine (`src/game.js`)
  - [x] 12.1 Implement `GameState`, `createGame` and `startRound`
    - `createGame(cfg, highScore, rng)` starts in `Main_Menu` with the ghost at `MENU_GHOST_Y`, `menu = initialMenu()`, clouds created and animation timers at their initial values
    - `startRound` resets score, speed, pipes, ghost, invincibility, `newHighScore`, `deathMs`, closes the High_Scores_Panel, applies the jump, sets `flapMs = 0` and returns a `jump` event; all start and restart paths call it
    - _Requirements: 1.2, 2.2, 2.3, 4.9, 4.14, 5.3, 7.7, 8.2, 15.1, 17.2, 17.4, 18.3_

  - [x] 12.2 Implement `handleInput` with the Input Routing table
    - Handle `space`, `enter`, `up`, `down`, `pause`, `hidden` and `pointer` inputs per the design table for Main_Menu (panel closed and open), Playing, Paused and Game_Over (lockout active and over)
    - Pointer hit testing comes first: buttons and icons win over the Jump_Input fallback; mute icon emits `toggleMute`; pause icon equals Pause_Input and never jumps
    - Allow only the five permitted transitions; ignore pause in Main_Menu and Game_Over; ignore jump in Paused and during the 500 ms lockout; RESTART follows the same lockout as Jump_Input; `hidden` pauses when Playing; ignore unrelated pointers while the panel is open
    - _Requirements: 8.1, 8.2, 8.4, 10.6, 10.7, 12.3, 14.1, 14.2, 14.3, 14.8, 15.2, 15.3, 15.4, 15.5, 15.7, 15.8, 15.9, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.12, 17.13_

  - [x] 12.3 Implement `update` for all modes
    - Playing: decrement invincibility, advance `flapMs`, step ghost, move pipes, ground and clouds at the shared speed, remove and spawn pairs, score pairs once and emit one `scored` event per increase, recompute speed, run `detect`, and on a hit switch to Game_Over, end invincibility, reset `deathMs`, start crash and lockout timers and emit `gameOver` with `previousHighScore`
    - Game_Over: advance only the crash animation (ghost falls until the circle bottom reaches `GROUND_TOP`, then `y` is clamped), `deathMs` and timers; set `newHighScore` when the score exceeds the stored high score
    - Main_Menu: advance only `animClockMs`; Paused: change nothing
    - _Requirements: 3.1, 4.2, 4.8, 4.11, 4.13, 5.1, 5.4, 5.5, 6.5, 6.6, 6.7, 6.8, 7.2, 7.3, 7.6, 7.8, 7.11, 7.12, 7.13, 9.6, 13.8, 14.4, 14.6, 14.7, 18.1, 18.2, 18.5, 19.1, 19.7_

  - [x] 12.4 Create game test helpers
    - Create `tests/helpers/game-arbs.js` with generators for game states in each mode, input sequences over `space`, `enter`, `up`, `down`, `pointer` (points inside and outside every control rectangle taken from the config), `pause` and `hidden`, and a runner that applies inputs and updates while recording mode changes and events
    - _Requirements: 15.8, 17.1_

  - [x] 12.5 Write property test for synchronized scrolling
    - Create `tests/props/p09-scroll-together.test.js`
    - **Property 9: Pipes and ground scroll together**
    - **Validates: Requirements 4.8, 4.11, 9.6**

  - [x] 12.6 Write property test for frozen world
    - Create `tests/props/p11-frozen-world.test.js`
    - **Property 11: World is frozen outside Playing**
    - **Validates: Requirements 2.3, 4.13, 7.3, 13.8, 14.4, 14.6, 14.7**

  - [x] 12.7 Write property test for round start
    - Create `tests/props/p12-round-start.test.js`
    - **Property 12: Round start resets the round**
    - **Validates: Requirements 2.2, 4.9, 4.14, 5.3, 7.7, 8.2, 17.4**

  - [x] 12.8 Write property test for scoring
    - Create `tests/props/p13-scoring.test.js`
    - **Property 13: Scoring counts each passed pair once**
    - **Validates: Requirements 5.1, 5.4, 5.5**

  - [x] 12.9 Write property test for collision outcomes
    - Create `tests/props/p16-collision-outcomes.test.js`
    - **Property 16: Collision outcomes**
    - **Validates: Requirements 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 7.9, 7.10, 15.6**

  - [x] 12.10 Write property test for invincibility
    - Create `tests/props/p17-invincibility.test.js`
    - **Property 17: Invincibility timer and blink**
    - **Validates: Requirements 7.8, 7.11, 7.12, 7.13**

  - [x] 12.11 Write property test for crash animation
    - Create `tests/props/p18-crash-animation.test.js`
    - **Property 18: Crash animation stays above the ground**
    - **Validates: Requirements 7.2, 7.4**

  - [x] 12.12 Write property test for new high score flag
    - Create `tests/props/p19-new-high-score.test.js`
    - **Property 19: New high score indication**
    - **Validates: Requirements 7.6, 17.11**

  - [x] 12.13 Write property test for input lockout
    - Create `tests/props/p20-lockout.test.js`
    - **Property 20: Game over input lockout**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 15.7**

  - [x] 12.14 Write property test for state machine transitions
    - Create `tests/props/p21-state-machine.test.js`
    - **Property 21: State machine only takes permitted transitions**
    - **Validates: Requirements 10.6, 12.3, 14.1, 14.2, 14.8, 15.2, 15.3, 15.4, 15.5, 15.8, 15.9, 17.5, 17.6**

  - [ ] 12.15 Write property test for flap restart
    - Create `tests/props/p31-flap-restart.test.js`
    - **Property 31: Flap restarts on every jump**
    - **Validates: Requirements 18.3**

  - [ ] 12.16 Write property test for score events
    - Create `tests/props/p34-score-events.test.js`
    - **Property 34: One score event per score increase**
    - **Validates: Requirements 5.1, 19.1, 19.7**

  - [ ] 12.17 Write property test for menu activation
    - Create `tests/props/p37-menu-activation.test.js`
    - **Property 37: Menu activation by Space, Enter or pointer**
    - **Validates: Requirements 10.7, 17.4, 17.5, 17.6**

  - [ ] 12.18 Write property test for the panel ignoring other input
    - Create `tests/props/p38-panel-ignores-input.test.js`
    - **Property 38: Panel ignores other input**
    - **Validates: Requirements 17.7**

  - [ ] 12.19 Write property test for the pause icon
    - Create `tests/props/p41-pause-icon.test.js`
    - **Property 41: Pause icon is equivalent to Pause_Input**
    - **Validates: Requirements 14.3, 17.8**

  - [ ] 12.20 Write property test for RESTART
    - Create `tests/props/p42-restart-equivalence.test.js`
    - **Property 42: RESTART is equivalent to Jump_Input**
    - **Validates: Requirements 17.12, 17.13, 8.1, 8.2**

  - [ ] 12.21 Write property test for behavior across valid configs
    - Create `tests/props/p47-valid-config-variations.test.js`
    - **Property 47: Gameplay behavior holds for any valid config**
    - Re-run the pipe, collision, scoring, lockout and animation properties against `arbConfig` and check that a circle placed at a chosen gap center does not collide and fits inside the gap
    - **Validates: Requirements 4.4, 4.5, 4.6, 5.1, 6.1, 6.6, 6.7, 6.8, 6.9, 6.10**

  - [ ] 12.22 Write unit tests for game
    - Create `tests/unit/game.test.js`
    - Cover: initial state is Main_Menu with PLAY selected and empty storage reading 0; clouds do not affect score or collisions; first frame delta after a hidden tab is small; Enter on the selected button in Main_Menu does not act as a jump
    - _Requirements: 1.2, 2.4, 12.4, 13.9, 13.10, 15.1, 17.2_

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Implement audio (`src/audio.js`)
  - [x] 14.1 Implement Audio_Player and `soundsFor`
    - `createAudioPlayer({ jump, score, game_over })` with `play(name)` (no-op when muted or element missing; reset `currentTime = 0`; catch `play()` rejection), `toggleMute`, `isMuted`
    - `soundsFor(events)` returns one sound name per `jump`, `scored` and `gameOver` event in order (`jump`, `score`, `game_over`) and none for other events
    - _Requirements: 3.3, 7.1, 8.3, 11.1, 11.2, 11.3, 11.4, 19.1, 19.4, 19.5, 19.6_

  - [x] 14.2 Write property test for mute
    - Create `tests/props/p23-mute.test.js`
    - **Property 23: Mute suppresses every sound**
    - **Validates: Requirements 11.2, 11.4, 19.4**

  - [ ] 14.3 Write property test for event to sound mapping
    - Create `tests/props/p35-events-to-sounds.test.js`
    - **Property 35: Events map one to one onto sounds**
    - **Validates: Requirements 3.3, 7.1, 8.3, 19.1**

  - [x] 14.4 Write unit tests for audio
    - Create `tests/unit/audio.test.js`
    - Cover mock audio: `currentTime` reset on replay, rejecting `play()` is swallowed, a missing element is a no-op for that sound only, a missing score element leaves jump and game over sounds working
    - _Requirements: 11.3, 11.4, 19.5, 19.6_

- [x] 15. Create and load assets
  - [x] 15.1 Generate `assets/score.wav` with a script
    - Create `scripts/generate-score-wav.js` that writes a 16-bit mono PCM WAV of about 0.2 s: two soft sine tones a major third apart with a short fade in and fade out, following `audio-assets.md`
    - Export a pure `buildScoreWav()` returning the bytes, and run the script once to create `assets/score.wav`
    - _Requirements: 1.3, 19.1_

  - [x] 15.2 Write unit tests for the generated WAV
    - Create `tests/unit/score-wav.test.js`
    - Check the RIFF/WAVE header, PCM format, a duration of about 0.2 s, non-silent samples within range, and that `assets/score.wav` exists; print the duration of `jump.wav` and `game_over.wav` against the targets as information only without failing
    - _Requirements: 19.1, 19.2, 19.3_

  - [x] 15.3 Implement independent asset loading with fallbacks
    - Load `assets/ghosty.png`, `assets/jump.wav`, `assets/score.wav` and `assets/game_over.wav` independently, plus the optional `ghosty-sheet.png`
    - A failed sprite becomes a drawn 24 by 24 white square centered on the ghost center, a failed sound becomes silence, a missing sheet silently falls back to runtime transforms of `ghosty.png`
    - _Requirements: 1.3, 1.4, 1.5, 1.7, 18.6, 19.6_

  - [x] 15.4 Write unit tests for asset fallbacks
    - Create `tests/unit/assets.test.js`
    - Run the table over all 16 subsets of failed assets (ghosty.png, jump.wav, score.wav, game_over.wav) and check only failed assets are replaced; check the missing sheet fallback
    - _Requirements: 1.4, 1.5, 1.7, 19.6_

- [x] 16. Implement input handling (`src/input.js`)
  - [x] 16.1 Implement input mapping and pointer coordinates
    - Space maps to `space` with `preventDefault`; Enter to `enter`; ArrowUp and ArrowDown to `up` and `down`; P and Escape to `pause`; M toggles mute; events with `repeat === true` are ignored
    - `mousedown` and `touchstart` on the canvas map to `{ kind: 'pointer', x, y }` using `toLogical(cfg, rect, clientX, clientY)` with `(clientX - rect.left) * WIDTH / rect.width` and the same for y
    - `visibilitychange` with hidden maps to `hidden`
    - _Requirements: 9.1, 10.1, 10.2, 10.3, 10.4, 10.5, 10.7, 11.1, 12.3, 14.3, 17.3_

  - [x] 16.2 Write property test for key repeat
    - Create `tests/props/p22-key-repeat.test.js`
    - **Property 22: Key repeat is ignored**
    - **Validates: Requirements 10.5**

  - [x] 16.3 Write property test for pointer coordinate mapping
    - Create `tests/props/p40-pointer-mapping.test.js`
    - **Property 40: Pointer coordinate mapping**
    - **Validates: Requirements 9.1, 10.2, 10.3**

  - [x] 16.4 Write unit tests for input wiring
    - Create `tests/unit/input.test.js`
    - Cover Space, Enter, arrow keys, click and touch mapping, that Space calls `preventDefault`, and that a click on a scaled canvas converts to the right logical point
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.7, 14.3_

- [x] 17. Implement renderer (`src/renderer.js`)
  - [x] 17.1 Implement world and ghost drawing
    - Draw in order: sky, clouds (with alpha), pipes with caps, scrolling ground, ghost, score
    - Draw the ghost from the `FrameDesc` of `currentFrame`: translate to the ghost center, apply rotation and scale, draw the `SPRITE_SIZE` base rectangle from `ghosty.png` or from the sheet via `sheetSource`, use a tinted copy for white flashes, hide on odd `BLINK_MS` intervals during invincibility, draw a placeholder when the sprite is missing
    - Disable image smoothing, use `"Press Start 2P", monospace`, use the palette from `ui-mockups.md` as drawing constants, and scale the canvas with CSS while preserving the 480:640 ratio
    - _Requirements: 1.4, 1.7, 3.5, 3.7, 5.2, 7.2, 7.8, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 13.1, 13.2, 18.1, 18.2, 18.5, 18.6, 18.7_

  - [x] 17.2 Implement menu, HUD and overlays
    - Main_Menu: title, idle ghost at `MENU_GHOST_Y`, PLAY and HIGH SCORES buttons with a white border on the selected one, BEST value and the start hint; icons hidden
    - High_Scores_Panel: "BEST: N" and the BACK button
    - Playing and Paused: score at top center, mute icon top left and pause icon top right (`ICON_SIZE` with `ICON_MARGIN`); Paused adds a dim, "PAUSED" and the resume hint
    - Game_Over after the crash animation: "GAME OVER", panel with SCORE and BEST, "NEW BEST!" in the highlight color only when `newHighScore` is true, the RESTART button and the restart hint
    - _Requirements: 2.1, 2.4, 5.2, 7.4, 7.5, 7.6, 14.5, 16.6, 17.1, 17.2, 17.5, 17.8, 17.9, 17.10, 17.11, 17.14_

  - [x] 17.3 Write unit tests for renderer
    - Create `tests/unit/renderer.test.js`
    - Using a mock canvas, check overlay text and buttons for menu, panel, paused and game over, the selected-button border, "NEW BEST!" shown only for a new high score, icon positions, score display, clouds drawn first, smoothing disabled, and that idle, flap and death frames produce the expected translate, rotate and scale calls (with the sheet source rectangle when a sheet is present)
    - _Requirements: 2.1, 5.2, 7.4, 7.5, 9.5, 13.1, 14.5, 16.6, 17.1, 17.5, 17.8, 17.10, 17.11, 18.6, 18.7_

- [ ] 18. Integration and wiring
  - [x] 18.1 Create `index.html`
    - Canvas 480 by 640 with CSS scaling and `image-rendering: pixelated`
    - Three audio elements for `assets/jump.wav`, `assets/score.wav` and `assets/game_over.wav`
    - Classic `<script>` tags in dependency order with `src/game-config.js` loaded before `src/config.js` (no ES modules, no network requests)
    - An element where a startup config error message can be shown in place of the canvas
    - _Requirements: 1.1, 1.3, 1.6, 9.1, 9.5, 11.1, 19.1_

  - [x] 18.2 Implement `src/main.js` loop and wiring
    - Call `loadConfig(location.search, console)`; on a thrown config error show the message in place of the canvas
    - Create the game with the stored High_Score, run the `requestAnimationFrame` loop with `dt = clampDt(...)`, reset the last timestamp when the tab becomes visible
    - Route input to `handleInput`; play sounds from `soundsFor(events)`; handle `toggleMute` events; on `gameOver` call `recordIfHigher`; render every frame
    - _Requirements: 1.2, 3.3, 7.1, 8.3, 11.1, 12.1, 12.4, 12.5, 16.1, 16.2, 19.1_

  - [ ] 18.3 Write integration tests for the main loop wiring
    - Create `tests/unit/main-wiring.test.js`
    - With mocked storage, audio and canvas, simulate a start, a score, a crash and a restart; check one jump sound per jump, one score sound per score, one game over sound per crash, and High_Score saved only when higher
    - _Requirements: 3.3, 7.1, 8.3, 16.1, 16.5, 19.1_

- [ ] 19. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (all 47 are covered) and run at least 100 iterations each, tagged `Feature: flappy-kiro, Property N: ...`
- Property tests read every expected value from the config in use and contain no literal copies of config numbers
- Each property test has its own file under `tests/props/` so tasks in the same wave never write the same file
- After editing `game-config.json`, run `npm run sync-config` to regenerate `src/game-config.js`
- Unit tests validate specific examples and edge cases

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "15.1"] },
    { "id": 2, "tasks": ["2.2", "3.1", "15.2"] },
    { "id": 3, "tasks": ["3.2"] },
    { "id": 4, "tasks": ["3.3", "3.4", "4.1", "5.1", "6.1", "7.1", "8.1", "9.1", "11.1", "14.1", "15.3", "16.1"] },
    { "id": 5, "tasks": ["3.5", "3.6", "3.7", "3.8", "3.9", "4.2", "4.3", "4.4", "4.5", "5.2", "5.3", "5.4", "5.5", "5.6", "6.2", "6.3", "7.2", "7.3", "8.2", "8.3", "8.4", "8.5", "9.2", "9.3", "11.2", "11.3", "11.4", "12.1", "14.2", "14.4", "15.4", "16.2", "16.3", "16.4", "17.1", "18.1"] },
    { "id": 6, "tasks": ["12.2", "12.4", "17.2"] },
    { "id": 7, "tasks": ["12.3", "17.3"] },
    { "id": 8, "tasks": ["12.5", "12.6", "12.7", "12.8", "12.9", "12.10", "12.11", "12.12", "12.13", "12.14", "12.15", "12.16", "12.17", "12.18", "12.19", "12.20", "12.21", "12.22", "14.3", "18.2"] },
    { "id": 9, "tasks": ["18.3"] }
  ]
}
```
