# Audio Asset Specification

## Overview

Sound design for Flappy Kiro. Three sounds are specified. All are short one-shot effects, played through the Audio_Player, and all respect the mute toggle.

## Sounds

| Sound | File | Duration | Character | Trigger |
|---|---|---|---|---|
| Flap | `assets/jump.wav` | 0.1 s | Short whoosh | Each jump while Playing |
| Score | `assets/score.wav` | 0.2 s | Pleasant chime | Each pipe pair passed |
| Collision | `assets/game_over.wav` | 0.3 s | Soft thud | Once when the game state changes to Game_Over |

### Flap: short whoosh (0.1 s)

- Filtered noise burst with a quick upward pitch sweep (roughly 400 Hz to 900 Hz band).
- Attack 5 ms, decay to silence over the remaining time.
- Light and airy, so it does not become tiring when repeated several times per second.
- Peak level about -12 dBFS.

### Score: pleasant chime (0.2 s)

- Two soft sine or triangle tones a major third apart (for example 880 Hz then 1109 Hz), starting 80 ms apart.
- Attack 5 ms, exponential decay over 150 ms.
- Bright but quiet, so it never masks the flap sound.
- Peak level about -14 dBFS.

### Collision: soft thud (0.3 s)

- Low sine burst around 90 Hz dropping to 50 Hz, plus a small amount of low-passed noise at the start.
- Attack 2 ms, decay to silence over 300 ms.
- Soft, not harsh, since it is heard at the end of every round.
- Peak level about -8 dBFS (the loudest of the three).

## Format

- WAV, PCM 16-bit, 44.1 kHz, mono is enough. The existing files are stereo and also work.
- No leading silence. Trim files so the sound starts at sample 0, to keep latency low.
- Normalize so that flap < score < collision in perceived loudness, as listed above.

## Playback rules

- Replaying a sound that is still playing restarts it from the beginning.
- If the browser blocks audio, the game continues silently.
- If a file fails to load, only that sound is silent.
- While muted, none of the three sounds play.

## Existing assets versus this spec

| File | Exists | Current duration | Target duration |
|---|---|---|---|
| `assets/jump.wav` | yes | about 0.37 s | 0.1 s |
| `assets/game_over.wav` | yes | about 2.25 s | 0.3 s |
| `assets/score.wav` | no | n/a | 0.2 s |

The existing files are longer than the targets. They can be trimmed, replaced, or kept if you prefer their sound. The score sound is new. Adding it also means adding a score event hook in the game and a third audio element in `index.html`.
