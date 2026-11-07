// Herdr XP's drawing kit: the Luna palettes, gradient bands, the XP window
// frame and push button, menus and dialogs, fonts, icons, sounds, and the
// layout list every switcher shares.
//
// Luna's bars are gradients with several stops. A native gradient has two, so
// each bar is a stack of bands, each band a two-stop gradient (`bands`).

import { div, svg, image, PathBuilder, Background } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, fonts, home, run, openOverlay, closeOverlay, setShared, shared, layouts, settings, playSound } from "herdr";

export const ASSETS = "mods/winxp/img";

// ---- palettes
//
// Band specs: [height px | "flex", from, to], for the bar sizes the layout
// uses (title 30, taskbar 30); a "flex" band takes what is left.
// Turns CSS-style stops ([percent, color], ...) into bands for a bar of height h.
function stops(list, h) {
  const out = [];
  if (list[0][0] > 0) out.push([(list[0][0] / 100) * h, list[0][1], list[0][1]]);
  for (let i = 0; i < list.length - 1; i++) {
    const [a, ca] = list[i];
    const [b, cb] = list[i + 1];
    const px = ((b - a) / 100) * h;
    if (px > 0) out.push([px, ca, cb]);
  }
  const last = list[list.length - 1];
  if (last[0] < 100) out.push([((100 - last[0]) / 100) * h, last[1], last[1]]);
  return out;
}

// Reference values: XP.css (title bar, window frame, buttons) and the winXP
// React clone (taskbar, tray, Start menu), both MIT, both measured from XP.
const TITLE = [[0, "#0997ff"], [8, "#0053ee"], [40, "#0050ee"], [88, "#0066ff"], [93, "#0066ff"], [95, "#005bff"], [96, "#003dd7"], [100, "#003dd7"]];
const TITLE_OFF = [[0, "#a9c1f2"], [8, "#7f9fe6"], [40, "#7b9be4"], [88, "#8aa8ee"], [93, "#8aa8ee"], [95, "#7d9be6"], [96, "#6c87cc"], [100, "#6c87cc"]];
const TASKBAR = [[0, "#1f2f86"], [3, "#3165c4"], [6, "#3682e5"], [10, "#4490e6"], [12, "#3883e5"], [15, "#2b71e0"], [18, "#2663da"], [20, "#235bd6"], [23, "#2258d5"], [38, "#2157d6"], [54, "#245ddb"], [86, "#2562df"], [89, "#245fdc"], [92, "#2158d4"], [95, "#1d4ec0"], [98, "#1941a5"], [100, "#1941a5"]];
const TRAY = [[0, "#0c59b9"], [1, "#0c59b9"], [6, "#139ee9"], [10, "#18b5f2"], [14, "#139beb"], [19, "#1290e8"], [63, "#0d8dea"], [81, "#0d9ff1"], [88, "#0f9eed"], [91, "#119be9"], [94, "#1392e2"], [97, "#137ed7"], [100, "#095bc9"]];
const MENU_HEAD = [[0, "#1868ce"], [12, "#0e60cb"], [20, "#0e60cb"], [32, "#1164cf"], [33, "#1667cf"], [47, "#1b6cd3"], [54, "#1e70d9"], [60, "#2476dc"], [65, "#297ae0"], [77, "#3482e3"], [79, "#3786e5"], [90, "#428ee9"], [100, "#4791eb"]];
const MENU_FOOT = [[0, "#4282d6"], [3, "#3b85e0"], [5, "#418ae3"], [17, "#418ae3"], [21, "#3c87e2"], [26, "#3786e4"], [29, "#3482e3"], [39, "#2e7ee1"], [49, "#2374df"], [57, "#2072db"], [62, "#196edb"], [72, "#176bd8"], [75, "#1468d5"], [83, "#1165d2"], [88, "#0f61cb"], [100, "#0f61cb"]];
const START = [[0, "#5eac56"], [6, "#3c9a37"], [12, "#47ab42"], [40, "#3d9b38"], [85, "#2f8a2c"], [100, "#24711f"]];
const START_HOVER = [[0, "#79c871"], [6, "#53b14d"], [12, "#5cbe56"], [40, "#4fae49"], [85, "#3e9c39"], [100, "#2c8126"]];
const START_DOWN = [[0, "#1e5a1a"], [10, "#2a7a25"], [50, "#2f852a"], [100, "#2a7a25"]];

const LUNA = {
  dark: false,
  title: stops(TITLE, 30),
  titleOff: stops(TITLE_OFF, 30),
  titleText: "#ffffff",
  titleTextOff: "#e4ebf7",
  titleShadow: "#0f1089",
  frame: "#0831d9",
  frameIn: "#166aee",
  frameOff: "#7a96df",
  cap: ["#78abf5", "#1554c5"],
  capHover: ["#9cc4ff", "#2d6fe0"],
  capClose: ["#f3a68b", "#c4351a"],
  capCloseHover: ["#ffbca3", "#e04a28"],
  capBorder: "#ffffff",
  taskbar: stops(TASKBAR, 30),
  tray: stops(TRAY, 30),
  trayEdge: ["#1042af", "#18bbff"],
  start: stops(START, 30),
  startHover: stops(START_HOVER, 30),
  startDown: stops(START_DOWN, 30),
  task: "#3c81f3",
  taskHover: "#53a3ff",
  taskOn: "#1e52b7",
  taskOnHover: "#3576f3",
  taskText: "#ffffff",
  menuHead: stops(MENU_HEAD, 54),
  menuFoot: stops(MENU_FOOT, 36),
  menuLine: "#da884a",
  menuLeft: "#ffffff",
  menuRight: "#cbe3ff",
  menuRightBorder: "#3a3aff5e",
  menuRightText: "#00136b",
  menuBg: "#4282d6",
  menuTopLine: "#385de7",
  menuText: "#000000",
  menuSub: "#00000066",
  menuSep: "#0000001a",
  menuSepRight: "#87b3e2",
  menuHover: "#2f71cd",
  menuHoverText: "#ffffff",
  menuBorder: "#0b55c4",
  popup: "#ffffff",
  popupBorder: "#aca899",
  popupText: "#000000",
  popupDisabled: "#aca899",
  face: "#ece9d8",
  faceText: "#000000",
  faceDim: "#808080",
  field: "#ffffff",
  fieldBorder: "#7f9db9",
  button: [[0, "#ffffff"], [26, "#fafaf9"], [95, "#f0f0ea"], [100, "#ecebe5"]],
  buttonBorder: "#003c74",
  buttonHover: ["#fdd889", "#e5a01a"],
  buttonDefault: ["#98b8ea", "#89ade4"],
  pane: [[1, "#ffffff", "#ffffff"], ["flex", "#7ba2e7", "#6375d6"]],
  paneBox: "#d6dff7",
  paneBoxHead: ["#ffffff", "#c6d3f7"],
  paneBoxText: "#215dc6",
  paneLink: "#0c32a1",
  list: "#ffffff",
  listHead: "#3a6ea5",
  deskText: "#ffffff",
  deskShadow: "#000000",
  deskSelect: "#0b61ff",
  balloon: "#ffffe1",
  balloonBorder: "#000000",
};

// Dark: Luna's blue chrome stays (title bars, taskbar, start button); the
// content goes dark (menus, dialog faces, lists, Explorer panes).
const DARK = {
  ...LUNA,
  dark: true,
  titleOff: [[1, "#6d7fa6", "#6d7fa6"], [3, "#5e6f96", "#4b5b80"], [9, "#4b5b80", "#435276"], [10, "#435276", "#3f4d70"], ["flex", "#3f4d70", "#3a476a"]],
  titleTextOff: "#c3cbe0",
  frameOff: "#3f4d70",
  menuLeft: "#202227",
  menuRight: "#1b2a45",
  menuRightBorder: "#2f4a7a",
  menuRightText: "#dce8ff",
  menuText: "#ececec",
  menuSub: "#ffffff80",
  menuSep: "#ffffff1a",
  menuSepRight: "#3d5f99",
  popup: "#25272c",
  popupBorder: "#55585f",
  popupText: "#ececec",
  popupDisabled: "#6c7079",
  face: "#2d2f34",
  faceText: "#ececec",
  faceDim: "#9a9fa8",
  field: "#17181b",
  fieldBorder: "#56698f",
  button: [[0, "#55585f"], [26, "#4a4d55"], [95, "#3a3d44"], [100, "#33363c"]],
  buttonBorder: "#8a93a6",
  buttonHover: ["#d9a640", "#b07a10"],
  buttonDefault: ["#5a7ab8", "#4a6aa8"],
  pane: [[1, "#4d6aa8", "#4d6aa8"], ["flex", "#2a3b66", "#1d2a4d"]],
  paneBox: "#24314f",
  paneBoxHead: ["#3a4d7a", "#2c3c63"],
  paneBoxText: "#cfe0ff",
  paneLink: "#9cc0ff",
  list: "#1c1d21",
  listHead: "#9cc0ff",
  balloon: "#2f2f22",
  balloonBorder: "#8a8a6a",
};

function luminance(hex) {
  const m = /^#?([0-9a-f]{6})/i.exec(String(hex ?? ""));
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Dark when the shown theme's panels are dark (the terminals are black in both). */
export function isDark() {
  return luminance(theme()?.surface) < 0.25;
}

export function pal() {
  return isDark() ? DARK : LUNA;
}

// ---- fonts: XP's own when the machine has them, else close ones

let fontCache = null;
function pick(wanted) {
  if (!fontCache) {
    try {
      fontCache = new Set(fonts());
    } catch {
      fontCache = new Set();
    }
  }
  return wanted.find((f) => fontCache.has(f)) ?? wanted[wanted.length - 1];
}
export const uiFont = () => pick(["Tahoma", "Verdana", "DejaVu Sans", "Geist"]);
export const titleFont = () => pick(["Trebuchet MS", "Tahoma", "Verdana", "DejaVu Sans", "Geist"]);

// ---- gradients

const RECT = () => PathBuilder.fill().move_to("0%", "0%").line_to("100%", "0%").line_to("100%", "100%").line_to("0%", "100%").close().build();

/** A layer that fills its (relative) parent with a two-stop gradient; 180 runs top to bottom. */
export function grad(from, to, angle = 180) {
  return window.paint_path(RECT(), Background.linear_gradient(angle, from, to)).absolute().top(0).left(0).size_full();
}

/** A layer that fills its (relative) parent with a stack of gradient bands. */
export function bands(spec) {
  let col = v_flex().absolute().top(0).left(0).size_full();
  for (const [h, from, to] of spec) {
    let band = div().relative().w_full().flex_none();
    band = h === "flex" ? band.flex_1() : band.h(h);
    col = col.child(band.child(grad(from, to)));
  }
  return col;
}

// ---- pictures

/** An image from img/ (full color). */
export function pic(name, size) {
  return image(`${ASSETS}/${name}.svg`).w(size).h(size).flex_none();
}

/** A one-color glyph from img/, tinted. */
export function glyph(name, size, color) {
  let el = svg(`${ASSETS}/${name}.svg`).w(size).h(size).flex_none();
  if (color) el = el.text_color(color);
  return el;
}

/** A program's icon from Herdr's program table (`p.program`), or the console's.
 *  One-color glyphs are drawn bare in the program's color, as XP drew icons: no tile behind. */
export function programIcon(program, size, color) {
  if (!program?.icon || program.shell) return pic("cmd", size);
  if (program.tint) {
    const ink = color ?? (isDark() ? program.color ?? "#e8e8e8" : program.tile ?? "#202020");
    return svg(program.icon).w(size).h(size).flex_none().text_color(ink);
  }
  return image(program.icon).w(size).h(size).flex_none();
}

/** A 1px line that fades out at both ends (XP's menu separators). */
export function fadeLine(color) {
  return h_flex().flex_none().h(1).w_full().child(div().relative().flex_1().h_full().child(grad("#00000000", color, 90))).child(div().relative().flex_1().h_full().child(grad(color, "#00000000", 90)));
}

/** An icon by spec: "name" (img/), or { program } (Herdr's table). */
export function iconOf(spec, size) {
  if (!spec) return div().w(size).h(size).flex_none();
  if (typeof spec === "string") return pic(spec, size);
  if (spec.program) return programIcon(spec.program, size);
  return div().w(size).h(size).flex_none();
}

/** Text with XP's soft drop shadow (a dark copy one pixel down and right). */
export function shadowed(text, color, shadow, o = {}) {
  const make = (c) => {
    let t = div().child(String(text ?? "")).text_color(c).whitespace_nowrap();
    if (o.truncate) t = t.truncate();
    return t;
  };
  let wrap = div().relative().min_w(0).flex_none();
  if (o.truncate) wrap = wrap.flex_1().overflow_hidden();
  return wrap.child(make(shadow).absolute().top(1).left(1).opacity(0.6)).child(make(color).relative());
}

/** A press on a control inside a draggable bar or window belongs to the control. */
export function own(el) {
  return el.on_mouse_down("left", (_e, cx) => cx.stop_propagation());
}

// ---- words

export function tildePath(path) {
  const h = home() ?? "";
  if (!path) return "";
  return h && path.startsWith(h) ? `~${path.slice(h.length)}` : path;
}

export function userName() {
  const n = (home() ?? "").split(/[\\/]/).filter(Boolean).pop() ?? "User";
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** A pane's window title: "Claude Code - fix login"; a shell is XP's console. */
export function paneTitle(p) {
  if (!p) return "";
  if (p.mod) return p.title || p.mod;
  const prog = p.program;
  if (!prog || prog.shell) return `Command Prompt${p.cwd ? ` - ${tildePath(p.cwd)}` : ""}`;
  const t = (p.title ?? "").trim();
  return t && t !== prog.name ? `${prog.name} - ${t}` : prog.name;
}

export function statusColor(status) {
  const t = theme() ?? {};
  return t[status] ?? t.unknown ?? "#808080";
}

// ---- layouts (the native switcher: Start ▸ Layouts, the Welcome screen)
// The house rules: hide a built-in whose personal copy exists, name each by
// its title, mark the shown one, switch on click.

const REPLACED = { main: "my-herdr", terminals: "my-terminals", win98: "win98-dark" };
const TITLES = { main: "Herdr", terminals: "Terminals", win98: "Windows 98", winxp: "Windows XP" };

export function layoutTitle(name) {
  for (const [builtin, copy] of Object.entries(REPLACED)) if (copy === name && TITLES[builtin]) return TITLES[builtin];
  if (TITLES[name]) return TITLES[name];
  const bare = String(name).replace(/^my-/, "").replace(/[-_]+/g, " ");
  return bare.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** [{ name, title, current }] in the person's order. */
export function layoutList() {
  const all = layouts();
  const shown = shared("layout");
  return all
    .filter((n) => !(REPLACED[n] && all.includes(REPLACED[n])))
    .map((name) => ({ name, title: layoutTitle(name), current: name === shown }));
}

export function layoutItems() {
  return layoutList().map((l) => ({ label: l.title, radio: l.current, act: { run: ["layout.switch", { name: l.name }] } }));
}

// ---- sounds (original chimes in sounds/; quiet when the person turned sounds off)

export function sfx(name) {
  try {
    if (settings()?.sounds?.enabled === false) return;
    playSound(`mods/winxp/sounds/${name}.mp3`);
  } catch {}
}

// ---- overlays

export function zoom() {
  return Number(settings()?.zoom) || 1;
}

/** Does what a menu row or button names: { run: [cmd, args] } | { runs: [[cmd, args], ...] } | { open: role } | { dialog: kind } | { shared: [k, v] } | { boot } */
export function perform(act) {
  if (!act) return;
  if (act.run) run(act.run[0], act.run[1] ?? {});
  if (act.runs) for (const [c, a] of act.runs) run(c, a ?? {});
  if (act.open) openWindow(act.open, act.props ?? {});
  if (act.dialog) openDialog(act.dialog, act.props ?? {});
  if (act.shared) setShared(act.shared[0], act.shared[1]);
}

const WINDOWS = {
  mines: [190, 294],
  sol: [640, 500],
  spider: [820, 560],
  freecell: [660, 500],
  mycomputer: [660, 460],
  bin: [600, 420],
  games: [600, 400],
  taskman: [420, 440],
};

/** A floating XP window (games, Explorer, Task Manager): it remembers where it was dropped. */
export function openWindow(role, props = {}) {
  const [w, h] = WINDOWS[role] ?? [480, 360];
  return openOverlay({ mod: "winxp", kind: "window", frame: "none", key: `winxp-${role}`, width: w * zoom(), height: h * zoom(), props: { role, ...props } });
}

const DIALOGS = {
  message: [330, 170],
  run: [360, 188],
  logoff: [300, 182],
  turnoff: [312, 200],
  confirm: [380, 150],
  display: [404, 450],
  about: [420, 320],
  cleanup: [460, 330],
};

export function openDialog(kind, props = {}) {
  if (kind === "welcome" || kind === "boot") {
    return openOverlay({ mod: "winxp", kind: "dialog", frame: "none", modal: true, width: 1, height: 1, props: { role: kind, ...props } });
  }
  const [w, h] = DIALOGS[kind] ?? [360, 180];
  return openOverlay({ mod: "winxp", kind: "dialog", frame: "none", modal: true, width: w * zoom(), height: h * zoom(), props: { role: "dialog", kind, ...props } });
}

// ---- menus

export const ROW = 22;
export const SEP = 9;

export function menuSize(items) {
  let h = 6;
  let w = 140;
  for (const it of items) {
    h += it.sep ? SEP : ROW;
    if (!it.sep) w = Math.max(w, 64 + String(it.label ?? "").length * 6.4 + (it.shortcut ? 60 : 0));
  }
  return { w: Math.ceil(w), h };
}

/** The window's size in logical px (for keeping popups on screen). */
export function windowSize() {
  try {
    const b = window.bounds();
    if (b?.width && b?.height) return { width: b.width, height: b.height };
  } catch {}
  return { width: 1600, height: 1000 };
}

/** Opens a popup menu: items [{ label, icon, act, sub, bold, disabled, radio, checked, sep, shortcut }].
 *  at: window px ({ x, y }, or { above: bounds }, or { beside: bounds } for a submenu: right of it, its
 *  top level with the row, moved up or to the left to stay on screen). */
export function openMenu(items, at, o = {}) {
  const { w, h } = menuSize(items);
  const z = zoom();
  const W = (o.width ?? w) * z;
  const H = h * z;
  const win = windowSize();
  let where = at;
  if (at?.above) where = { x: at.above.x, y: at.above.y - H };
  if (at?.beside) {
    const b = at.beside;
    where = { x: b.x + b.width - 3, y: o.bottom ? b.y + b.height - H + 3 : b.y - 3 };
    if (where.x + W > win.width) where.x = b.x - W + 3;
  }
  if (where) where = { x: Math.max(0, Math.min(where.x, win.width - W)), y: Math.max(0, Math.min(where.y, win.height - H)) };
  return openOverlay({
    mod: "winxp",
    kind: "popup",
    frame: "none",
    width: W,
    height: H,
    ...(where ? { at: where } : {}),
    props: { role: "menu", items, parents: o.parents ?? [] },
  });
}

export function closeOverlays(ids) {
  for (const id of ids) {
    try {
      closeOverlay(id);
    } catch {}
  }
}

// ---- XP controls

/** XP's push button: a white-to-cream bubble, dark blue edge, an orange glow on hover, a blue one when default. */
export function button(P, id, label, onClick, o = {}) {
  const h = o.h ?? 23;
  const glow = ([inner, outer]) => div().absolute().top(0).left(0).size_full().rounded(2).border_1().border_color(outer).child(div().size_full().rounded(2).border_1().border_color(inner));
  return own(
    div()
      .id(id)
      .relative()
      .flex_none()
      .min_w(o.w ?? 75)
      .h(h)
      .rounded(3)
      .border_1()
      .border_color(P.buttonBorder)
      .overflow_hidden()
      .opacity(o.disabled ? 0.5 : 1)
      .child(bands(stops(P.button, h - 2)))
      .when(Boolean(o.isDefault), (el) => el.child(glow(P.buttonDefault)))
      .when(!o.disabled, (el) => el.child(div().id(`${id}~glow`).absolute().top(0).left(0).size_full().opacity(0).hover((s) => s.opacity(1)).child(glow(P.buttonHover))))
      .child(div().relative().size_full().flex().items_center().justify_center().px(10).text_size(11).text_color(P.dark ? P.faceText : "#000000").child(label))
      .when(!o.disabled && Boolean(onClick), (el) => el.on_click((e, cx) => onClick(e, cx))),
  );
}

/** A caption button (minimize, maximize, close, help) for a window's title bar. */
export function capButton(P, id, name, onClick, o = {}) {
  const close = name === "ctl-close";
  const [from, to] = close ? P.capClose : P.cap;
  const [hf, ht] = close ? P.capCloseHover : P.capHover;
  return div()
    .id(id)
    .relative()
    .flex_none()
    .w(21)
    .h(21)
    .rounded(3)
    .border_1()
    .border_color(P.capBorder)
    .overflow_hidden()
    .opacity(o.dim ? 0.75 : 1)
    .child(grad(from, to, 135))
    .child(div().id(`${id}~hover`).absolute().top(0).left(0).size_full().opacity(0).hover((s) => s.opacity(1)).child(grad(hf, ht, 135)))
    .child(div().relative().size_full().flex().items_center().justify_center().child(glyph(name, 19, "#ffffff")))
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .on_click(() => onClick());
}

/** A Luna title bar: icon, bold title, caption buttons. */
export function titleBar(P, o) {
  const active = o.active !== false;
  const caps = (o.caps ?? []).map(([name, fn], i) => capButton(P, `${o.id}-cap${i}`, name, fn, { dim: !active }));
  let bar = div()
    .id(`${o.id}-title`)
    .relative()
    .flex_none()
    .h(o.h ?? 30)
    .w_full()
    .overflow_hidden()
    .when(Boolean(o.round), (el) => el.rounded_tl(8).rounded_tr(8))
    .child(bands(active ? P.title : P.titleOff))
    .child(
      h_flex()
        .relative()
        .size_full()
        .items_center()
        .gap(5)
        .pl(6)
        .pr(4)
        .child(o.icon ?? div())
        .child(div().flex_1().min_w(0).font_family(titleFont()).font_weight(700).text_size(13).child(shadowed(o.title, active ? P.titleText : P.titleTextOff, P.titleShadow, { truncate: true })))
        .when(Boolean(o.extra), (el) => el.child(o.extra))
        .child(h_flex().flex_none().gap(2).children(caps)),
    );
  if (o.onClick || o.onDouble) {
    bar = bar.on_click((e) => {
      if (e?.click_count >= 2) o.onDouble?.();
      else o.onClick?.();
    });
  }
  if (o.onRight) bar = bar.on_mouse_down("right", (e, cx) => { cx.stop_propagation(); o.onRight(e); });
  return bar;
}

/** A whole XP window for an overlay: rounded Luna title bar, blue frame, a body on the face color. */
export function frame(P, o) {
  return v_flex()
    .id(o.id)
    .size_full()
    .font_family(uiFont())
    .text_size(11)
    .text_color(P.faceText)
    .rounded_tl(8)
    .rounded_tr(8)
    .overflow_hidden()
    .bg(P.frame)
    .child(titleBar(P, { ...o, round: true }))
    .child(
      div()
        .flex_1()
        .min_h(0)
        .mx(3)
        .mb(3)
        .bg(o.bodyBg ?? P.face)
        .flex()
        .flex_col()
        .child(o.body),
    );
}

/** A menu bar (Game, Help) whose labels open menus below them. */
export function menuBar(P, id, menus) {
  return h_flex()
    .flex_none()
    .h(20)
    .px(2)
    .bg(P.face)
    .border_b_1()
    .border_color(P.dark ? "#3a3d45" : "#d8d2bd")
    .children(
      menus.map(([label, items], i) =>
        own(
          div()
            .id(`${id}-mb${i}`)
            .px(7)
            .h_full()
            .flex()
            .items_center()
            .text_size(11)
            .hover((s) => s.bg(P.menuHover).text_color(P.menuHoverText))
            .child(label)
            .on_mouse_down("left", (e, cx) => {
              cx.stop_propagation();
              const b = e?.bounds;
              openMenu(typeof items === "function" ? items() : items, b ? { x: b.x, y: b.y + b.height } : undefined);
            }),
        ),
      ),
    );
}

export { div, h_flex, v_flex };
