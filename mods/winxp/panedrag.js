// Moving a window by its title bar. Herdr's own pane grip is off in this layout
// ("movable": false on the tab block). A press on a pane's title bar that moves
// a few pixels, or leaves the bar still held, lifts the window: a see-through
// layer over the whole app follows the pointer with the window's outline and
// previews where it would land. Drop it on another window's title bar or middle
// and the two trade places; on the outer quarter of its left, right, top or
// bottom and it goes beside that window, on that side. Let go anywhere else,
// right-click or press Esc, and nothing moves.
//
// Where the windows are: no API reports a pane's position, so each title bar
// notes its own box whenever a press lands anywhere (on_mouse_down_out gives an
// element its bounds for a press outside it too). The bar that starts a drag
// hands its tab's boxes to the layer.
//
// Trading places: pane.swap swaps the focused pane with its neighbor in a
// direction, so a far window is reached by swapping along neighbors and back
// (a transposition: everything else ends where it was). A step is only taken
// where one side has exactly one neighbor that way, so pane.swap can't pick
// another pane than planned.
//
// Going beside: there is no command for it, so the window's terminal is parked
// (its pane goes; the program keeps running) and kept again right of or below
// the target (terminal.keep), then swapped left or up when that side was asked.
// Both acknowledge first and apply later, so each step waits for the last. The
// taskbar runs it (it outlives the layer, which an Esc could close mid-move).
// A mod pane has no terminal to park: it can only trade places.

import { panes, props, shared, setShared, openOverlay, closeOverlay, run, notify } from "herdr";
import { div, pal, bands, shadowed, titleFont, uiFont, windowSize, zoom, sfx } from "./kit.js";

// ---- this layout's measures and look (the rest is the same in any layout)

const MOD = "winxp";
const GAP = 10; // the layout's pane gap
const BORDER = 3; // pane border
const BELOW = 30 + 14; // the taskbar and the tab block's padding under the panes
const HEADER = 30; // a title bar: dropping on one trades places
const PICK = "#316ac5"; // the preview: XP's selection blue

/** The lifted window: its Luna title bar and frame, see-through. */
function ghost(P, title, w, h) {
  return div()
    .w(w)
    .h(h)
    .opacity(0.75)
    .rounded_tl(7)
    .rounded_tr(7)
    .border(BORDER)
    .border_color(P.frame)
    .overflow_hidden()
    .child(
      div()
        .relative()
        .flex_none()
        .h(HEADER)
        .w_full()
        .overflow_hidden()
        .child(bands(P.title))
        .child(div().relative().size_full().flex().items_center().pl(28).pr(8).font_family(titleFont()).font_weight(700).text_size(13).child(shadowed(title, P.titleText, P.titleShadow, { truncate: true }))),
    );
}

/** Where it would land: a selection-blue box with what happens there. */
function preview(r, label) {
  return div()
    .absolute()
    .left(r.x)
    .top(r.y)
    .w(r.w)
    .h(r.h)
    .rounded(7)
    .border(3)
    .border_color(PICK)
    .overflow_hidden()
    .child(div().absolute().top(0).left(0).size_full().bg(PICK).opacity(0.18))
    .child(div().relative().size_full().flex().items_center().justify_center().child(div().px(10).py(3).rounded(3).bg(PICK).text_color("#ffffff").font_family(uiFont()).text_size(12).font_weight(700).child(label)));
}

// ---- shared state

const BARS_KEY = `${MOD}.titlebars`;
const DRAG = `${MOD}.drag`;
const PLACE = `${MOD}.place`;
const STALE = 20000; // ms: a drag record older than this was abandoned
const SLOP = 4; // px a press moves before it becomes a drag
const EDGE = 0.25; // the outer share of a window's body that puts the window beside it
const DIRS = ["left", "right", "up", "down"];
const LABEL = { swap: "Swap", left: "Put Left", right: "Put Right", up: "Put Above", down: "Put Below" };
const BARS = new Map(); // pane -> its title bar's box, window px (this copy's view)

function boxOf(e) {
  const b = e?.bounds;
  if (!b || !e.position || !b.width) return null;
  // position is window px; position - local_position is the element's origin in window px.
  const lp = e.local_position;
  const x = lp ? e.position.x - lp.x : b.x;
  const y = lp ? e.position.y - lp.y : b.y;
  return { x: Math.round(x), y: Math.round(y), w: Math.round(b.width), h: Math.round(b.height) };
}

const same = (a, b) => a && b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

/** A title bar notes where it is (from any mouse event that carries its bounds). */
export function noteTitleBar(pane, e) {
  const r = boxOf(e);
  if (!pane || !r) return;
  BARS.set(pane, r);
  // Copies of a mod don't share this module, so the boxes live in shared state
  // (written only when one moved: every write re-renders every mod).
  const saved = shared(BARS_KEY) ?? {};
  if (same(saved[pane], r)) return;
  const live = new Set(panes().map((p) => p.pane));
  const next = {};
  for (const [k, v] of Object.entries(saved)) if (live.has(k)) next[k] = v;
  next[pane] = r;
  setShared(BARS_KEY, next);
}

function titleBarsOf(ids) {
  const saved = shared(BARS_KEY) ?? {};
  const out = {};
  for (const id of ids) {
    const r = BARS.get(id) ?? saved[id];
    if (r) out[id] = r;
  }
  return out;
}

function current() {
  const d = shared(DRAG);
  return d && typeof d === "object" && Date.now() - (d.at ?? 0) < STALE ? d : null;
}

// ---- the title bar's side

/**
 * What a title bar adds to its root element to be dragged by:
 *   el = dragHandle(el, this, pane, { movable, title, onPress })
 * `view` keeps the press. Its controls stop their own presses (they aren't drags).
 */
export function dragHandle(el, view, p, o) {
  const id = p?.pane;
  const lift = () => {
    const press = view.dragPress;
    view.dragPress = null;
    if (press && p) liftWindow(p, press, o.title ?? "");
  };
  return el
    .on_mouse_down_out((e) => noteTitleBar(id, e))
    .on_mouse_down("left", (e) => {
      noteTitleBar(id, e);
      o.onPress?.(e);
      view.dragPress = o.movable && (e?.click_count ?? 1) < 2 && e?.position ? { x: e.position.x, y: e.position.y } : null;
    })
    .on_mouse_move((e) => {
      const s = view.dragPress;
      if (s && e?.position && Math.hypot(e.position.x - s.x, e.position.y - s.y) > SLOP) lift();
    })
    .on_mouse_up("left", () => {
      view.dragPress = null;
      // The layer takes the release; if it reached this bar instead, trade places here.
      const d = current();
      if (d) dropOn(d.pane !== id ? id : null);
    })
    // Held and gone off the bar before moving far: it's a drag (the layer catches the release).
    .on_hover((over) => {
      if (!over && view.dragPress) lift();
    });
}

/** Can this pane's window move (Herdr's grip is off, so the layout decides): a split, unzoomed tab. */
export function canMove(p, all = panes()) {
  return Boolean(p) && !p.zoomed && all.filter((x) => x.tab === p.tab).length > 1;
}

function liftWindow(p, press, title) {
  const ids = panes()
    .filter((x) => x.tab === p.tab)
    .map((x) => x.pane);
  const bars = titleBarsOf(ids);
  if (!bars[p.pane] || Object.keys(bars).length < 2) return false;
  // The whole window in px; the layer sizes itself to it too (a popup gives its content no height).
  const win = windowSize();
  const overlay = openOverlay({ mod: MOD, kind: "popup", frame: "none", width: win.width, height: win.height, at: { x: 0, y: 0 }, props: { role: "panedrag", pane: p.pane, title, bars, press } });
  setShared(DRAG, { pane: p.pane, tab: p.tab, bars, overlay, at: Date.now() });
  return true;
}

/** Ends the drag: trades the dragged window with `target`, or puts it on its `edge` side (null: nothing moves). */
function dropOn(target, edge = null) {
  const d = current();
  if (shared(DRAG)) setShared(DRAG, null);
  if (!d) return;
  if (target && target !== d.pane && d.bars?.[target]) {
    if (edge) {
      const term = panes().find((x) => x.pane === d.pane)?.terminal;
      if (term) setShared(PLACE, { terminal: term, target, edge, at: Date.now() });
    } else {
      const cmds = swapCommands(windowBoxes(d.bars, windowSize().height), d.pane, target);
      if (cmds) for (const [c, a] of cmds) run(c, a);
      else sfx("ding");
    }
  }
  try {
    if (d.overlay) closeOverlay(d.overlay);
  } catch {}
}

// ---- geometry

/** Each window's outer box: its title bar widened by the border, down to the next window below or the panes' bottom. */
function windowBoxes(bars, height) {
  const out = {};
  const ids = Object.keys(bars);
  for (const id of ids) {
    const a = bars[id];
    let bottom = height - BELOW;
    for (const k of ids) {
      const b = bars[k];
      if (k === id || b.y <= a.y + 1) continue;
      if (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) <= 4) continue;
      bottom = Math.min(bottom, b.y - BORDER - GAP);
    }
    out[id] = { x: a.x - BORDER, y: a.y - BORDER, w: a.w + 2 * BORDER, h: bottom - (a.y - BORDER) };
  }
  return out;
}

function windowAt(boxes, pt) {
  const m = GAP / 2 + 1;
  for (const [id, b] of Object.entries(boxes)) if (pt.x >= b.x - m && pt.x < b.x + b.w + m && pt.y >= b.y - m && pt.y < b.y + b.h + m) return id;
  return null;
}

/** Which side of window box `b` the point is near, or null for its title bar and middle. */
function edgeOf(b, pt) {
  const top = b.y + BORDER + HEADER;
  if (pt.y < top) return null;
  const near = {
    left: (pt.x - b.x) / b.w,
    right: (b.x + b.w - pt.x) / b.w,
    up: (pt.y - top) / Math.max(1, b.y + b.h - top),
    down: (b.y + b.h - pt.y) / Math.max(1, b.y + b.h - top),
  };
  let best = null;
  for (const dir of DIRS) if (near[dir] < EDGE && (best === null || near[dir] < near[best])) best = dir;
  return best;
}

/** The part of box `b` a window put on its `edge` side would take. */
function half(b, edge) {
  if (edge === "left") return { ...b, w: b.w / 2 };
  if (edge === "right") return { ...b, x: b.x + b.w / 2, w: b.w / 2 };
  if (edge === "up") return { ...b, h: b.h / 2 };
  if (edge === "down") return { ...b, y: b.y + b.h / 2, h: b.h / 2 };
  return b;
}

/** For each window, its one neighbor in a direction (none where there are several). */
function neighbors(boxes) {
  const out = {};
  for (const [id, a] of Object.entries(boxes)) {
    out[id] = {};
    for (const dir of DIRS) {
      const across = dir === "left" || dir === "right";
      const found = [];
      for (const [k, b] of Object.entries(boxes)) {
        if (k === id) continue;
        const overlap = across ? Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) : Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        if (overlap <= 4) continue;
        const d = { right: b.x - (a.x + a.w), left: a.x - (b.x + b.w), down: b.y - (a.y + a.h), up: a.y - (b.y + b.h) }[dir];
        if (d >= -4 && d <= GAP + 12) found.push(k);
      }
      if (found.length === 1) out[id][dir] = found[0];
    }
  }
  return out;
}

/** How to swap the windows in places x and y with one pane.swap, or null. */
function link(N, x, y) {
  for (const dir of DIRS) {
    if (N[x][dir] === y) return { via: x, dir };
    if (N[y][dir] === x) return { via: y, dir };
  }
  return null;
}

/** The commands that trade windows `from` and `to`, or null when no safe way is known. */
export function swapCommands(boxes, from, to) {
  const N = neighbors(boxes);
  const prev = { [from]: null };
  const queue = [from];
  while (queue.length && !(to in prev)) {
    const x = queue.shift();
    for (const y of Object.keys(boxes))
      if (!(y in prev) && link(N, x, y)) {
        prev[y] = x;
        queue.push(y);
      }
  }
  if (!(to in prev)) return null;
  const path = [];
  for (let k = to; k !== null; k = prev[k]) path.unshift(k);
  // Forward along the path, then back without the last step: only from and to change places.
  const steps = [];
  for (let i = 1; i < path.length; i++) steps.push([path[i - 1], path[i]]);
  for (let i = path.length - 2; i >= 1; i--) steps.push([path[i - 1], path[i]]);
  const at = Object.fromEntries(Object.keys(boxes).map((k) => [k, k])); // place -> pane in it now
  const cmds = [];
  for (const [x, y] of steps) {
    const { via, dir } = link(N, x, y);
    cmds.push(["pane.focus", { pane: at[via] }], ["pane.swap", { direction: dir }]);
    [at[x], at[y]] = [at[y], at[x]];
  }
  cmds.push(["pane.focus", { pane: from }]);
  return cmds;
}

// ---- going beside (run by the taskbar)

/** The taskbar calls this as it renders: it starts a new request to put a window beside another. */
export function watchPlacement(view, cx) {
  const req = shared(PLACE);
  const at = Number(req?.at ?? 0);
  if (view.placeAt === undefined) view.placeAt = at; // a request from before this copy started is old
  if (!req || at <= view.placeAt) return;
  view.placeAt = at;
  if (Date.now() - at > 10000) return;
  cx.spawn(async (cx) => placeBeside(cx, req));
}

async function placeBeside(cx, { terminal, target, edge }) {
  const sleep = (ms) => new Promise((r) => cx.timer.after(ms, () => r()));
  const waitFor = async (test, ms = 5000) => {
    for (let t = 0; t < ms; t += 50) {
      const v = test();
      if (v) return v;
      await sleep(50);
    }
    return test();
  };
  const paneOf = () => panes().find((p) => p.terminal === terminal);
  if (!paneOf() || !panes().some((p) => p.pane === target)) return;
  run("terminal.park", { terminal });
  if (!(await waitFor(() => !paneOf()))) return; // it never left: nothing to put back
  const side = edge === "left" || edge === "right" ? "right" : "down";
  let back = null;
  for (let attempt = 0; attempt < 2 && !back; attempt++) {
    if (panes().some((p) => p.pane === target)) run("pane.focus", { pane: target });
    run("terminal.keep", { terminal, place: side });
    back = await waitFor(paneOf);
  }
  if (!back) {
    notify({ title: "Move Window", body: `The program in ${terminal} is still running, but its window didn't come back. To show it: herdr-app do terminal.keep '{"terminal":"${terminal}"}'`, level: "warning" });
    return;
  }
  // Kept right of or below the target; one swap puts it left or above.
  if (edge === "left" || edge === "up") {
    run("pane.focus", { pane: back.pane });
    run("pane.swap", { direction: edge });
  }
  run("pane.focus", { pane: back.pane });
}

// ---- the layer that follows the pointer

export default class PaneDrag {
  init(p) {
    this.p = p;
    this.press = p.press ?? { x: 0, y: 0 };
    this.pt = p.pt ?? this.press; // pt: where the pointer starts (the press, unless a test says)
    this.origin = { x: 0, y: 0 };
    this.done = false;
    this.boxes = windowBoxes(p.bars ?? {}, windowSize().height);
    this.canPlace = Boolean(panes().find((x) => x.pane === p.pane)?.terminal);
  }

  track(e) {
    if (!e?.position) return;
    this.pt = e.position;
    if (e.local_position) this.origin = { x: e.position.x - e.local_position.x, y: e.position.y - e.local_position.y };
  }

  zone() {
    const target = windowAt(this.boxes, this.pt);
    if (!target || target === this.p.pane) return null;
    return { target, edge: this.canPlace ? edgeOf(this.boxes[target], this.pt) : null };
  }

  finish(drop) {
    if (this.done) return;
    this.done = true;
    const z = drop ? this.zone() : null;
    dropOn(z?.target ?? null, z?.edge ?? null);
    try {
      closeOverlay(props()?.overlay ?? this.p.overlay);
    } catch {}
  }

  close() {
    this.done = true;
    if (shared(DRAG)) setShared(DRAG, null);
  }

  render(cx) {
    const P = pal();
    const z = zoom();
    const o = this.origin;
    const at = (r) => ({ x: (r.x - o.x) / z, y: (r.y - o.y) / z, w: r.w / z, h: r.h / z });
    const src = this.boxes[this.p.pane];
    const zone = this.zone();
    const win = windowSize();
    let layer = div()
      .id(`${MOD}-panedrag`)
      .w(win.width / z)
      .h(win.height / z)
      .relative()
      .on_mouse_move((e, cx) => {
        this.track(e);
        cx.notify();
      })
      .on_mouse_up("left", (e) => {
        this.track(e);
        this.finish(true);
      })
      // A release the layer missed (it opened after the button came up): the next press drops.
      .on_mouse_down("left", (e) => {
        this.track(e);
        this.finish(true);
      })
      .on_mouse_down("right", () => this.finish(false));
    if (zone) layer = layer.child(preview(at(half(this.boxes[zone.target], zone.edge)), LABEL[zone.edge ?? "swap"]));
    if (src) {
      const g = at({ x: src.x + this.pt.x - this.press.x, y: src.y + this.pt.y - this.press.y, w: src.w, h: src.h });
      layer = layer.child(div().absolute().left(g.x).top(g.y).child(ghost(P, this.p.title ?? "", g.w, g.h)));
    }
    return layer;
  }
}
