// Moving a window by its title bar. Herdr's own pane grip is off in this layout
// ("movable": false on the tab block). A press on a pane's title bar that moves
// a few pixels, or leaves the bar still held, lifts the window: a see-through
// layer over the whole app follows the pointer with the window's outline and
// lights the window under it. Let go over another window of the tab and the two
// trade places; let go anywhere else, right-click or press Esc, and nothing moves.
//
// Where the windows are: no API reports a pane's position, so each title bar
// notes its own box whenever a press lands anywhere (on_mouse_down_out gives an
// element its bounds for a press outside it too). The bar that starts a drag
// hands its tab's boxes to the layer in props.
//
// How they trade places: pane.swap swaps the focused pane with its neighbor in
// a direction, so a far window is reached by swapping along neighbors and back
// (a transposition: everything else ends where it was). A step is only taken
// where one side has exactly one neighbor that way, so pane.swap can't pick
// another pane than planned.

import { panes, props, shared, setShared, openOverlay, closeOverlay, run } from "herdr";
import { div, pal, bands, shadowed, titleFont, windowSize, zoom, sfx } from "./kit.js";

const KEY = "winxp.titlebars";
const BARS = new Map(); // pane -> its title bar's box, window px
const GAP = 10; // the layout's pane gap
const BORDER = 3; // and pane border
const BELOW = 30 + 14; // the taskbar and the tab block's padding under the panes
const DIRS = ["left", "right", "up", "down"];

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
  // Copies of a mod may not share this module, so the boxes are also kept in shared state
  // (only when one moved: every write re-renders every mod).
  const saved = shared(KEY) ?? {};
  if (same(saved[pane], r)) return;
  const live = new Set(panes().map((p) => p.pane));
  const next = {};
  for (const [k, v] of Object.entries(saved)) if (live.has(k)) next[k] = v;
  next[pane] = r;
  setShared(KEY, next);
}

function titleBarsOf(ids) {
  const saved = shared(KEY) ?? {};
  const out = {};
  for (const id of ids) {
    const r = BARS.get(id) ?? saved[id];
    if (r) out[id] = r;
  }
  return out;
}

/** Lifts a pane's window from its title bar; false when there is nowhere to move it. */
export function liftWindow(p, press, title) {
  const ids = panes()
    .filter((x) => x.tab === p.tab)
    .map((x) => x.pane);
  const bars = titleBarsOf(ids);
  if (!bars[p.pane] || Object.keys(bars).length < 2) return false;
  openOverlay({ mod: "winxp", kind: "popup", frame: "none", width: 1, height: 1, at: { x: 0, y: 0 }, props: { role: "panedrag", pane: p.pane, title, bars, press } });
  return true;
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
    for (const y of Object.keys(boxes)) if (!(y in prev) && link(N, x, y)) {
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

// ---- the layer that follows the pointer

export default class PaneDrag {
  init(p) {
    this.p = p;
    this.press = p.press ?? { x: 0, y: 0 };
    this.pt = p.pt ?? this.press; // pt: where the pointer starts (the press, unless a test says)
    this.origin = { x: 0, y: 0 };
    this.done = false;
    this.boxes = windowBoxes(p.bars ?? {}, windowSize().height);
  }

  track(e) {
    if (!e?.position) return;
    this.pt = e.position;
    if (e.local_position) this.origin = { x: e.position.x - e.local_position.x, y: e.position.y - e.local_position.y };
  }

  finish(drop) {
    if (this.done) return;
    this.done = true;
    const target = drop ? windowAt(this.boxes, this.pt) : null;
    if (target && target !== this.p.pane) {
      const cmds = swapCommands(this.boxes, this.p.pane, target);
      if (cmds) for (const [c, a] of cmds) run(c, a);
      else sfx("ding");
    }
    try {
      closeOverlay(props()?.overlay ?? this.p.overlay);
    } catch {}
  }

  close() {
    this.done = true;
  }

  render(cx) {
    const P = pal();
    const z = zoom();
    const o = this.origin;
    const at = (r) => ({ x: (r.x - o.x) / z, y: (r.y - o.y) / z, w: r.w / z, h: r.h / z });
    const src = this.boxes[this.p.pane];
    const target = windowAt(this.boxes, this.pt);
    let layer = div()
      .id("xp-panedrag")
      .size_full()
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
    if (target && target !== this.p.pane) {
      const t = at(this.boxes[target]);
      layer = layer.child(
        div()
          .absolute()
          .left(t.x)
          .top(t.y)
          .w(t.w)
          .h(t.h)
          .rounded(7)
          .border(3)
          .border_color("#316ac5")
          .overflow_hidden()
          .child(div().size_full().bg("#316ac5").opacity(0.18)),
      );
    }
    if (src) {
      const g = at({ x: src.x + this.pt.x - this.press.x, y: src.y + this.pt.y - this.press.y, w: src.w, h: src.h });
      layer = layer.child(
        div()
          .absolute()
          .left(g.x)
          .top(g.y)
          .w(g.w)
          .h(g.h)
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
              .h(30)
              .w_full()
              .overflow_hidden()
              .child(bands(P.title))
              .child(div().relative().size_full().flex().items_center().pl(28).pr(8).font_family(titleFont()).font_weight(700).text_size(13).child(shadowed(this.p.title ?? "", P.titleText, P.titleShadow, { truncate: true }))),
          ),
      );
    }
    return layer;
  }
}
