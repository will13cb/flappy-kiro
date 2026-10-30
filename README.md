# Flappy Kiro

A small Flappy Bird style browser game starring Ghosty. Flap through the walls, score a point for each pair you pass, and beat your best.

Plain JavaScript ES modules on an HTML canvas, with no build step and no runtime dependencies. Tests use [vitest](https://vitest.dev) and [fast-check](https://fast-check.dev).

![Flappy Kiro UI](img/example-ui.png)

## Contents

- [Quick start](#quick-start)
- [How to play](#how-to-play)
- [Project layout](#project-layout)
- [Architecture](#architecture)
- [Game states](#game-states)
- [The frame loop](#the-frame-loop)
- [Inside `update`](#inside-update)
- [Configuration and tuning](#configuration-and-tuning)
- [Rendering](#rendering)
- [Assets and fallbacks](#assets-and-fallbacks)
- [Testing](#testing)
- [Deployment](#deployment)
- [MCP servers](#mcp-servers)
- [Contributing](#contributing)

## Quick start

The game is plain ES modules, so it has to be served over HTTP. Opening `index.html` from the file system (`file://`) won't load the modules.

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static file server works (for example `npx serve`). The live version is deployed to GitHub Pages; see [Deployment](#deployment). Installing Node is only needed to run the tests:

```bash
npm install
npm test
```

## How to play

| Action | Keyboard | Mouse / touch |
|---|---|---|
| Flap (and start from the menu) | Space | Click or tap anywhere |
| Move between menu buttons | Up / Down | |
| Activate a menu button | Space or Enter | Click the button |
| Pause / resume | P or Escape | Pause icon (top right) |
| Mute / unmute | M | Speaker icon (top left) |
| Restart after game over | Space or Enter (RESTART is selected) | Click RESTART, or tap anywhere else |
| Back to the menu from game over | Down, then Space or Enter | Click MENU |

- Each round starts with 1.5 s of invincibility against walls, shown by Ghosty blinking. The ground and ceiling still count during this time.
- The scroll speed rises every 5 points, up to a maximum.
- After a crash, input is ignored for 1 s (`lockoutMs`). The Game Over panel appears 0.5 s in, so it stays readable for 0.5 s before input unlocks. `lockoutMs` must be greater than `crashMs`.
- Switching tabs pauses the game.
- Your best score and your top 5 scores are kept in `localStorage`. The High Scores panel and the Game Over panel show the top 5.
- Calm music plays on the menu and faster music during a round. It pauses with the game and stops at game over. Mute (M) silences music too.

## Project layout

```
index.html            page shell; loads src/main.js as a module
src/
  main.js             browser shell: loop, wiring, audio, storage, resize
  game.js             game state machine: createGame, startRound, handleInput, update
  config.js           base values, derived values, URL overrides, validation
  physics.js          gravity, jump, tilt, frame time clamp
  pipes.js            wall spawning, movement, speed curve, rectangles
  collision.js        circle-vs-rectangle, ground and ceiling tests
  clouds.js           parallax clouds: create, move, wrap
  animation.js        Ghosty frame selection (idle, flap, death)
  menu.js             menu model, button and icon layout, hit testing
  scoreStore.js       high score and top 5 persistence
  audio.js            audio player with mute, event-to-sound mapping
  assets.js           independent image and sound loading with fallbacks
  input.js            keyboard, mouse, touch and visibility wiring
  renderer.js         all canvas drawing
assets/               ghosty.png, jump.wav, score.wav, game_over.wav, music-menu.wav, music-game.wav
mcp/                  local MCP servers: audio (sound generation) and leaderboard
scripts/              generate-audio.js (builds score.wav and the music loops)
tests/
  helpers/            shared fast-check generators and a game runner
  props/              property-based tests, one per design property (pNN-*.test.js)
  unit/               unit tests per module
.kiro/
  specs/flappy-kiro/  requirements, design and task list
  steering/           coding standards, visual design and workspace rules
ghosty-sprites.md     sprite and animation spec
ui-mockups.md         screen layouts and palette
audio-assets.md       sound design notes
```

## Architecture

The code is split into a **deterministic core** and a thin **browser shell**.

- **Core** (`game.js` and the helper modules): owns all game rules. It never touches the DOM, time or randomness directly. Time comes in as `dt`, randomness as `{ rng }`, and effects go out as events.
- **Shell** (`main.js`): owns the browser. It runs the `requestAnimationFrame` loop and turns events into sounds and storage writes. It also loads assets and draws through the renderer.

### Module dependencies

Arrows point from a module to the modules it imports.

```mermaid
graph TD
  HTML[index.html] --> main

  subgraph Shell
    main[main.js]
    input[input.js]
    assets[assets.js]
    audio[audio.js]
    store[scoreStore.js]
    renderer[renderer.js]
  end

  subgraph Core
    game[game.js]
    config[config.js]
    physics[physics.js]
    pipes[pipes.js]
    collision[collision.js]
    clouds[clouds.js]
    animation[animation.js]
    menu[menu.js]
  end

  main --> config
  main --> physics
  main --> game
  main --> store
  main --> audio
  main --> assets
  main --> input
  main --> renderer

  game --> physics
  game --> clouds
  game --> menu
  game --> pipes
  game --> collision

  collision --> pipes
  animation --> physics

  renderer --> pipes
  renderer --> animation
  renderer --> assets
  renderer --> menu
```

Two places share data on purpose, so that what you see matches what happens:

- **Walls:** `collision.js` and `renderer.js` both use `pipes.pipeRects`. The walls you see are the walls you hit.
- **Controls:** `renderer.js` and `game.js` (via `menu.hitTest`) both use the rectangles from `menu.js`. The buttons you see are the buttons you click.

### Responsibilities

| Module | Pure? | Responsibility |
|---|---|---|
| `config.js` | yes | Base values, `derive`, URL overrides (`parseOverrides`, `loadConfig`), `validateConfig` |
| `physics.js` | yes | `stepGhost` (semi-implicit Euler), `applyJump`, `tiltFor`, `clampDt` |
| `pipes.js` | yes | Gap placement, `shouldSpawn`/`spawnPair`, `movePairs`, `removeOffscreen`, `speedForScore`, `pipeRects` |
| `collision.js` | yes | Strict circle-vs-rectangle test, ground and ceiling, `detect` |
| `clouds.js` | yes | `createClouds`, `moveClouds` with wrap-around |
| `animation.js` | yes | Picks the idle, flap or death frame and its transforms |
| `menu.js` | yes | Menu navigation, button and icon rectangles, `hitTest` |
| `game.js` | mutates state | Modes, input routing, the per-frame `update`, events |
| `scoreStore.js` | storage | Reads and writes the high score and top 5 list, never throws |
| `audio.js` | audio elements | Plays sounds, mute, `soundsFor(events)` |
| `assets.js` | browser | Loads each asset independently; failures resolve to `null` |
| `input.js` | browser | Maps DOM events to inputs such as `{ kind: 'space' }` or `{ kind: 'pointer', x, y }` |
| `renderer.js` | canvas | Draws everything from the state, reads nothing back |
| `main.js` | browser | Startup, the loop, event handling, resize |

## Game states

`game.js` is a finite state machine with four modes. Game Over can go back to Playing or to Main_Menu. The High Scores panel is part of `Main_Menu`; opening it does not change the mode.

```mermaid
stateDiagram-v2
  [*] --> Main_Menu
  Main_Menu --> Playing: PLAY, Space on PLAY, or tap outside the buttons
  Playing --> Paused: P / Esc, pause icon, or tab hidden
  Paused --> Playing: P / Esc or pause icon
  Playing --> Game_Over: hit a wall, the ground or the ceiling
  Game_Over --> Playing: RESTART, Space / Enter on RESTART, or tap elsewhere (after 1 s lockout)
  Game_Over --> Main_Menu: MENU, or Space / Enter on MENU (after 1 s lockout)

  state Main_Menu {
    [*] --> Menu
    Menu --> HighScoresPanel: HIGH SCORES
    HighScoresPanel --> Menu: BACK
  }
```

Every way into `Playing` goes through `startRound`. It resets the round, starts invincibility and applies the first jump.

## The frame loop

`main.js` runs one loop with a fixed order each frame. Input is queued by the DOM listeners and drained once per frame, so it is handled at a predictable point.

```mermaid
sequenceDiagram
  participant DOM as Browser (DOM, rAF)
  participant In as input.js
  participant Main as main.js
  participant Game as game.js
  participant Audio as audio.js
  participant Store as scoreStore.js
  participant R as renderer.js

  DOM->>In: keydown / mousedown / touchstart / visibilitychange
  In->>Main: pushInput({ kind, ... })  (queued)
  DOM->>Main: requestAnimationFrame(ts)
  Main->>Main: dt = clampDt(ts - last)
  loop each queued input
    Main->>Game: handleInput(state, input, { rng })
    Game-->>Main: events
  end
  Main->>Game: update(state, dt, { rng })
  Game-->>Main: events (scored, gameOver, ...)
  Main->>Audio: play(soundsFor(events))
  opt gameOver event
    Main->>Store: recordIfHigher(storage, score, highScore)
  end
  Main->>R: render(ctx, state, assets, { muted })
  Main->>DOM: requestAnimationFrame(next)
```

Notes:

- `dt` is clamped (50 ms by default), so a slow frame can't tunnel Ghosty through a wall.
- The frame clock resets when the tab becomes visible again, so there's no jump after a background tab.
- The next frame is scheduled even if a frame throws, so one bad frame can't freeze the game.

### Events

The core never plays sounds or writes storage. It returns events, and the shell acts on them.

```mermaid
flowchart LR
  subgraph Core
    HI[handleInput] --> E1["{ type: 'jump' }<br/>{ type: 'toggleMute' }"]
    UP[update] --> E2["{ type: 'scored' }<br/>{ type: 'gameOver', score, previousHighScore }"]
  end
  E1 --> SH[main.js]
  E2 --> SH
  SH -->|jump / scored / gameOver| SND[audio.play: jump.wav, score.wav, game_over.wav]
  SH -->|toggleMute| MUTE[audio.toggleMute]
  SH -->|gameOver| HS[scoreStore.recordIfHigher]
```

## Inside `update`

While `Playing`, each frame follows this pipeline. In the other modes the world is frozen:
- `Main_Menu` only advances the idle animation.
- `Paused` changes nothing.
- `Game_Over` runs the crash animation (Ghosty falls to the ground) and the restart lockout.

```mermaid
flowchart TD
  A[Timers: invincibleMs down, flapMs up] --> B[Physics: stepGhost with gravity]
  B --> C[Scroll: walls and ground by speed x dt, clouds by layer speed]
  C --> D[Remove walls fully off screen]
  D --> E{Last wall reached SPAWN_X?}
  E -- yes --> F[Spawn a pair at the right edge; gap within MAX_GAP_SHIFT of the previous one]
  E -- no --> G
  F --> G[Score each pair Ghosty has passed, once]
  G --> H[Speed = speedForScore]
  H --> I{Collision?<br/>walls ignored while invincible}
  I -- no --> J[Stay in Playing]
  I -- yes --> K[Game_Over: start crash and lockout timers,<br/>set newHighScore, emit gameOver]
```

## Configuration and tuning

All values live in `src/config.js`:

- **`BASE`:** world size, physics, wall sizes, speed curve, timings, cloud layers, UI layout and animation tables.
- **`derive`:** computes dependent values such as `GROUND_TOP`, the gap centre range, `SPAWN_X` and the cloud layer speeds.

The final config is frozen, and every module reads from it. There are no magic numbers in the logic.

You can tune the whitelisted values from the URL without editing code:

```
http://localhost:8000/?gravity=1000&gapHeight=170&wallSpeed=140
```

Tunable names: `gravity`, `jumpVelocity`, `hitboxRadius`, `gapHeight`, `gapMargin`, `pipeSpacing`, `maxGapShift`, `wallSpeed`, `speedIncrement`, `speedStepInterval`, `maxSpeed`, `invincibilityMs`, `crashMs`, `lockoutMs`, `cloudSpeedMin`, `cloudSpeedMax`.

```mermaid
flowchart LR
  URL["location.search"] --> PO[parseOverrides]
  PO -->|unknown or non-numeric: warn and ignore| W[console warnings]
  PO --> BC["buildConfig(BASE + overrides) + derive"]
  BC --> V{validateConfig}
  V -- valid --> CFG[frozen config]
  V -- invalid --> D[warn, use DEFAULT_CONFIG]
```

Validation only checks rules a tunable value can break, for example:
- The gap must be taller than Ghosty's hitbox and must fit above the ground.
- `GAP_MARGIN >= CAP_HEIGHT`.
- Gaps must stay reachable at maximum speed.
- Clouds must be slower than the walls.

A bad URL can never produce an unplayable game.

Default values include gravity 800 px/s², jump velocity -300 px/s, wall speed 120 rising to 240 px/s, a 140 px gap and 350 px between walls.

## Rendering

`renderer.js` draws the whole frame from the state on a fixed 480 x 640 logical canvas. CSS scales the canvas to the window with `image-rendering: pixelated`.

Draw order, back to front:

```mermaid
flowchart LR
  S[Sky] --> C[Clouds<br/>3 parallax layers] --> W[Walls] --> G[Ground<br/>scrolling stripe] --> GH[Ghosty] --> UI[HUD and overlays]
```

- **Ghosty:** `animation.currentFrame` picks the idle bob, the flap squash and stretch, or the death spin and flash. The renderer applies the frame's offset, scale, rotation and tint. Rotation follows vertical speed.
- **Parallax:** three cloud layers move at 15, 35 and 55 px/s. Nearer clouds are wider, faster and more opaque. Walls and ground move together at the game speed.
- **HUD and overlays:**
  - The score shows at the top while playing.
  - The mute and pause icons appear in Playing and Paused.
  - Paused dims the screen.
  - Game Over shows a panel with the score, the best score, "NEW BEST!", a TOP 5 list, and RESTART and MENU buttons after the crash animation.

See `.kiro/steering/visual-design.md`, `ghosty-sprites.md` and `ui-mockups.md` for the visual rules.

## Assets and fallbacks

Each asset loads on its own. One failure never blocks the game or the other assets.

| Asset | If it fails to load |
|---|---|
| `assets/ghosty.png` | A 24 x 24 white square is drawn in its place |
| `assets/ghosty-sheet.png` (optional sprite sheet) | Transforms of `ghosty.png` are used. This is expected today, since the sheet doesn't exist yet |
| `jump.wav`, `score.wav`, `game_over.wav` | That sound is silent |
| `music-menu.wav`, `music-game.wav` | No music; the game is otherwise unaffected |
| `localStorage` | The high score reads as 0 and isn't saved |

`assets/score.wav` is generated:

```bash
npm run generate-audio
```

## Testing

```bash
npm test                                   # whole suite
npx vitest --run tests/props/p13-scoring.test.js   # one file
```

- **Property tests** (`tests/props/pNN-*.test.js`): each one checks a numbered correctness property from `.kiro/specs/flappy-kiro/design.md` over many generated configs, states and input sequences. Examples:
  - The world is frozen outside Playing.
  - Each pair scores exactly once.
  - Every mode change is a permitted transition.
  - The circle-vs-rectangle test is strict.
- **Unit tests** (`tests/unit/`): config defaults and overrides, audio, asset fallbacks, input wiring, the renderer (against a recording fake canvas) and the generated WAV.
- **Helpers:**
  - `tests/helpers/arbitraries.js` has generators for configs, ghosts, pipes, `dt` and storage.
  - `tests/helpers/game-arbs.js` has game-state generators and `runSteps`, which drives `handleInput` and `update` and records transitions and events.

The core is deterministic (seeded `rng`, explicit `dt`), so tests run the real game logic with no browser and no timers.

## Deployment

The game is hosted for free on GitHub Pages. `.github/workflows/deploy.yml` runs on every push to `master`:

1. `npm ci` and `npm test`. A failing test stops the deploy.
2. `npm run build`: `scripts/build-site.js` copies only `index.html`, `src/`, `assets/` and the licence into `_site/`, which comes to about 2 MB.
3. The `_site/` artifact is uploaded and deployed to Pages.

**One-time setup:** in **Settings > Pages**, set **Source** to **GitHub Actions**. Pages is free for public repositories.

**Analytics (optional):** add one or both repository variables under **Settings > Secrets and variables > Actions > Variables**. With neither set, the site ships with no analytics.

| Variable | Adds |
|---|---|
| `CF_ANALYTICS_TOKEN` | [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) (free, no cookies) |
| `GOATCOUNTER_CODE` | [GoatCounter](https://www.goatcounter.com/) (free for non-commercial use) |

The build validates both values and adds the snippet before `</head>`.

**Monitoring:** `.github/workflows/uptime.yml` checks the page, `src/main.js` and two assets every hour. A failed check sends GitHub's failed-workflow email. Set a `SITE_URL` variable if the site moves. GitHub pauses scheduled workflows after 60 days with no repository activity.

## MCP servers

Two local MCP servers in `mcp/` are registered in `.kiro/settings/mcp.json`. Both are dependency-free and share the stdio transport in `mcp/lib/stdio-server.js`. They are tools for Kiro and other MCP clients; the browser game does not call them.

| Server | Tools | Data |
|---|---|---|
| `flappy-audio` (`mcp/audio/server.js`) | `list_presets`, `generate_sound` (`flap`, `score`, `hit`, `music_menu`, `music_game`, optional `seed` and `file`) | Writes WAVs to `assets/generated/` (gitignored), or `AUDIO_OUT_DIR` inside the project |
| `flappy-leaderboard` (`mcp/leaderboard/server.js`) | `submit_score`, `get_leaderboard`, `get_player`, `list_achievements` | `data/leaderboard.json` (gitignored), or `LEADERBOARD_FILE` |

The audio presets are synthesised in `mcp/audio/synth.js`. The same code builds the game's generated sounds:

```bash
npm run generate-audio   # writes assets/score.wav, assets/music-menu.wav, assets/music-game.wav
```

## Contributing

- Follow `.kiro/steering/coding-standards.md`: ES modules only, no globals, a pure core, events instead of effects, and one source of truth for shared geometry.
- Put any new tunable in `config.js`: add it to `BASE`, add a `TUNABLE` entry if it should be URL-tunable, and add a validation rule for anything it can break.
- Add or update a test with every behaviour change, and run `npm test` before committing.
- Keep temporary scripts in `scripts/` and delete them when done.

The full product spec lives in `.kiro/specs/flappy-kiro/` (requirements, design and tasks).

## Licence

See [LICENCE.md](LICENCE.md).
