// Flappy Kiro physics: ghost motion, jump, tilt and frame time clamp. Pure functions.

// Tilt limits in radians (about 25 degrees up, 70 degrees down) and the
// velocity (px/s) at which the limit is reached.
const TILT_UP_MAX = -0.436;
const TILT_DOWN_MAX = 1.222;
const TILT_FULL_SPEED = 600;
// Smallest tilt magnitude, so any non-zero velocity gives a non-zero angle.
const TILT_EPSILON = 1e-9;

// Semi-implicit Euler: velocity first, then position with the new velocity.
function stepGhost(cfg, ghost, dt) {
  const vy = ghost.vy + cfg.ghost.GRAVITY * dt;
  return { y: ghost.y + vy * dt, vy };
}

function applyJump(cfg, ghost) {
  return { y: ghost.y, vy: cfg.ghost.JUMP_VELOCITY };
}

// Radians: negative when moving up, 0 when still, positive when moving down.
function tiltFor(vy) {
  if (!(vy > 0 || vy < 0)) return 0;
  const ratio = Math.max(-1, Math.min(1, vy / TILT_FULL_SPEED));
  const angle = ratio < 0 ? -ratio * TILT_UP_MAX : ratio * TILT_DOWN_MAX;
  return vy < 0 ? Math.min(angle, -TILT_EPSILON) : Math.max(angle, TILT_EPSILON);
}

// Seconds in, seconds out: min(max(raw, 0), MAX_DT).
function clampDt(cfg, rawSeconds) {
  return Math.min(Math.max(rawSeconds, 0), cfg.timing.MAX_DT);
}

export { stepGhost, applyJump, tiltFor, clampDt };
