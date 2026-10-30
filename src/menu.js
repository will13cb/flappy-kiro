// Flappy Kiro menu: menu model, button and icon layout, hit testing.
// Pure functions on plain objects. MenuState: { selected: 'PLAY' | 'HIGH_SCORES', panelOpen: boolean }

const MENU_BUTTONS = ['PLAY', 'HIGH_SCORES'];

function initialMenu() {
  return { selected: 'PLAY', panelOpen: false };
}

function buttonsFor(mode, menu) {
  if (mode === 'Main_Menu') return menu && menu.panelOpen ? ['BACK'] : MENU_BUTTONS.slice();
  if (mode === 'Game_Over') return ['RESTART'];
  return [];
}

function buttonRect(cfg, name) {
  const u = cfg.ui;
  let y;
  if (name === 'PLAY') y = u.MENU_BUTTON_Y;
  else if (name === 'HIGH_SCORES') y = u.MENU_BUTTON_Y + u.BUTTON_HEIGHT + u.BUTTON_GAP;
  else if (name === 'BACK') y = u.PANEL_BUTTON_Y;
  else if (name === 'RESTART') y = u.GAME_OVER_BUTTON_Y;
  else return null;
  return { x: u.BUTTON_X, y, w: u.BUTTON_WIDTH, h: u.BUTTON_HEIGHT };
}

function iconRect(cfg, name) {
  const u = cfg.ui;
  if (name === 'MUTE') return { x: u.MUTE_ICON_X, y: u.ICON_Y, w: u.ICON_SIZE, h: u.ICON_SIZE };
  if (name === 'PAUSE') return { x: u.PAUSE_ICON_X, y: u.ICON_Y, w: u.ICON_SIZE, h: u.ICON_SIZE };
  return null;
}

function iconsVisible(mode) {
  return mode === 'Playing' || mode === 'Paused';
}

// Half-open: left and top edges are inside, right and bottom edges are outside.
function inRect(r, x, y) {
  return r !== null && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

// state: { mode, menu }. Returns a control name or null.
function hitTest(cfg, state, x, y) {
  const names = buttonsFor(state.mode, state.menu);
  for (let i = 0; i < names.length; i++) {
    if (inRect(buttonRect(cfg, names[i]), x, y)) return names[i];
  }
  if (iconsVisible(state.mode)) {
    const icons = ['MUTE', 'PAUSE'];
    for (let i = 0; i < icons.length; i++) {
      if (inRect(iconRect(cfg, icons[i]), x, y)) return icons[i];
    }
  }
  return null;
}

// dir: 'up' | 'down'. Wraps over the button list; ignored while the panel is open.
function navigate(menu, dir) {
  if (menu.panelOpen) return menu;
  const n = MENU_BUTTONS.length;
  const i = MENU_BUTTONS.indexOf(menu.selected);
  const step = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
  return Object.assign({}, menu, { selected: MENU_BUTTONS[(i + step + n) % n] });
}

// PLAY and RESTART are handled by game.js.
function activate(menu, name) {
  if (name === 'HIGH_SCORES') return Object.assign({}, menu, { panelOpen: true });
  if (name === 'BACK') return Object.assign({}, menu, { panelOpen: false });
  return menu;
}

export { initialMenu, buttonsFor, buttonRect, iconRect, iconsVisible, hitTest, navigate, activate };
