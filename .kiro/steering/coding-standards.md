---
inclusion: fileMatch
fileMatchPattern: ["**/*.js", "index.html"]
---

# Flappy Kiro coding standards

Plain browser JavaScript, ES modules, no build step. Tests use vitest and fast-check in the Node environment.

## Modules

- One concern per file in `src/`. Use named `export`s and relative `import ... from './x.js'` (always include `.js`).
- No globals. Never attach to `window`, and never add UMD wrappers, `require` or `module.exports`.
- `index.html` loads only `<script type="module" src="src/main.js">`. Everything else is reached through imports.
- Touch browser APIs (`window`, `document`, `Image`, `Audio`, `localStorage`, `requestAnimationFrame`) only in `main.js`, `input.js`, `assets.js` and `renderer.js`, and make them injectable so tests can pass fakes. Nothing may run at import time except in `main.js`, which auto-starts only when `typeof document !== 'undefined'`.
- Keep one source of truth. If two modules need the same geometry or rule, one imports it from the other (for example, collision uses `pipes.pipeRects`). Never copy a calculation.

## Game patterns

- **Simulation and shell are separate.** `game.js` owns the `GameState` and the rules. `main.js` owns the loop, audio, storage and rendering.
- **The core is deterministic.** Pass randomness in as `{ rng }`; never call `Math.random` inside game logic. Time comes in only as `dt` in seconds, already clamped with `clampDt`.
- **Return events, don't perform effects.** `handleInput` and `update` return arrays such as `{ type: 'jump' }`, `{ type: 'scored' }` and `{ type: 'gameOver', score, previousHighScore }`. The shell turns them into sounds and storage writes.
- **State is one plain object.** `handleInput` and `update` may mutate it. Helper modules (physics, pipes, clouds, collision, animation, menu) are pure: they take inputs and return new values without mutating their arguments.
- **The loop order is fixed.** Read the raw delta, clamp it, drain queued input, call `update`, process events, then render. Reset the frame clock when the tab becomes visible again.
- **Use a finite state machine for modes:** `Main_Menu`, `Playing`, `Paused`, `Game_Over`. Each mode handles input in its own branch. Add a transition only if the design lists it.
- **Timers are milliseconds remaining**, counted down to 0 and clamped (`invincibleMs`, `crashMs`, `lockoutMs`). Elapsed clocks count up (`animClockMs`, `flapMs`, `deathMs`).
- **Physics is semi-implicit Euler:** update the velocity first, then the position using the new velocity. Y grows downward, so an upward velocity is negative.
- **Collision is circle against rectangle** with a strict nearest-point test (touching is not a hit). Zero-size rectangles are skipped.
- **Config is one frozen object** from `config.js`. Read every tunable from `cfg`; no magic numbers in logic. Derived values are computed only in `derive`. A new tunable needs a `TUNABLE` entry and a validation rule for anything it can break.
- **Failures are local and silent to the player.** A missing asset falls back to a placeholder, a blocked sound or storage error is caught, and a frame that throws still schedules the next one.

## Naming conventions

| Kind | Convention | Example |
|---|---|---|
| Files | lowerCamelCase `.js` | `scoreStore.js`, `game.js` |
| Functions, variables | lowerCamelCase, verb first for functions | `spawnPair`, `shouldSpawn`, `pipeRects` |
| Factories | `create` + noun, returning a plain object | `createGame`, `createAudioPlayer` |
| Classes (if ever needed) | PascalCase noun, one per file, file named after the class | `class ParticleSystem` in `particleSystem.js` |
| Booleans | `is`/`has`/`should` prefix or adjective | `isMuted`, `shouldSpawn`, `scored` |
| Config groups | lower case | `cfg.world`, `cfg.pipes` |
| Config keys and module constants | UPPER_SNAKE_CASE | `GAP_HEIGHT`, `MAX_DT`, `KEY_MAP` |
| Durations | unit suffix | `crashMs`, `dt` (seconds), `LOCKOUT_MS` |
| Modes | `Title_Case` strings | `'Game_Over'` |
| Event types | lowerCamelCase strings | `'gameOver'`, `'toggleMute'` |
| Input kinds | lower case strings | `'space'`, `'pointer'`, `'hidden'` |
| Tests | `tests/props/pNN-topic.test.js` for property tests, `tests/unit/topic.test.js` for unit tests | `p13-scoring.test.js` |

Prefer factories and plain objects over classes. Use a class only for long-lived objects with internal state and several methods, and never use inheritance.

## Performance

- **Frame budget:** everything in one frame must fit well under 16 ms. Don't do work per frame that could be done once at startup or on resize.
- **Allocations:** small per-frame arrays from pure helpers (a few pipes and clouds) are fine. Avoid allocating inside per-pixel or per-segment loops, and don't create closures, `Image` objects or canvases in `render`. Cache derived assets once (for example, the white tinted sprite).
- **Canvas:**
  - Set `imageSmoothingEnabled = false` once per frame.
  - Batch draws that share a `fillStyle`, and minimise `save`/`restore` and state changes.
  - Draw whole-pixel coordinates for pixel art.
  - Never read pixels back (`getImageData`) in the loop.
- **Fixed logical size:** render at 480 x 640 and scale with CSS (`fitCanvas` and `image-rendering: pixelated`). Never resize the backing canvas per frame.
- **Timing:** use `requestAnimationFrame` timestamps, never `setInterval`. Clamp `dt` so a slow frame or a hidden tab can't tunnel the ghost through a pipe.
- **Collections:** remove off-screen pipes every frame so lists stay bounded. Wrap clouds instead of creating new ones.
- **Audio:** reuse one element per sound and rewind with `currentTime = 0`. Don't create `Audio` objects on play.
- **Storage:** read the high score once at startup, and write only when a new high score is recorded, never per frame.
- **Measure before optimising** (DevTools Performance panel). Don't trade readability for speculative micro-optimisations.

## Code quality

- APIs take one shape. Don't accept an object or a bare value "for convenience".
- No dead code, no unused exports, no commented-out code.
- Comments explain why, not what. Examples: "Strict: touching is not a hit", "a failed frame must not stop the loop".
- Every behaviour change comes with a test. Property tests read expected numbers from the config in use, never from hard-coded defaults.
- Check provided assets (sprites, recordings) before modifying them. A spec target duration does not justify cutting a spoken clip.
- Run `npx vitest --run` before considering a change done.
