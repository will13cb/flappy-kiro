// Flappy Kiro config: base values, derived values, URL-tunable overrides and validation.
// Units: px = logical pixels, ms = milliseconds, speeds in px/s, gravity in px/s^2.
// Y grows downward, so an upward jump velocity is negative.
const BASE = {
  world: { WIDTH: 480, HEIGHT: 640, GROUND_HEIGHT: 80 },
  ghost: {
    SPRITE_SIZE: 32, HITBOX_SHAPE: 'circle', HITBOX_RADIUS: 12, X: 120, GRAVITY: 800, JUMP_VELOCITY: -300,
  },
  pipes: {
    PIPE_WIDTH: 64, CAP_WIDTH: 72, CAP_HEIGHT: 24, GAP_HEIGHT: 140, GAP_MARGIN: 60,
    PIPE_SPACING: 350, MAX_GAP_SHIFT: 160,
  },
  speed: { INITIAL_SPEED: 120, SPEED_INCREMENT: 10, SPEED_STEP_INTERVAL: 5, MAX_SPEED: 240 },
  timing: {
    INVINCIBILITY_MS: 1500, CRASH_MS: 500, CRASH_FLASH_MS: 100, BLINK_MS: 100, LOCKOUT_MS: 1000, MAX_FRAME_MS: 50,
  },
  clouds: {
    SPEED_MIN: 10,
    SPEED_MAX: 60,
    LAYERS: [
      { WIDTH: 40, DEPTH: 0.1, ALPHA: 0.5 },
      { WIDTH: 80, DEPTH: 0.5, ALPHA: 0.6 },
      { WIDTH: 120, DEPTH: 0.9, ALPHA: 0.7 },
    ],
  },
  ui: {
    BUTTON_WIDTH: 200, BUTTON_HEIGHT: 44, BUTTON_GAP: 16,
    MENU_BUTTON_Y: 400, PANEL_BUTTON_Y: 400, GAME_OVER_BUTTON_Y: 400,
    ICON_SIZE: 32, ICON_MARGIN: 16,
  },
  animation: {
    IDLE_FRAMES: [{ ms: 300, offsetY: 0 }, { ms: 300, offsetY: -1 }],
    FLAP_FRAMES: [
      { ms: 60, scaleX: 1.0, scaleY: 1.15 },
      { ms: 60, scaleX: 1.0, scaleY: 1.0 },
      { ms: 80, scaleX: 1.1, scaleY: 0.9 },
    ],
    DEATH_FRAMES: [
      { rotation: 0, tint: true },
      { rotation: 45, tint: false },
      { rotation: 90, tint: true },
      { rotation: 90, tint: false },
    ],
    DEATH_FINAL: { rotation: 90, tint: false },
    SHEET_FILE: 'assets/ghosty-sheet.png',
  },
};
function has(obj, key) {
  return obj !== null && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key);
}
function sum(list, key) {
  return list.reduce((acc, item) => acc + item[key], 0);
}

// Derived values: computed only here, never overridable.
function derive(b) {
  const GROUND_TOP = b.world.HEIGHT - b.world.GROUND_HEIGHT;
  const stackH = 2 * b.ui.BUTTON_HEIGHT + b.ui.BUTTON_GAP;
  return {
    world: { GROUND_TOP, MENU_GHOST_Y: b.world.HEIGHT / 2 },
    ghost: {
      JUMP_SPEED: -b.ghost.JUMP_VELOCITY,
      HITBOX_MARGIN: b.ghost.SPRITE_SIZE / 2 - b.ghost.HITBOX_RADIUS,
    },
    pipes: {
      CAP_INSET: (b.pipes.CAP_WIDTH - b.pipes.PIPE_WIDTH) / 2,
      GAP_CENTER_MIN: b.pipes.GAP_MARGIN + b.pipes.GAP_HEIGHT / 2,
      GAP_CENTER_MAX: GROUND_TOP - b.pipes.GAP_MARGIN - b.pipes.GAP_HEIGHT / 2,
      SPAWN_X: b.world.WIDTH - b.pipes.PIPE_SPACING,
    },
    timing: {
      MAX_DT: b.timing.MAX_FRAME_MS / 1000,
      DEATH_FRAME_MS: b.timing.CRASH_FLASH_MS,
    },
    clouds: {
      LAYER_SPEEDS: b.clouds.LAYERS.map(
        (l) => b.clouds.SPEED_MIN + l.DEPTH * (b.clouds.SPEED_MAX - b.clouds.SPEED_MIN)
      ),
    },
    ui: {
      BUTTON_X: (b.world.WIDTH - b.ui.BUTTON_WIDTH) / 2,
      MENU_STACK_BOTTOM: b.ui.MENU_BUTTON_Y + stackH,
      MUTE_ICON_X: b.ui.ICON_MARGIN,
      PAUSE_ICON_X: b.world.WIDTH - b.ui.ICON_MARGIN - b.ui.ICON_SIZE,
      ICON_Y: b.ui.ICON_MARGIN,
    },
    animation: {
      IDLE_TOTAL_MS: sum(b.animation.IDLE_FRAMES, 'ms'),
      FLAP_TOTAL_MS: sum(b.animation.FLAP_FRAMES, 'ms'),
      DEATH_TOTAL_MS: b.animation.DEATH_FRAMES.length * b.timing.CRASH_FLASH_MS,
    },
  };
}

// Tunable keys exposed to URL overrides. Anything not listed is not overridable.
const TUNABLE = Object.freeze({
  gravity: ['ghost', 'GRAVITY'],
  jumpVelocity: ['ghost', 'JUMP_VELOCITY'],
  hitboxRadius: ['ghost', 'HITBOX_RADIUS'],
  gapHeight: ['pipes', 'GAP_HEIGHT'],
  gapMargin: ['pipes', 'GAP_MARGIN'],
  pipeSpacing: ['pipes', 'PIPE_SPACING'],
  maxGapShift: ['pipes', 'MAX_GAP_SHIFT'],
  wallSpeed: ['speed', 'INITIAL_SPEED'],
  speedIncrement: ['speed', 'SPEED_INCREMENT'],
  speedStepInterval: ['speed', 'SPEED_STEP_INTERVAL'],
  maxSpeed: ['speed', 'MAX_SPEED'],
  invincibilityMs: ['timing', 'INVINCIBILITY_MS'],
  crashMs: ['timing', 'CRASH_MS'],
  lockoutMs: ['timing', 'LOCKOUT_MS'],
  cloudSpeedMin: ['clouds', 'SPEED_MIN'],
  cloudSpeedMax: ['clouds', 'SPEED_MAX'],
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(obj) {
  if (obj !== null && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    Object.keys(obj).forEach((k) => deepFreeze(obj[k]));
  }
  return obj;
}

// overrides: { [group]: { [KEY]: value } }. Only whitelisted (group, KEY) pairs apply.
function buildConfig(overrides) {
  const base = clone(BASE);

  const allowed = new Set(Object.keys(TUNABLE).map((k) => TUNABLE[k][0] + '.' + TUNABLE[k][1]));
  if (overrides && typeof overrides === 'object') {
    Object.keys(overrides).forEach((g) => {
      const grp = overrides[g];
      if (!grp || typeof grp !== 'object' || !has(base, g)) return;
      Object.keys(grp).forEach((key) => {
        if (allowed.has(g + '.' + key)) base[g][key] = grp[key];
      });
    });
  }

  const derived = derive(base);
  const cfg = {};
  Object.keys(base).forEach((g) => {
    cfg[g] = Object.assign({}, base[g], derived[g] || {});
  });
  return deepFreeze(cfg);
}

// Tunable keys that must be finite and > 0 (the others are checked separately).
const POSITIVE_KEYS = {
  ghost: ['GRAVITY', 'HITBOX_RADIUS'],
  pipes: ['GAP_HEIGHT', 'PIPE_SPACING', 'MAX_GAP_SHIFT'],
  speed: ['INITIAL_SPEED', 'SPEED_STEP_INTERVAL', 'MAX_SPEED'],
  timing: ['INVINCIBILITY_MS', 'CRASH_MS', 'LOCKOUT_MS'],
  clouds: ['SPEED_MIN', 'SPEED_MAX'],
};
// Returns { valid, errors }. Every error starts with its stable rule id.
function validateConfig(cfg) {
  const errors = [];
  const fail = (id, msg) => errors.push(id + ': ' + msg);
  const c = cfg || {};
  const world = c.world || {};
  const ghost = c.ghost || {};
  const pipes = c.pipes || {};
  const speed = c.speed || {};
  const timing = c.timing || {};
  const clouds = c.clouds || {};
  const anim = c.animation || {};
  // number.finite: no NaN/Infinity anywhere, tunables positive.
  Object.keys(c).forEach((g) => {
    const grp = c[g];
    if (!grp || typeof grp !== 'object') return;
    Object.keys(grp).forEach((k) => {
      if (typeof grp[k] === 'number' && !Number.isFinite(grp[k])) {
        fail('number.finite', g + '.' + k + ' (' + grp[k] + ') must be a finite number');
      }
    });
  });
  const finiteNum = (g, k) => {
    const v = (c[g] || {})[k];
    if (typeof v !== 'number') fail('number.finite', g + '.' + k + ' must be a finite number');
    return v;
  };
  Object.keys(POSITIVE_KEYS).forEach((g) => {
    POSITIVE_KEYS[g].forEach((k) => {
      const v = finiteNum(g, k);
      if (Number.isFinite(v) && !(v > 0)) fail('number.finite', k + ' (' + v + ') must be greater than 0');
    });
  });
  finiteNum('ghost', 'JUMP_VELOCITY');
  finiteNum('speed', 'SPEED_INCREMENT');
  finiteNum('pipes', 'GAP_MARGIN');
  if (!Number.isInteger(speed.SPEED_STEP_INTERVAL)) {
    fail('number.finite', 'SPEED_STEP_INTERVAL (' + speed.SPEED_STEP_INTERVAL + ') must be an integer');
  }
  if (!(speed.SPEED_INCREMENT >= 0)) {
    fail('number.finite', 'SPEED_INCREMENT (' + speed.SPEED_INCREMENT + ') must be >= 0');
  }
  if (!(pipes.GAP_MARGIN >= 0)) {
    fail('number.finite', 'GAP_MARGIN (' + pipes.GAP_MARGIN + ') must be >= 0');
  }
  if (!(ghost.JUMP_VELOCITY < 0)) {
    fail('ghost.jumpUp', 'JUMP_VELOCITY (' + ghost.JUMP_VELOCITY + ') must be < 0');
  }
  if (!(ghost.HITBOX_RADIUS > 0 && 2 * ghost.HITBOX_RADIUS <= ghost.SPRITE_SIZE)) {
    fail('ghost.radiusFits', 'HITBOX_RADIUS (' + ghost.HITBOX_RADIUS + ') must be > 0 and 2 * HITBOX_RADIUS must be <= SPRITE_SIZE (' + ghost.SPRITE_SIZE + ')');
  }
  if (!(pipes.PIPE_SPACING > pipes.CAP_WIDTH)) {
    fail('pipes.spacing', 'PIPE_SPACING (' + pipes.PIPE_SPACING + ') must be > CAP_WIDTH (' + pipes.CAP_WIDTH + ')');
  }
  if (!(pipes.GAP_HEIGHT > 2 * ghost.HITBOX_RADIUS)) {
    fail('gap.heightVsHitbox', 'GAP_HEIGHT (' + pipes.GAP_HEIGHT + ') must be greater than 2 * HITBOX_RADIUS (' + 2 * ghost.HITBOX_RADIUS + ')');
  }
  if (!(pipes.GAP_MARGIN >= pipes.CAP_HEIGHT)) {
    fail('gap.capFits', 'GAP_MARGIN (' + pipes.GAP_MARGIN + ') must be >= CAP_HEIGHT (' + pipes.CAP_HEIGHT + ')');
  }
  if (!(2 * pipes.GAP_MARGIN + pipes.GAP_HEIGHT <= world.GROUND_TOP)) {
    fail('gap.fitsAboveGround', '2 * GAP_MARGIN + GAP_HEIGHT (' + (2 * pipes.GAP_MARGIN + pipes.GAP_HEIGHT) + ') must be <= GROUND_TOP (' + world.GROUND_TOP + ')');
  }
  if (!(speed.INITIAL_SPEED <= speed.MAX_SPEED)) {
    fail('speed.order', 'INITIAL_SPEED (' + speed.INITIAL_SPEED + ') must be <= MAX_SPEED (' + speed.MAX_SPEED + ')');
  }
  const limit = pipes.PIPE_SPACING / speed.MAX_SPEED;
  const fall = Math.sqrt((2 * pipes.MAX_GAP_SHIFT) / ghost.GRAVITY);
  if (!(fall < limit)) {
    fail('reach.fall', 'fall time (' + fall + ' s) must be < PIPE_SPACING / MAX_SPEED (' + limit + ' s)');
  }
  const jumpSpeed = -ghost.JUMP_VELOCITY;
  const rise = (jumpSpeed * jumpSpeed) / (2 * ghost.GRAVITY);
  const climb = Math.ceil(pipes.MAX_GAP_SHIFT / rise) * (jumpSpeed / ghost.GRAVITY);
  if (!(climb < limit)) {
    fail('reach.climb', 'climb time (' + climb + ' s) must be < PIPE_SPACING / MAX_SPEED (' + limit + ' s)');
  }
  if (!(clouds.SPEED_MIN > 0 && clouds.SPEED_MIN < clouds.SPEED_MAX)) {
    fail('clouds.order', 'SPEED_MIN (' + clouds.SPEED_MIN + ') must be > 0 and < SPEED_MAX (' + clouds.SPEED_MAX + ')');
  }
  if (!(clouds.SPEED_MAX < speed.INITIAL_SPEED)) {
    fail('clouds.belowScroll', 'SPEED_MAX (' + clouds.SPEED_MAX + ') must be < INITIAL_SPEED (' + speed.INITIAL_SPEED + ')');
  }
  ['INVINCIBILITY_MS', 'CRASH_MS', 'LOCKOUT_MS'].forEach((k) => {
    if (!(timing[k] > 0)) fail('timing.positive', k + ' (' + timing[k] + ') must be > 0');
  });
  // The panel appears when crashMs reaches 0; input must stay locked for a while after that.
  if (!(timing.LOCKOUT_MS > timing.CRASH_MS)) {
    fail('timing.lockoutAfterCrash', 'LOCKOUT_MS (' + timing.LOCKOUT_MS + ') must be > CRASH_MS (' + timing.CRASH_MS + ')');
  }
  if (!(anim.DEATH_TOTAL_MS <= timing.CRASH_MS)) {
    fail('anim.deathFitsCrash', 'DEATH_TOTAL_MS (' + anim.DEATH_TOTAL_MS + ') must be <= CRASH_MS (' + timing.CRASH_MS + ')');
  }
  return { valid: errors.length === 0, errors };
}
function assertValidConfig(cfg) {
  const result = validateConfig(cfg);
  if (!result.valid) {
    throw new Error('Invalid Flappy Kiro config:\n - ' + result.errors.join('\n - '));
  }
  return cfg;
}

const DEFAULT_CONFIG = buildConfig({});
assertValidConfig(DEFAULT_CONFIG);

// Parses a query string into whitelisted numeric overrides.
// Returns { overrides: { [group]: { [KEY]: number } }, warnings: string[] }.
function parseOverrides(search) {
  const overrides = {};
  const warnings = [];
  const params = new URLSearchParams(search || '');
  params.forEach((value, name) => {
    if (!Object.prototype.hasOwnProperty.call(TUNABLE, name)) {
      warnings.push('unknown parameter "' + name + '"');
      return;
    }
    const num = value.trim() === '' ? NaN : Number(value);
    if (!Number.isFinite(num)) {
      warnings.push('parameter "' + name + '" must be a number, got "' + value + '"');
      return;
    }
    const group = TUNABLE[name][0];
    const key = TUNABLE[name][1];
    if (!overrides[group]) overrides[group] = {};
    overrides[group][key] = num; // later entries overwrite earlier ones
  });
  return { overrides, warnings };
}

// Builds the config from the query string; never returns an invalid config.
function loadConfig(search, log) {
  const parsed = parseOverrides(search);
  const out = log || { warn: function () {} };
  parsed.warnings.forEach((w) => out.warn(w));
  const cfg = buildConfig(parsed.overrides);
  const result = validateConfig(cfg);
  if (result.valid) return cfg;
  result.errors.forEach((e) => out.warn(e));
  out.warn('invalid overrides in URL; using default config');
  return DEFAULT_CONFIG;
}

export { parseOverrides, loadConfig, derive, TUNABLE, buildConfig, validateConfig, assertValidConfig, DEFAULT_CONFIG };
