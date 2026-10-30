# Requirements Document

## Introduction

Ghosty's Journey extends Flappy Kiro with four themed worlds (Sky, Forest, Castle, Space), world transitions, visual juice, medals and unlockable skins. It reuses the existing modules (`config.js`, `game.js`, `renderer.js`, `scoreStore.js`, `input.js`, `menu.js`) and the invincibility system. Every score threshold is derived from one tunable, `cfg.world.POINTS_PER_WORLD` (URL name `pointsPerWorld`, default 5). No existing module is rewritten.

Constraints: no new property-based tests, at most one small unit test per new module, and the existing 52 vitest test files keep passing. The agent cannot drive a browser, so the user verifies each feature by running the game (`python3 -m http.server 8000`, with `?world=…` and URL overrides).

## Glossary

- **Game**: the Flappy Kiro simulation in `game.js` and its shell in `main.js`.
- **Config_Validator**: `validateConfig` in `config.js`.
- **Config_Loader**: `loadConfig` in `config.js`.
- **Score_Store**: `scoreStore.js`.
- **Renderer**: `renderer.js` and the draw-only helper `worldArt.js`.
- **P**: the value of `cfg.world.POINTS_PER_WORLD`.
- **World_Index**: an absolute integer, `floor(score / P)`, that keeps counting across loops.
- **World_Kind**: `World_Index mod 4`: 0 Sky, 1 Forest, 2 Castle, 3 Space.
- **Loop**: `floor(World_Index / 4)`. Loop 0 is the first pass; "LOOP 2" is Loop 1.
- **World_Config**: the base `cfg` with one world's numeric overlay merged on top and re-derived.
- **Transition**: the phase between reaching a world threshold and starting the new world (drain, then title card).
- **Title_Card**: the "WORLD n - THE NAME" banner shown during a Transition.
- **Gust**: a smooth vertical wind force in the Forest, telegraphed before it starts.
- **Moving_Gap**: a Castle gap whose center slides on a sine wave around a base center.
- **Particle**: a cosmetic object (puff, leaf, stardust, "+1") that never affects physics or collision.
- **Medal**: Bronze, Silver, Gold or Platinum, earned at 1×P, 2×P, 3×P and 4×P.
- **Skin**: a cosmetic Ghosty appearance or trail style unlocked by the best Medal.

## Requirements

### Requirement 1: Configurable world length

**User Story:** As a player or tester, I want to set how many points each world lasts, so that I can test and record quickly.

#### Acceptance Criteria

1. THE Game SHALL read `cfg.world.POINTS_PER_WORLD` with a default value of 5.
2. THE Game SHALL accept the URL parameter `pointsPerWorld` as an override of `cfg.world.POINTS_PER_WORLD`.
3. IF `POINTS_PER_WORLD` is not an integer greater than or equal to 1, THEN THE Config_Validator SHALL report rule `world.pointsPerWorld` and THE Game SHALL fall back to the default config.
4. THE Game SHALL derive every world, medal and skin threshold from P, with no hard-coded point values.

### Requirement 2: World index and starting world

**User Story:** As a developer, I want to start directly in any world, so that I can test and record each one.

#### Acceptance Criteria

1. THE Game SHALL compute World_Index as `floor(score / P)` and World_Kind as World_Index modulo 4.
2. WHEN the URL contains `?world=sky|forest|castle|space`, THE Game SHALL start each round with score equal to that world's index times P and World_Index set to that index.
3. IF the `world` parameter has any other value, THEN THE Game SHALL log a warning and start in Sky.
4. WHEN a round restarts after Game_Over, THE Game SHALL start it in the same world as the previous start.

### Requirement 3: World configuration overlays

**User Story:** As a developer, I want each world to be a validated config overlay, so that physics and difficulty stay consistent.

#### Acceptance Criteria

1. THE Game SHALL build one World_Config per World_Kind and Loop by merging a numeric overlay onto the base `cfg`.
2. THE overlays SHALL change only ghost gravity, ghost jump velocity, speed values and twist values, so pipe collision geometry is identical in every world.
3. WHEN the config loads, THE Config_Loader SHALL validate every World_Config with `validateConfig` and fall back to the default config if any fails.
4. THE Config_Validator SHALL include the Gust and Moving_Gap parameters in the `reach.fall` and `reach.climb` rules.

### Requirement 4: World transitions

**User Story:** As a player, I want a clear moment when a new world begins, so that progress feels earned.

#### Acceptance Criteria

1. WHEN floor(score / P) exceeds the current World_Index, THE Game SHALL start a Transition and stop spawning obstacles.
2. WHILE a Transition is draining, THE Game SHALL let existing obstacles scroll off the screen.
3. WHEN no obstacles remain, THE Game SHALL show the Title_Card for `TITLE_CARD_MS` (1500 ms) with a fade in and fade out.
4. WHILE the Title_Card is shown, THE Renderer SHALL crossfade the background palette from the old world to the new world.
5. WHEN the Title_Card ends, THE Game SHALL switch to the new World_Config, resume spawning and start `WORLD_INVINCIBILITY_MS` (1000 ms) of invincibility using the existing blink system.
6. WHEN a new world starts, THE Game SHALL emit a `worldEntered` event.

### Requirement 5: Forest world

**User Story:** As a player, I want a forest with fair, readable wind.

#### Acceptance Criteria

1. WHILE the world is Forest, THE Renderer SHALL draw tree-trunk obstacles with leafy caps, a green palette and falling leaves inside the existing obstacle rectangles.
2. WHILE the world is Forest, THE Game SHALL apply Gusts as a vertical force that ramps smoothly up and down over `WIND_RAMP_MS`.
3. WHEN a Gust is scheduled, THE Game SHALL telegraph it for `WIND_TELEGRAPH_MS` (1000 ms) before the force begins.
4. WHILE a Gust is telegraphed or active, THE Renderer SHALL stream leaves in the Gust direction and show an arrow icon.
5. IF `WIND_FORCE` is not less than half of gravity, THEN THE Config_Validator SHALL report rule `twist.windVsGravity`.

### Requirement 6: Castle world

**User Story:** As a player, I want castle gaps that drift slowly, so that timing matters without becoming unfair.

#### Acceptance Criteria

1. WHILE the world is Castle, THE Renderer SHALL draw stone pillars with battlement caps, a dark stone palette and flickering torches.
2. WHILE the world is Castle, THE Game SHALL move each gap center on a sine wave of amplitude `GAP_AMPLITUDE` and period `GAP_PERIOD_S` around its base center.
3. THE Game SHALL keep every Moving_Gap center between `GAP_CENTER_MIN` and `GAP_CENTER_MAX`.
4. IF the peak gap speed `GAP_AMPLITUDE × 2π / GAP_PERIOD_S` exceeds half of the jump speed, THEN THE Config_Validator SHALL report rule `twist.gapFollow`.

### Requirement 7: Space world

**User Story:** As a player, I want a floaty Space world that stays controllable.

#### Acceptance Criteria

1. WHILE the world is Space, THE Game SHALL use a lower gravity and a weaker jump velocity than Sky.
2. WHILE the world is Space, THE Renderer SHALL draw asteroid columns, a black sky and twinkling stars.
3. WHEN the ghost touches the ceiling in Space, THE Game SHALL end the round as in every other world.
4. THE Space World_Config SHALL satisfy `reach.fall` and `reach.climb`.

### Requirement 8: Looping and difficulty ramp

**User Story:** As a player, I want the journey to repeat harder, so that long runs stay interesting.

#### Acceptance Criteria

1. WHEN World_Index reaches 4, THE Game SHALL return to Sky and show "LOOP 2" on the Title_Card, then "LOOP 3" and so on.
2. THE Game SHALL start each world's initial speed above the previous world's initial speed.
3. WHEN a world starts, THE Game SHALL restart the speed ramp from that world's initial speed.
4. THE Game SHALL multiply initial and maximum speeds by `LOOP_SPEED_FACTOR` (1.1) per Loop, up to the largest Loop for which every World_Config validates.
5. THE Game SHALL compute speed from the score earned inside the current world.

### Requirement 9: Juice

**User Story:** As a player, I want feedback on my actions.

#### Acceptance Criteria

1. WHEN the ghost flaps, THE Game SHALL emit a puff of Particles below Ghosty colored for the current world.
2. WHEN the score increases, THE Game SHALL float a "+1" upward while it fades.
3. WHEN the ghost crashes, THE Renderer SHALL shake the screen for 200 ms in addition to the existing white flash.
4. WHILE the Title_Card is shown, THE Game SHALL emit a short burst of Particles.
5. THE Particles SHALL NOT change ghost state, obstacle state, scoring or collision results.
6. THE Particle system SHALL NOT consume values from the gameplay `rng`.

### Requirement 10: Medals

**User Story:** As a player, I want a medal for how far I got.

#### Acceptance Criteria

1. THE Game SHALL award Bronze at score >= 1×P, Silver at >= 2×P, Gold at >= 3×P and Platinum at >= 4×P.
2. IF the score is below 1×P, THEN THE Game SHALL award no Medal.
3. WHEN Game_Over is shown, THE Renderer SHALL draw the run's Medal next to the score and the best Medal next to the best score.

### Requirement 11: Trail, best medal storage and skins

**User Story:** As a player, I want to unlock and choose skins.

#### Acceptance Criteria

1. WHILE a round is in Playing, THE Renderer SHALL draw a trail of the last 8 ghost positions with decreasing opacity.
2. WHEN a run earns a better Medal than the stored one, THE Score_Store SHALL save the Medal in local storage using the same try/catch read and write pattern as the high score.
3. IF local storage is unavailable or holds an invalid value, THEN THE Score_Store SHALL read the best Medal as none.
4. THE Game SHALL unlock Pumpkin Ghosty at Bronze, Rainbow trail at Silver, Gold Ghosty at Gold and Starfield at Platinum.
5. WHEN the player presses Left or Right, or clicks a selector arrow, on the main menu, THE Game SHALL cycle the selected Skin.
6. WHILE a Skin is locked, THE Renderer SHALL show it as locked and THE Game SHALL not select it.
