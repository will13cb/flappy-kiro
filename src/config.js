// Flappy Kiro config module: maps game-config.json to UPPER_SNAKE groups,
// adds fixed UI/animation values, computes derived values and builds a frozen config.
(function (root) {
  'use strict';

  // [jsonGroup, jsonKey, configGroup, CONFIG_KEY]
  const SCALAR_MAP = [
    ['world', 'width', 'world', 'WIDTH'],
    ['world', 'height', 'world', 'HEIGHT'],
    ['world', 'groundHeight', 'world', 'GROUND_HEIGHT'],
    ['ghost', 'spriteSize', 'ghost', 'SPRITE_SIZE'],
    ['ghost', 'hitboxShape', 'ghost', 'HITBOX_SHAPE'],
    ['ghost', 'hitboxRadius', 'ghost', 'HITBOX_RADIUS'],
    ['ghost', 'x', 'ghost', 'X'],
    ['ghost', 'gravity', 'ghost', 'GRAVITY'],
    ['ghost', 'jumpVelocity', 'ghost', 'JUMP_VELOCITY'],
    ['pipes', 'pipeWidth', 'pipes', 'PIPE_WIDTH'],
    ['pipes', 'capWidth', 'pipes', 'CAP_WIDTH'],
    ['pipes', 'capHeight', 'pipes', 'CAP_HEIGHT'],
    ['pipes', 'gapHeight', 'pipes', 'GAP_HEIGHT'],
    ['pipes', 'gapMargin', 'pipes', 'GAP_MARGIN'],
    ['pipes', 'pipeSpacing', 'pipes', 'PIPE_SPACING'],
    ['pipes', 'maxGapShift', 'pipes', 'MAX_GAP_SHIFT'],
    ['speed', 'wallSpeed', 'speed', 'INITIAL_SPEED'],
    ['speed', 'speedIncrement', 'speed', 'SPEED_INCREMENT'],
    ['speed', 'speedStepInterval', 'speed', 'SPEED_STEP_INTERVAL'],
    ['speed', 'maxSpeed', 'speed', 'MAX_SPEED'],
    ['timing', 'invincibilityMs', 'timing', 'INVINCIBILITY_MS'],
    ['timing', 'crashMs', 'timing', 'CRASH_MS'],
    ['timing', 'crashFlashMs', 'timing', 'CRASH_FLASH_MS'],
    ['timing', 'blinkMs', 'timing', 'BLINK_MS'],
    ['timing', 'lockoutMs', 'timing', 'LOCKOUT_MS'],
    ['timing', 'maxFrameMs', 'timing', 'MAX_FRAME_MS'],
    ['clouds', 'speedMin', 'clouds', 'SPEED_MIN'],
    ['clouds', 'speedMax', 'clouds', 'SPEED_MAX'],
  ];

  const LAYER_MAP = [
    ['width', 'WIDTH'],
    ['depth', 'DEPTH'],
    ['alpha', 'ALPHA'],
  ];

  const GROUPS = ['world', 'ghost', 'pipes', 'speed', 'timing', 'clouds'];

  function has(obj, key) {
    return obj !== null && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key);
  }

  // JSON (camelCase, grouped) -> base values (UPPER_SNAKE groups). Ignores _comment.
  function mapJson(json) {
    const base = {};
    GROUPS.forEach((g) => { base[g] = {}; });
    SCALAR_MAP.forEach(([jg, jk, cg, ck]) => {
      if (!has(json, jg)) throw new Error('game-config.json: missing key "' + jg + '"');
      if (!has(json[jg], jk)) throw new Error('game-config.json: missing key "' + jg + '.' + jk + '"');
      base[cg][ck] = json[jg][jk];
    });
    if (!Array.isArray(json.clouds.layers)) {
      throw new Error('game-config.json: missing key "clouds.layers"');
    }
    base.clouds.LAYERS = json.clouds.layers.map((layer, i) => {
      const out = {};
      LAYER_MAP.forEach(([jk, ck]) => {
        if (!has(layer, jk)) {
          throw new Error('game-config.json: missing key "clouds.layers[' + i + '].' + jk + '"');
        }
        out[ck] = layer[jk];
      });
      return out;
    });
    return base;
  }

  // Inverse of mapJson (no _comment).
  function unmapJson(base) {
    const json = {};
    GROUPS.forEach((g) => { json[g] = {}; });
    SCALAR_MAP.forEach(([jg, jk, cg, ck]) => {
      json[jg][jk] = base[cg][ck];
    });
    json.clouds.layers = base.clouds.LAYERS.map((layer) => {
      const out = {};
      LAYER_MAP.forEach(([jk, ck]) => { out[jk] = layer[ck]; });
      return out;
    });
    return json;
  }

  // Fixed by ui-mockups.md and ghosty-sprites.md, not tuned in game-config.json.
  const EXTRA_BASE = {
    ui: {
      BUTTON_WIDTH: 200,
      BUTTON_HEIGHT: 44,
      BUTTON_GAP: 16,
      MENU_BUTTON_Y: 400,
      PANEL_BUTTON_Y: 400,
      GAME_OVER_BUTTON_Y: 400,
      ICON_SIZE: 32,
      ICON_MARGIN: 16,
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

  function getGameConfig() {
    let source;
    if (root && root.GAME_CONFIG) {
      source = root.GAME_CONFIG;
    } else if (typeof require === 'function') {
      try {
        source = require('./game-config').GAME_CONFIG;
      } catch (e) {
        source = undefined;
      }
    }
    if (!source) {
      throw new Error('game-config.js not loaded: run npm run sync-config');
    }
    return source;
  }

  // overrides: { [group]: { [KEY]: value } }. Only whitelisted (group, KEY) pairs apply.
  function buildConfig(overrides) {
    const base = mapJson(getGameConfig());
    base.ui = clone(EXTRA_BASE.ui);
    base.animation = clone(EXTRA_BASE.animation);

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

  const POSITIVE_KEYS = {
    world: ['WIDTH', 'HEIGHT', 'GROUND_HEIGHT'],
    ghost: ['SPRITE_SIZE', 'HITBOX_RADIUS', 'GRAVITY'],
    pipes: ['PIPE_WIDTH', 'CAP_WIDTH', 'CAP_HEIGHT', 'GAP_HEIGHT', 'PIPE_SPACING', 'MAX_GAP_SHIFT'],
    speed: ['INITIAL_SPEED', 'SPEED_STEP_INTERVAL', 'MAX_SPEED'],
    timing: ['INVINCIBILITY_MS', 'CRASH_MS', 'CRASH_FLASH_MS', 'BLINK_MS', 'LOCKOUT_MS', 'MAX_FRAME_MS'],
    clouds: ['SPEED_MIN', 'SPEED_MAX'],
    ui: ['BUTTON_WIDTH', 'BUTTON_HEIGHT', 'ICON_SIZE'],
  };

  function isNum(v) {
    return typeof v === 'number' && Number.isFinite(v);
  }

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
    const ui = c.ui || {};
    const anim = c.animation || {};

    // number.finite
    Object.keys(c).forEach((g) => {
      const grp = c[g];
      if (!grp || typeof grp !== 'object') return;
      Object.keys(grp).forEach((k) => {
        if (typeof grp[k] === 'number' && !Number.isFinite(grp[k])) {
          fail('number.finite', g + '.' + k + ' (' + grp[k] + ') must be a finite number');
        }
      });
    });
    Object.keys(POSITIVE_KEYS).forEach((g) => {
      POSITIVE_KEYS[g].forEach((k) => {
        const v = (c[g] || {})[k];
        if (!isNum(v)) {
          if (v === undefined || typeof v !== 'number') fail('number.finite', g + '.' + k + ' must be a finite number');
        } else if (!(v > 0)) {
          fail('number.finite', k + ' (' + v + ') must be greater than 0');
        }
      });
    });
    if (!Number.isInteger(speed.SPEED_STEP_INTERVAL)) {
      fail('number.finite', 'SPEED_STEP_INTERVAL (' + speed.SPEED_STEP_INTERVAL + ') must be an integer');
    }
    if (!(speed.SPEED_INCREMENT >= 0)) {
      fail('number.finite', 'SPEED_INCREMENT (' + speed.SPEED_INCREMENT + ') must be >= 0');
    }
    if (!(pipes.GAP_MARGIN >= 0)) {
      fail('number.finite', 'GAP_MARGIN (' + pipes.GAP_MARGIN + ') must be >= 0');
    }

    if (ghost.HITBOX_SHAPE !== 'circle') {
      fail('ghost.shape', 'HITBOX_SHAPE (' + ghost.HITBOX_SHAPE + ') must be "circle"');
    }
    if (!(ghost.HITBOX_RADIUS > 0 && 2 * ghost.HITBOX_RADIUS <= ghost.SPRITE_SIZE)) {
      fail('ghost.radiusFits', 'HITBOX_RADIUS (' + ghost.HITBOX_RADIUS + ') must be > 0 and 2 * HITBOX_RADIUS must be <= SPRITE_SIZE (' + ghost.SPRITE_SIZE + ')');
    }
    if (!(ghost.JUMP_VELOCITY < 0)) {
      fail('ghost.jumpUp', 'JUMP_VELOCITY (' + ghost.JUMP_VELOCITY + ') must be < 0');
    }
    if (!(ghost.X > 0 && ghost.X < world.WIDTH)) {
      fail('ghost.insideWorld', 'X (' + ghost.X + ') must be between 0 and WIDTH (' + world.WIDTH + ')');
    }
    if (!(pipes.CAP_WIDTH >= pipes.PIPE_WIDTH)) {
      fail('pipes.capCoversBody', 'CAP_WIDTH (' + pipes.CAP_WIDTH + ') must be >= PIPE_WIDTH (' + pipes.PIPE_WIDTH + ')');
    }
    if (!(pipes.PIPE_SPACING > pipes.CAP_WIDTH)) {
      fail('pipes.spacing', 'PIPE_SPACING (' + pipes.PIPE_SPACING + ') must be > CAP_WIDTH (' + pipes.CAP_WIDTH + ')');
    }
    if (!(pipes.GAP_HEIGHT > 2 * ghost.HITBOX_RADIUS)) {
      fail('gap.heightVsHitbox', 'GAP_HEIGHT (' + pipes.GAP_HEIGHT + ') must be greater than 2 * HITBOX_RADIUS (' + 2 * ghost.HITBOX_RADIUS + ')');
    }
    if (!(2 * pipes.GAP_MARGIN + pipes.GAP_HEIGHT <= world.GROUND_TOP)) {
      fail('gap.fitsAboveGround', '2 * GAP_MARGIN + GAP_HEIGHT (' + (2 * pipes.GAP_MARGIN + pipes.GAP_HEIGHT) + ') must be <= GROUND_TOP (' + world.GROUND_TOP + ')');
    }
    if (!(pipes.MAX_GAP_SHIFT > 0)) {
      fail('gap.shiftPositive', 'MAX_GAP_SHIFT (' + pipes.MAX_GAP_SHIFT + ') must be > 0');
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

    const layers = Array.isArray(clouds.LAYERS) ? clouds.LAYERS : [];
    let layersOk = layers.length >= 2;
    layers.forEach((l) => {
      if (!(l && l.DEPTH >= 0 && l.DEPTH <= 1 && l.ALPHA > 0 && l.ALPHA < 1)) layersOk = false;
    });
    if (layersOk) {
      const sorted = layers.slice().sort((a, b) => a.DEPTH - b.DEPTH);
      for (let i = 1; i < sorted.length; i++) {
        if (!(sorted[i].DEPTH > sorted[i - 1].DEPTH && sorted[i].WIDTH > sorted[i - 1].WIDTH)) layersOk = false;
      }
    }
    if (!layersOk) {
      fail('clouds.layers', 'need at least 2 layers with DEPTH in [0, 1], ALPHA in (0, 1), and distinct depths that increase with WIDTH');
    }

    ['INVINCIBILITY_MS', 'CRASH_MS', 'CRASH_FLASH_MS', 'BLINK_MS', 'LOCKOUT_MS', 'MAX_FRAME_MS'].forEach((k) => {
      if (!(timing[k] > 0)) fail('timing.positive', k + ' (' + timing[k] + ') must be > 0');
    });

    const tableOk = (t, min) => Array.isArray(t) && t.length >= min && t.every((f) => f && f.ms > 0);
    if (!tableOk(anim.IDLE_FRAMES, 2)) fail('anim.tables', 'IDLE_FRAMES needs at least 2 frames with ms > 0');
    if (!tableOk(anim.FLAP_FRAMES, 1)) fail('anim.tables', 'FLAP_FRAMES needs at least 1 frame with ms > 0');
    if (!Array.isArray(anim.DEATH_FRAMES) || anim.DEATH_FRAMES.length < 1) {
      fail('anim.tables', 'DEATH_FRAMES needs at least 1 frame');
    }
    if (!(anim.DEATH_TOTAL_MS <= timing.CRASH_MS)) {
      fail('anim.deathFitsCrash', 'DEATH_TOTAL_MS (' + anim.DEATH_TOTAL_MS + ') must be <= CRASH_MS (' + timing.CRASH_MS + ')');
    }

    const uiErrors = [];
    if (!(ui.BUTTON_WIDTH <= world.WIDTH)) uiErrors.push('BUTTON_WIDTH (' + ui.BUTTON_WIDTH + ') must be <= WIDTH (' + world.WIDTH + ')');
    if (!(ui.MENU_STACK_BOTTOM <= world.GROUND_TOP)) uiErrors.push('MENU_STACK_BOTTOM (' + ui.MENU_STACK_BOTTOM + ') must be <= GROUND_TOP (' + world.GROUND_TOP + ')');
    ['MENU_BUTTON_Y', 'PANEL_BUTTON_Y', 'GAME_OVER_BUTTON_Y'].forEach((k) => {
      if (!(ui[k] + ui.BUTTON_HEIGHT <= world.GROUND_TOP)) uiErrors.push(k + ' + BUTTON_HEIGHT must be <= GROUND_TOP (' + world.GROUND_TOP + ')');
    });
    if (!(ui.MUTE_ICON_X + ui.ICON_SIZE <= ui.PAUSE_ICON_X)) uiErrors.push('MUTE_ICON_X + ICON_SIZE must be <= PAUSE_ICON_X (' + ui.PAUSE_ICON_X + ')');
    uiErrors.forEach((m) => fail('ui.fits', m));

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

  const api = {
    parseOverrides,
    loadConfig,
    mapJson,
    unmapJson,
    EXTRA_BASE,
    derive,
    TUNABLE,
    buildConfig,
    validateConfig,
    assertValidConfig,
    DEFAULT_CONFIG,
  };

  if (typeof window !== 'undefined') {
    window.FlappyKiro = window.FlappyKiro || {};
    Object.assign(window.FlappyKiro, api);
  }
  if (typeof module !== 'undefined' && module.exports) {
    Object.assign(module.exports, api);
  }
})(typeof window !== 'undefined' ? (window.FlappyKiro = window.FlappyKiro || {}) : {});
