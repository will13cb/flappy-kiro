# Requirements Document

## Introduction

Flappy Kiro is a retro, browser-based endless scroller. The player guides a ghost character (Ghosty) through gaps in a continuous series of walls, where each wall is a Pipe_Pair. The Ghost falls under gravity and rises when the player triggers a jump. The game uses the workspace assets: `assets/ghosty.png` (ghost sprite), `assets/jump.wav` (flap sound), `assets/score.wav` (score sound) and `assets/game_over.wav` (collision sound). Tunable gameplay values are read from `game-config.json`, and the Ghost sprite, audio and menu details follow `ghosty-sprites.md`, `audio-assets.md` and `ui-mockups.md`. The visual style follows the reference screenshot at `img/example-ui.png`, interpreted as a retro pixel-style look with a score display, scrolling pipes and a ghost sprite.

The game is organized into four Game_States: Main_Menu, Playing, Paused and Game_Over. The Main_Menu shows the title, the High_Score, a start prompt, a PLAY button and a HIGH SCORES button. The Playing state shows the Score in real time. The player can pause and resume a round. The Game_Over screen shows the final result and offers a restart. The High_Score persists in browser local storage.

Obstacle generation is specified with concrete values: Pipe_Pair spacing, Gap height, random Gap positioning, Scroll_Speed and a progressive Scroll_Speed increase. Collision detection is specified with precise Hitboxes, wall, Ground and Ceiling boundaries, a Crash_Animation and a start-of-round Invincibility_Period.

All distances are logical pixels of the Play_Area (480 wide by 640 high). All speeds are logical pixels per second. All accelerations are logical pixels per second squared.

## Glossary

- **Game**: The Flappy Kiro browser application, including rendering, input, physics, audio and scoring.
- **Ghost**: The player-controlled character, drawn with `assets/ghosty.png` at a sprite size of 32 by 32.
- **Pipe_Pair**: A wall made of a top pipe and a bottom pipe separated by a vertical Gap through which the Ghost can pass. The terms wall and Pipe_Pair are synonymous.
- **Pipe_Width**: The width of the body of a pipe, 64.
- **Pipe_Cap**: The wider end piece of a pipe at the Gap-facing end, 72 wide and 24 high.
- **Gap**: The vertical opening between the top pipe and the bottom pipe of a Pipe_Pair.
- **Gap_Height**: The height of every Gap, 140.
- **Gap_Margin**: The minimum distance between a Gap and the Ceiling, and between a Gap and the Ground, 60.
- **Pipe_Spacing**: The horizontal distance between the left edges of two consecutively spawned Pipe_Pairs, 350.
- **Max_Gap_Shift**: The maximum vertical distance between the Gap centers of two consecutively spawned Pipe_Pairs, 160.
- **Scroll_Speed**: The single leftward speed shared by every Pipe_Pair and the Ground at a given moment.
- **Initial_Scroll_Speed**: The Scroll_Speed at the start of every round, 120.
- **Speed_Increment**: The amount added to the Scroll_Speed at each speed step, 10.
- **Speed_Step_Interval**: The number of points between speed steps, 5.
- **Max_Scroll_Speed**: The upper limit of the Scroll_Speed, 240.
- **Ground**: The strip at the bottom of the Play_Area, 80 high, that scrolls with the pipes.
- **Play_Area**: The visible canvas region in which the Ghost, Pipe_Pairs and Ground are drawn.
- **Ceiling**: The top edge of the Play_Area.
- **Score**: The count of Pipe_Pairs the Ghost has passed in the current round.
- **High_Score**: The highest Score recorded in the browser on the current device.
- **New_High_Score**: A final Score that is greater than the High_Score stored before the round ended.
- **Jump_Input**: A press of the Space key, a mouse click on the Play_Area, or a touch on the Play_Area.
- **Pause_Input**: A press of the P key, a press of the Escape key, or an activation of the on-screen pause control.
- **Game_State**: One of Main_Menu, Playing, Paused or Game_Over.
- **Main_Menu**: The Game_State in which the Game shows the title, the High_Score and a start prompt and waits for the player to start a round.
- **Playing**: The Game_State in which a round is in progress.
- **Paused**: The Game_State in which a round is suspended and all movement, physics and timers are frozen.
- **Game_Over**: The Game_State entered when a collision ends a round.
- **Hitbox**: The shape used by the Collision_Detector to represent an object, defined in Requirement 6. The Ghost Hitbox is a circle and each pipe Hitbox is a rectangle.
- **Hitbox_Radius**: The radius of the Ghost Hitbox circle, 12.
- **Invincibility_Period**: The 1500 millisecond period after a round starts during which collisions between the Ghost and pipes are ignored.
- **Crash_Animation**: The 500 millisecond animation at the start of Game_Over in which the Ghost flashes and falls before the game over overlay appears.
- **Audio_Player**: The component that plays `assets/jump.wav` (flap sound), `assets/score.wav` (score sound) and `assets/game_over.wav` (collision sound).
- **Game_Config**: The file `game-config.json` that holds the tunable gameplay values cited in this document.
- **Menu_Button**: An on-screen button, one of PLAY, HIGH SCORES, BACK or RESTART, that the player activates with the mouse, a touch, or the Space or Enter key while the button is selected.
- **High_Scores_Panel**: The Main_Menu panel that shows the stored High_Score as "BEST: N" and a BACK Menu_Button.
- **Ghost_Animation**: One of the idle, flap or death frame sequences of the Ghost, defined in Requirement 18.
- **Collision_Detector**: The component that determines whether the Ghost overlaps a pipe, the Ground or the Ceiling.
- **Renderer**: The component that draws the Play_Area on an HTML canvas.
- **Score_Store**: The component that persists and retrieves the High_Score using browser local storage.
- **Cloud**: A purely decorative, semi-transparent background sprite drawn in the sky of the Play_Area that scrolls horizontally at its own Cloud_Speed.
- **Cloud_Speed**: The horizontal scroll speed assigned to a single Cloud.

## Requirements

### Requirement 1: Browser Delivery and Asset Loading

**User Story:** As a player, I want the game to load and run in my web browser, so that I can play without installing anything.

#### Acceptance Criteria

1. THE Game SHALL run in a web browser from static files without a server-side component.
2. WHEN the page finishes loading, THE Game SHALL display the Play_Area in the Main_Menu Game_State.
3. WHEN the page finishes loading, THE Game SHALL load `assets/ghosty.png`, `assets/jump.wav`, `assets/score.wav` and `assets/game_over.wav` from the `assets` directory.
4. IF an asset fails to load, THEN THE Game SHALL continue to run and SHALL display a placeholder shape in place of a missing sprite.
5. IF an asset fails to load, THEN THE Game SHALL replace only the failed asset with a placeholder shape or silence, and THE Game SHALL load and use every other asset normally.
6. WHEN the page finishes loading, THE Game SHALL read the tunable gameplay values cited in this document from the Game_Config.
7. IF `assets/ghosty.png` fails to load, THEN THE Renderer SHALL draw a 24 by 24 white square centered on the Ghost center as the placeholder.

### Requirement 2: Main Menu and Starting a Round

**User Story:** As a player, I want a main menu that shows my best score and lets me start with a simple input, so that I can begin playing quickly.

#### Acceptance Criteria

1. WHILE the Game_State is Main_Menu, THE Renderer SHALL display the game title, the High_Score, the Ghost, the Ground and a start prompt that states how to start.
2. WHEN a Jump_Input occurs while the Game_State is Main_Menu, THE Game SHALL set the Score to 0, set the Scroll_Speed to the Initial_Scroll_Speed, start the Invincibility_Period, change the Game_State to Playing and apply a jump to the Ghost.
3. WHILE the Game_State is Main_Menu, THE Game SHALL keep the Ghost at a fixed vertical position.
4. WHILE the Game_State is Main_Menu and no High_Score has been stored, THE Renderer SHALL display a High_Score of 0.

### Requirement 3: Ghost Physics and Jumping

**User Story:** As a player, I want the ghost to fall and jump with responsive controls, so that guiding it feels like a classic flappy game.

#### Acceptance Criteria

1. WHILE the Game_State is Playing, THE Game SHALL accelerate the Ghost downward at a constant gravity of 800 on every frame.
2. WHEN a Jump_Input occurs while the Game_State is Playing, THE Game SHALL set the Ghost vertical velocity to an upward velocity of 300.
3. WHEN a Jump_Input occurs while the Game_State is Playing, THE Audio_Player SHALL play `assets/jump.wav`.
4. WHILE the Game_State is Playing, THE Game SHALL keep the horizontal center of the Ghost at 120 from the left edge of the Play_Area.
5. WHILE the Ghost is moving upward, THE Renderer SHALL draw the Ghost tilted upward, and WHILE the Ghost is moving downward, THE Renderer SHALL draw the Ghost tilted downward.
6. THE Game SHALL update the Ghost position using elapsed frame time so that gameplay speed is the same on displays with different refresh rates.
7. WHILE the Ghost vertical velocity is exactly zero, THE Renderer SHALL draw the Ghost level with no tilt.

### Requirement 4: Obstacle Generation and Scrolling

**User Story:** As a player, I want an endless series of walls with varied gaps that gradually move faster, so that the game stays challenging and fair for as long as I survive.

#### Acceptance Criteria

1. WHEN a round begins, THE Game SHALL spawn the first Pipe_Pair with its left edge at the right edge of the Play_Area.
2. WHILE the Game_State is Playing, WHEN the left edge of the most recently spawned Pipe_Pair is at or to the left of a position 350 left of the right edge of the Play_Area, THE Game SHALL spawn a new Pipe_Pair with its left edge at the right edge of the Play_Area.
3. THE Game SHALL give every Pipe_Pair pipes with a Pipe_Width of 64 and Pipe_Caps that are 72 wide and 24 high.
4. THE Game SHALL give every Gap a Gap_Height of 140, which is larger than the 24 high Ghost Hitbox (twice the Hitbox_Radius).
5. WHEN the Game spawns a Pipe_Pair, THE Game SHALL choose the Gap vertical position at random from a uniform distribution over all positions that keep the Gap at least one Gap_Margin of 60 below the Ceiling and at least one Gap_Margin of 60 above the Ground.
6. WHEN the Game spawns a Pipe_Pair other than the first of a round, THE Game SHALL restrict the Gap vertical position so that the distance between its Gap center and the Gap center of the previous Pipe_Pair does not exceed the Max_Gap_Shift of 160.
7. THE Game SHALL ensure that the time the Ghost needs to travel the Max_Gap_Shift of 160 vertically, using repeated Jump_Inputs or free fall, is shorter than the Pipe_Spacing divided by the Max_Scroll_Speed (350 / 240, about 1.46 seconds), so that the next Gap is always reachable.
8. WHILE the Game_State is Playing, THE Game SHALL move every Pipe_Pair and the Ground leftward at the current Scroll_Speed using elapsed frame time.
9. WHEN a round begins, THE Game SHALL set the Scroll_Speed to the Initial_Scroll_Speed of 120.
10. WHEN the Score increases, THE Game SHALL set the Scroll_Speed to the lesser of the Max_Scroll_Speed of 240 and the sum of the Initial_Scroll_Speed and the product of the Speed_Increment of 10 and the integer quotient of the Score divided by the Speed_Step_Interval of 5.
11. THE Game SHALL apply the same Scroll_Speed value to the Ground and to every Pipe_Pair at all times.
12. WHEN a Pipe_Pair moves completely beyond the left edge of the Play_Area, THE Game SHALL remove that Pipe_Pair.
13. WHILE the Game_State is Main_Menu, Paused or Game_Over, THE Game SHALL hold Pipe_Pair and Ground positions unchanged.
14. WHEN a new round begins, THE Game SHALL remove all Pipe_Pairs of the previous round.

### Requirement 5: Scoring

**User Story:** As a player, I want to see my score update the moment I pass a wall, so that I can measure my progress in real time.

#### Acceptance Criteria

1. WHEN the horizontal center of the Ghost passes the right edge of a Pipe_Pair for the first time, THE Game SHALL increase the Score by 1 within the same frame.
2. WHILE the Game_State is Playing or Paused, THE Renderer SHALL display the current Score at the top center of the Play_Area.
3. WHEN a new round begins, THE Game SHALL set the Score to 0.
4. THE Game SHALL increase the Score by at most 1 for each Pipe_Pair.
5. WHILE the Invincibility_Period is active, THE Game SHALL continue to increase the Score according to criterion 1.

### Requirement 6: Collision Detection and Hitboxes

**User Story:** As a player, I want the game to end when I hit an obstacle and to judge hits precisely, so that the game is challenging and fair.

#### Acceptance Criteria

1. THE Collision_Detector SHALL use as the Ghost Hitbox a circle with a radius of 12 (the Hitbox_Radius) centered on the center of the 32 by 32 Ghost sprite, which leaves a margin of 4 at the horizontal and vertical extremes.
2. THE Collision_Detector SHALL use as the Hitbox of each pipe the union of the rectangle of the pipe body and the rectangle of its Pipe_Cap.
3. THE Collision_Detector SHALL define the Ground boundary as the top edge of the Ground, which lies 80 above the bottom edge of the Play_Area.
4. THE Collision_Detector SHALL define the Ceiling boundary as the top edge of the Play_Area.
5. WHILE the Game_State is Playing, THE Collision_Detector SHALL test the Ghost Hitbox against every pipe Hitbox, the Ground boundary and the Ceiling boundary on every frame.
6. WHEN the distance from the Ghost Hitbox center to the nearest point of a pipe Hitbox rectangle is strictly less than 12 and the Invincibility_Period is not active, THE Game SHALL change the Game_State to Game_Over.
7. WHEN the Ghost center y plus 12 reaches or passes the Ground boundary, THE Game SHALL change the Game_State to Game_Over.
8. WHEN the Ghost center y minus 12 reaches or passes the Ceiling boundary, THE Game SHALL change the Game_State to Game_Over.
9. WHILE the Ghost Hitbox lies fully within a Gap and does not reach the Ground boundary or the Ceiling boundary, THE Collision_Detector SHALL report no collision.
10. WHEN the distance from the Ghost Hitbox center to the nearest point of a pipe Hitbox rectangle is exactly 12, THE Collision_Detector SHALL report no collision with that pipe.
11. THE Collision_Detector SHALL exclude the margin outside the Ghost Hitbox circle from collision tests.

### Requirement 7: Collision Response, Invincibility and Game Over Screen

**User Story:** As a player, I want clear feedback when I crash and a fair start to each round, so that I understand what happened and am not killed instantly.

#### Acceptance Criteria

1. WHEN the Game_State changes to Game_Over, THE Audio_Player SHALL play `assets/game_over.wav` once.
2. WHEN the Game_State changes to Game_Over, THE Renderer SHALL start the Crash_Animation, which lasts 500 milliseconds and flashes the Ghost every 100 milliseconds while the Ghost falls under gravity until the Ghost center y plus 12 reaches the Ground boundary.
3. WHILE the Crash_Animation is running, THE Game SHALL hold Pipe_Pair, Ground and Cloud positions unchanged.
4. WHEN the Crash_Animation ends, THE Renderer SHALL display the game over overlay.
5. WHILE the Game_State is Game_Over and the Crash_Animation has ended, THE Renderer SHALL display a game over message, the final Score, the High_Score and a restart prompt that states how to restart.
6. WHERE the final Score is a New_High_Score, THE Renderer SHALL display a new high score indication on the game over overlay.
7. WHEN a round begins, THE Game SHALL start the Invincibility_Period with a duration of 1500 milliseconds.
8. WHILE the Invincibility_Period is active, THE Renderer SHALL draw the Ghost blinking, alternating between visible and hidden every 100 milliseconds.
9. WHILE the Invincibility_Period is active, THE Collision_Detector SHALL ignore collisions between the Ghost Hitbox and pipe Hitboxes.
10. WHILE the Invincibility_Period is active, THE Collision_Detector SHALL continue to apply the Ground boundary and the Ceiling boundary.
11. WHEN the Invincibility_Period ends, THE Renderer SHALL draw the Ghost continuously visible and THE Collision_Detector SHALL apply collisions with pipe Hitboxes.
12. WHEN the Game_State changes to Game_Over, THE Game SHALL end the Invincibility_Period.
13. THE Game SHALL start the Invincibility_Period only at the start of a round and SHALL grant no invincibility after a collision.
14. WHILE the Crash_Animation is running, THE Renderer SHALL draw the Ghost using the death Ghost_Animation defined in Requirement 18.

### Requirement 8: Restart and Input Lockout

**User Story:** As a player, I want to restart quickly after losing without restarting by accident, so that I can try again.

#### Acceptance Criteria

1. WHEN the Game_State changes to Game_Over, THE Game SHALL ignore Jump_Input for 500 milliseconds so that an accidental input does not restart the round.
2. WHEN a Jump_Input occurs while the Game_State is Game_Over and at least 500 milliseconds have elapsed since the Game_State changed to Game_Over, THE Game SHALL reset the Ghost, remove all Pipe_Pairs, set the Score to 0, set the Scroll_Speed to the Initial_Scroll_Speed, start the Invincibility_Period, apply a jump to the Ghost and change the Game_State directly to Playing.
3. WHEN the Game restarts from Game_Over, THE Audio_Player SHALL play `assets/jump.wav` once for the initial jump.
4. WHILE the Game_State is Game_Over and the input lockout is active, THE Audio_Player SHALL NOT play `assets/jump.wav`.

### Requirement 9: Retro Visual Style

**User Story:** As a player, I want a retro look, so that the game feels like a classic arcade title.

#### Acceptance Criteria

1. THE Renderer SHALL draw the Play_Area on an HTML canvas with a fixed logical resolution of 480 by 640 and SHALL scale the canvas to fit the browser window while preserving the aspect ratio.
2. THE Renderer SHALL draw the Ghost using `assets/ghosty.png`.
3. THE Renderer SHALL draw the background, clouds, pipes and Ground in a retro pixel-art style consistent with the reference screenshot `img/example-ui.png`.
4. THE Renderer SHALL render the Score and text overlays in a pixel-style font.
5. THE Renderer SHALL disable image smoothing so that sprites keep sharp pixel edges.
6. WHILE the Game_State is Playing, THE Renderer SHALL draw the Ground scrolling at the same speed as the pipes.

### Requirement 10: Input Handling

**User Story:** As a player, I want to control the game with keyboard, mouse or touch, so that I can play on desktop and mobile.

#### Acceptance Criteria

1. WHEN the player presses the Space key, THE Game SHALL treat the press as a Jump_Input.
2. WHEN the player clicks the Play_Area with the mouse, THE Game SHALL treat the click as a Jump_Input.
3. WHEN the player touches the Play_Area, THE Game SHALL treat the touch as a Jump_Input.
4. WHEN the Space key is pressed, THE Game SHALL prevent the browser default action of scrolling the page.
5. WHEN a key is held down, THE Game SHALL treat only the initial key press as a Jump_Input or Pause_Input.
6. WHILE the Game_State is Paused, THE Game SHALL ignore Jump_Input.
7. WHILE the Game_State is Main_Menu and a Menu_Button is selected, WHEN the player presses the Space key or the Enter key, THE Game SHALL activate the selected Menu_Button instead of treating the press as a Jump_Input.

### Requirement 11: Sound Control

**User Story:** As a player, I want to control sound, so that I can play quietly when needed.

#### Acceptance Criteria

1. THE Game SHALL provide a mute toggle that the player can activate with the M key or with an on-screen control.
2. WHILE sound is muted, THE Audio_Player SHALL not play `assets/jump.wav`, `assets/score.wav` or `assets/game_over.wav`.
3. IF the browser blocks audio playback, THEN THE Game SHALL continue to run without sound.
4. WHEN the Audio_Player plays any of `assets/jump.wav`, `assets/score.wav` or `assets/game_over.wav` while a previous playback of the same sound is still in progress, THE Audio_Player SHALL restart the sound from the beginning.

### Requirement 12: Performance and Timing

**User Story:** As a player, I want smooth performance, so that the game is playable and fair.

#### Acceptance Criteria

1. THE Game SHALL drive updates and rendering with the browser animation frame callback.
2. WHILE the Game_State is Playing, THE Game SHALL render at the display refresh rate up to 60 frames per second on a current desktop browser.
3. WHEN the browser tab becomes hidden while the Game_State is Playing, THE Game SHALL change the Game_State to Paused.
4. WHEN the browser tab becomes visible, THE Game SHALL resume updates without applying the hidden duration as elapsed time.
5. THE Game SHALL cap the elapsed frame time used for a single update at 50 milliseconds.

### Requirement 13: Parallax Cloud Background

**User Story:** As a player, I want semi-transparent clouds drifting at different speeds in the sky, so that the background feels deep and alive.

#### Acceptance Criteria

1. THE Renderer SHALL draw every Cloud behind the Pipe_Pairs, the Ground and the Ghost.
2. THE Renderer SHALL draw every Cloud with an opacity greater than 0 and less than 1.
3. THE Game SHALL assign each Cloud a Cloud_Speed, and the Game SHALL assign at least two distinct Cloud_Speed values across the set of Clouds.
4. THE Game SHALL assign a lower Cloud_Speed to a smaller Cloud than to a larger Cloud, so that smaller Clouds appear farther away and larger Clouds appear nearer.
5. THE Game SHALL assign every Cloud a Cloud_Speed between 10 and 60, which is lower than the Initial_Scroll_Speed and therefore lower than the Scroll_Speed at all times.
6. WHILE the Game_State is Playing, THE Game SHALL move every Cloud leftward at its assigned Cloud_Speed using elapsed frame time.
7. WHEN a Cloud moves completely beyond the left edge of the Play_Area, THE Game SHALL reposition that Cloud just beyond the right edge of the Play_Area so that the sky remains continuous.
8. WHILE the Game_State is Main_Menu, Paused or Game_Over, THE Game SHALL hold Cloud positions unchanged.
9. THE Collision_Detector SHALL exclude Clouds from collision tests against the Ghost.
10. THE Game SHALL exclude Clouds from Score calculation.
11. WHEN THE Game repositions a Cloud beyond the right edge of the Play_Area, THE Game SHALL keep the original vertical position of that Cloud.

### Requirement 14: Pause Functionality

**User Story:** As a player, I want to pause and resume a round, so that I can take a break without losing progress.

#### Acceptance Criteria

1. WHEN a Pause_Input occurs while the Game_State is Playing, THE Game SHALL change the Game_State to Paused.
2. WHEN a Pause_Input occurs while the Game_State is Paused, THE Game SHALL change the Game_State to Playing.
3. THE Game SHALL provide an on-screen pause control that the player can activate with a mouse click or a touch.
4. WHILE the Game_State is Paused, THE Game SHALL freeze the Ghost position, the Ghost velocity, the Pipe_Pair positions, the Ground position, the Cloud positions, the Score, the Scroll_Speed and the remaining Invincibility_Period.
5. WHILE the Game_State is Paused, THE Renderer SHALL display the Play_Area with a paused overlay that states how to resume.
6. WHEN the Game_State changes from Paused to Playing, THE Game SHALL exclude the time spent in Paused from every elapsed time calculation.
7. WHILE the Game_State is Paused, THE Collision_Detector SHALL skip collision tests.
8. WHILE the Game_State is Main_Menu or Game_Over, THE Game SHALL ignore Pause_Input.

### Requirement 15: Game State Transitions

**User Story:** As a player, I want the game to move predictably between menu, play, pause and game over, so that the controls behave consistently.

#### Acceptance Criteria

1. WHEN the page finishes loading, THE Game SHALL set the Game_State to Main_Menu.
2. WHEN a Jump_Input occurs while the Game_State is Main_Menu, THE Game SHALL change the Game_State to Playing.
3. WHEN a Pause_Input occurs while the Game_State is Playing, THE Game SHALL change the Game_State to Paused.
4. WHEN the browser tab becomes hidden while the Game_State is Playing, THE Game SHALL change the Game_State to Paused.
5. WHEN a Pause_Input occurs while the Game_State is Paused, THE Game SHALL change the Game_State to Playing.
6. WHEN a collision ends a round while the Game_State is Playing, THE Game SHALL change the Game_State to Game_Over.
7. WHEN a Jump_Input occurs after the 500 millisecond input lockout while the Game_State is Game_Over, THE Game SHALL change the Game_State to Playing.
8. THE Game SHALL permit only the transitions Main_Menu to Playing, Playing to Paused, Paused to Playing, Playing to Game_Over and Game_Over to Playing.
9. THE Game SHALL NOT change the Game_State from Main_Menu to Paused or Game_Over, from Paused to Game_Over or Main_Menu, from Game_Over to Paused or Main_Menu, or from Playing to Main_Menu.

### Requirement 16: Persistent Score Storage

**User Story:** As a player, I want my best score remembered, so that I can try to beat it across sessions.

#### Acceptance Criteria

1. WHEN the Game_State changes to Game_Over and the Score is greater than the stored High_Score, THE Score_Store SHALL save the Score as the new High_Score in browser local storage.
2. WHEN the page loads, THE Score_Store SHALL read the High_Score from browser local storage.
3. IF browser local storage is unavailable or contains a value that is not a non-negative integer, THEN THE Score_Store SHALL treat the High_Score as 0 and THE Game SHALL continue to run.
4. FOR ALL non-negative integer values, saving a High_Score and then reading the High_Score SHALL return the saved value (round-trip property).
5. WHEN the Score is less than or equal to the stored High_Score at Game_Over, THE Score_Store SHALL leave the stored High_Score unchanged.
6. WHEN the Game_State changes to Main_Menu or Game_Over, THE Renderer SHALL display the High_Score read from the Score_Store.

### Requirement 17: Menu Buttons and Screen Layout

**User Story:** As a player, I want clear menu buttons and an on-screen HUD, so that I can navigate the game with keyboard, mouse or touch.

#### Acceptance Criteria

1. WHILE the Game_State is Main_Menu, THE Renderer SHALL display a PLAY Menu_Button and a HIGH SCORES Menu_Button, each 200 by 44 and centered horizontally, 16 apart.
2. WHILE the Game_State is Main_Menu, THE Game SHALL initially select the PLAY Menu_Button and THE Renderer SHALL highlight the selected Menu_Button with a white border.
3. WHEN the player presses the Up key or the Down key while the Game_State is Main_Menu, THE Game SHALL move the Menu_Button selection to the previous or next Menu_Button.
4. WHEN the player activates the PLAY Menu_Button with a mouse click, a touch, or the Space or Enter key, THE Game SHALL start a round with the same effects as a Jump_Input on the Main_Menu.
5. WHEN the player activates the HIGH SCORES Menu_Button, THE Renderer SHALL display the High_Scores_Panel showing "BEST: N", where N is the High_Score, and a BACK Menu_Button.
6. WHEN the player activates the BACK Menu_Button, THE Game SHALL close the High_Scores_Panel and return to the Main_Menu while the Game_State remains Main_Menu.
7. WHILE the High_Scores_Panel is displayed, THE Game SHALL ignore Jump_Input that is not an activation of the BACK Menu_Button.
8. WHILE the Game_State is Playing, THE Renderer SHALL display the Score centered at the top of the Play_Area, a mute icon at the top left and a pause icon at the top right, each icon 32 by 32 with a 16 margin.
9. WHILE the Game_State is Main_Menu, THE Renderer SHALL hide the mute icon and the pause icon.
10. WHILE the Game_State is Game_Over and the Crash_Animation has ended, THE Renderer SHALL display the final Score, the High_Score labeled "BEST" and a RESTART Menu_Button.
11. WHERE the final Score is a New_High_Score, THE Renderer SHALL display "NEW BEST!" in the highlight color on the game over overlay, and WHERE the final Score is not a New_High_Score, THE Renderer SHALL omit that indication.
12. WHEN the player activates the RESTART Menu_Button after at least 500 milliseconds have elapsed since the Game_State changed to Game_Over, THE Game SHALL restart the round with the same effects as a Jump_Input in Game_Over.
13. WHEN the player activates the RESTART Menu_Button less than 500 milliseconds after the Game_State changed to Game_Over, THE Game SHALL ignore the activation.
14. WHILE the Game_State is Paused, THE Renderer SHALL display the paused overlay as defined in Requirement 14.

### Requirement 18: Ghost Animation States

**User Story:** As a player, I want Ghosty to animate while idle, flapping and crashing, so that the game feels lively.

#### Acceptance Criteria

1. WHILE the Game_State is Main_Menu, THE Renderer SHALL loop the idle Ghost_Animation of 2 frames lasting 300 milliseconds each, where the second frame is the Ghost shifted 1 up.
2. WHEN a jump is applied to the Ghost while the Game_State is Playing, THE Renderer SHALL play the flap Ghost_Animation once, consisting of 3 frames lasting 60, 60 and 80 milliseconds.
3. WHEN a jump is applied while the flap Ghost_Animation is playing, THE Renderer SHALL restart the flap Ghost_Animation from its first frame.
4. WHEN the flap Ghost_Animation ends, THE Renderer SHALL draw the first idle frame until the next jump.
5. WHEN the Crash_Animation starts, THE Renderer SHALL play the death Ghost_Animation of 4 frames lasting 100 milliseconds each, followed by a final frame that THE Renderer SHALL hold until the next round begins.
6. THE Renderer SHALL produce Ghost_Animation frames either from runtime transforms of `assets/ghosty.png` or from a sprite sheet.
7. THE Renderer SHALL draw every Ghost_Animation frame at 32 by 32 with the rotation pivot at the sprite center.

### Requirement 19: Score Sound and Audio Characteristics

**User Story:** As a player, I want distinct sounds for flapping, scoring and crashing, so that I get audio feedback on every event.

#### Acceptance Criteria

1. WHEN the Score increases, THE Audio_Player SHALL play `assets/score.wav`, a pleasant chime of about 0.2 seconds.
2. THE Audio_Player SHALL use `assets/jump.wav` as a short whoosh of about 0.1 seconds for the flap sound.
3. THE Audio_Player SHALL use `assets/game_over.wav` as a soft thud of about 0.3 seconds for the collision sound.
4. WHILE sound is muted, THE Audio_Player SHALL not play `assets/score.wav`.
5. IF the browser blocks audio playback, THEN THE Game SHALL continue to run without playing `assets/score.wav`.
6. IF `assets/score.wav` fails to load, THEN THE Game SHALL play no score sound and SHALL continue to play every other sound normally.
7. WHILE the Invincibility_Period is active, THE Audio_Player SHALL play `assets/score.wav` each time the Score increases.
