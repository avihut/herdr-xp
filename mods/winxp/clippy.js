// The Office Assistant, as in the Windows 98 layout: a paperclip at the bottom of the desktop.
// When an agent needs you (blocked) or finished while you looked away (done), a yellow Office XP
// balloon offers to take you there. Click the paperclip for a tip. The balloon's "Hide me",
// Display Properties or Start > All Programs > Accessories > Office Assistant hide and show it
// (shared winxp.clippy: "off" hides it). Every so often it blinks, looks around, hops, wiggles,
// stretches, naps or leans in (ACTS). The paperclip is drawn here (img/clippy*.svg), not taken
// from Office.
//
// The desktop draws the paperclip itself (Assistant.element), straight on the wallpaper: Herdr
// frames a floating block with a panel of its own, which an assistant shouldn't have. Its balloon
// is a frameless overlay above it (the clippy role, the default export), kept in step with what
// there is to say by Assistant.sync on each desktop render.
//   shared winxp.clippy            "off" hides it
//   shared winxp.clippy.tip        the tip showing, or null
//   shared winxp.clippy.dismissed  "<agent address>:<status>" balloons answered or put off
//   shared winxp.clippy.closed     { key, at }: a balloon closed itself (a choice in it)

import { image } from "gpui-kit";
import { agents, shared, setShared, props, closeOverlay, openOverlay } from "herdr";
import { div, h_flex, v_flex, pal, pic, uiFont, own, sfx, hasSim, perform, zoom, windowSize, closeOverlays } from "./kit.js";

const TIPS = [
  "It looks like you're herding agents.\n\nDid you know? Ctrl+Esc opens the Start menu.",
  "Drag a tab's button along the taskbar\nto put your tabs in another order.",
  "Drag a folder on the desktop up or down\nto reorder your spaces.",
  "Folders and Changes in Quick Launch open\nthe Explorer bar. Drag its left edge to\nmake it wider.",
  "The globe in Quick Launch opens the\nInternet in a window beside yours.",
  "Drag a window's title bar onto another\nwindow to swap them, or onto its edge\nto put it beside.",
  "Right-click a folder on the desktop to\nrename or close that space.",
  "Waiting on an agent? Minesweeper and\nSolitaire are in the Games folder.\nI won't tell anyone.",
  "Log Off > Switch User shows every\nlayout. I'll miss you.",
];
const SIM_TIP = "Cmd+Shift+S opens the Simulator in\nthe Explorer bar.";

const CLIP_W = 64;
const CLIP_H = 80;
const LEFT = 14; // the paperclip's spot in the desktop strip
const BOTTOM = 8;
const TASKBAR = 30;
const BALLOON_W = 250;
const CHARS = 40; // about what fits on a balloon line
const LINE = 14;

const dismissed = () => shared("winxp.clippy.dismissed") ?? [];

// Its quirks, every so often while it has nothing to say: a blink every 4-12 s, and every 40-90 s
// one of these. A pose is an eye drawing (img/clippy-*.svg); dx, dy, w and h move and stretch it,
// animated natively (transition). Each step holds for its ms and changes only what it names.
const POSE = { rest: "clippy", front: "clippy-front", left: "clippy-left", up: "clippy-up", shut: "clippy-shut" };
const REST = { pose: "rest", dx: 0, dy: 0, w: CLIP_W, h: CLIP_H };
const ACTS = {
  lookAround: [[450, { pose: "left" }], [380, { pose: "up" }], [480, { pose: "front" }], [260, { pose: "rest" }]],
  huh: [[160, { pose: "up", dy: -12 }], [720, { dy: 0 }]],
  bounce: [[150, { dy: -12 }], [150, { dy: 0 }], [130, { dy: -7 }], [130, { dy: 0 }], [110, { dy: -3 }], [110, { dy: 0 }]],
  wiggle: [[90, { dx: 4 }], [90, { dx: -4 }], [90, { dx: 4 }], [90, { dx: -4 }], [90, { dx: 2 }], [90, { dx: 0 }]],
  stretch: [[230, { w: CLIP_W - 4, h: CLIP_H + 12, dx: 2, dy: -12 }], [190, { w: CLIP_W + 6, h: CLIP_H - 8, dx: -3, dy: 8 }], [210, { w: CLIP_W, h: CLIP_H, dx: 0, dy: 0 }]],
  nap: [[300, { pose: "shut" }], [1700, { dy: 4 }], [170, { pose: "up", dy: -10 }], [650, { dy: 0 }]],
  lean: [[260, { pose: "front", w: CLIP_W + 8, h: CLIP_H + 10, dx: -4, dy: -10 }], [950, {}], [260, { w: CLIP_W, h: CLIP_H, dx: 0, dy: 0 }]],
};
const HOP = [[120, { pose: "up", dy: -8 }], [220, { dy: 0 }]];

/** The desktop's half: the paperclip, and the balloon it keeps open or closed. */
export class Assistant {
  constructor() {
    this.balloon = null; // { key, id, at }
    this.frame = { ...REST };
    this.playing = false;
    // A balloon left open by the previous build of the mod (a reload) has no owner now.
    const old = shared("winxp.clippy.balloonId");
    if (old) closeOverlays([old]);
  }

  shown() {
    return shared("winxp.clippy") !== "off";
  }

  /** Starts its quirks (the desktop calls this from init). */
  start(cx) {
    const later = (min, span, fn) => cx.timer.after(min + Math.random() * span, (c) => fn(c ?? cx));
    const blink = (x) => {
      if (this.idle()) this.play([[140, { pose: "shut" }]], x);
      later(4000, 8000, blink);
    };
    const act = (x) => {
      const names = Object.keys(ACTS);
      if (this.idle()) this.play(ACTS[names[Math.floor(Math.random() * names.length)]], x);
      later(40000, 50000, act);
    };
    later(4000, 8000, blink);
    later(20000, 30000, act);
  }

  idle() {
    return this.shown() && !this.playing && !this.balloon;
  }

  /** Plays steps ([ms, change]) in turn, then back to rest. */
  play(steps, cx) {
    this.playing = true;
    let i = 0;
    const next = (c) => {
      const x = c ?? cx;
      if (i >= steps.length) {
        this.frame = { ...REST };
        this.playing = false;
        x.notify();
        return;
      }
      const [ms, change] = steps[i++];
      this.frame = { ...this.frame, ...change };
      x.notify();
      x.timer.after(ms, next);
    };
    next(cx);
  }

  tips() {
    return hasSim() ? [...TIPS, SIM_TIP] : TIPS;
  }

  /** The agent to tell you about: one waiting for you first, else one that finished. */
  news() {
    const done = new Set(dismissed());
    const list = agents()
      .filter((a) => (a.status === "blocked" || a.status === "done") && !a.focused)
      .filter((a) => !done.has(`${a.address}:${a.status}`))
      .sort((a, b) => (a.status === "blocked") - (b.status === "blocked") || a.seq - b.seq);
    return list.pop() ?? null;
  }

  /** What the balloon should say now: { key, text, actions: [[label, act]] }, or null. */
  want() {
    if (!this.shown()) return null;
    const a = this.news();
    if (a) {
      const key = `${a.address}:${a.status}`;
      const name = a.program?.name ?? a.app ?? "Your agent";
      const where = `'${a.space_name} \\ ${a.tab_name}'`;
      const text =
        a.status === "blocked"
          ? `It looks like ${name} in ${where} is waiting for you.\n\nWould you like help?`
          : `It looks like ${name} finished in ${where}.\n\nWant to see what it did?`;
      const put = { shared: ["winxp.clippy.dismissed", [...dismissed(), key]] };
      return { key: `agent:${key}`, text, actions: [["Take me there", { run: ["agent.focus", { terminal: a.address }], ...put }], ["Not now", put]] };
    }
    const tip = shared("winxp.clippy.tip");
    if (tip === null || tip === undefined) return null;
    const tips = this.tips();
    const i = Number(tip) % tips.length;
    return {
      key: `tip:${i}`,
      text: tips[i],
      actions: [
        ["Next tip", { shared: ["winxp.clippy.tip", (i + 1) % tips.length] }],
        ["Close", { shared: ["winxp.clippy.tip", null] }],
        ["Hide me", { shared: ["winxp.clippy", "off"] }],
      ],
    };
  }

  /** Opens, swaps or closes the balloon to match want(). Called from the desktop's render. */
  sync() {
    // Forget answers once their agents have moved on, and a tip once the assistant is hidden.
    const keep = dismissed().filter((k) => {
      const at = k.lastIndexOf(":");
      return agents().some((x) => x.address === k.slice(0, at) && x.status === k.slice(at + 1));
    });
    if (keep.length !== dismissed().length) setShared("winxp.clippy.dismissed", keep);
    if (!this.shown() && shared("winxp.clippy.tip") != null) setShared("winxp.clippy.tip", null);
    const want = this.want();
    const closed = shared("winxp.clippy.closed");
    if (this.balloon && closed?.key === this.balloon.key && closed.at >= this.balloon.at) {
      this.balloon = null; // it closed itself; its choice has changed what want() says
    }
    if ((want?.key ?? null) === (this.balloon?.key ?? null)) return;
    if (this.balloon) closeOverlays([this.balloon.id]);
    this.balloon = null;
    if (!want) return setShared("winxp.clippy.balloonId", null);
    const lines = want.text.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / CHARS)), 0);
    const h = 2 + 18 + lines * LINE + 8 + want.actions.length * 16 + (want.actions.length - 1) * 4 + 12 + 6;
    const z = zoom();
    const win = windowSize();
    const id = openOverlay({
      mod: "winxp",
      kind: "window",
      frame: "none",
      width: BALLOON_W * z,
      height: h * z,
      at: { x: (LEFT - 6) * z, y: Math.max(0, win.height - (TASKBAR + BOTTOM + CLIP_H + h - 4) * z) },
      props: { role: "clippy", key: want.key, text: want.text, actions: want.actions },
    });
    this.balloon = { key: want.key, id, at: Date.now() };
    setShared("winxp.clippy.balloonId", id);
  }

  /** The paperclip, for the desktop to place over its strip's bottom; null while hidden. While an
   *  agent's balloon is up it bobs; otherwise it shows its current quirk's frame. */
  element(talking) {
    if (!this.shown()) return null;
    const f = talking ? REST : this.frame;
    return own(
      div()
        .id("clippy")
        .absolute()
        .left(LEFT)
        .bottom(BOTTOM)
        .w(CLIP_W)
        .h(CLIP_H)
        .cursor_pointer()
        .tooltip("Office Assistant")
        .on_click((_e, cx) => {
          const tip = shared("winxp.clippy.tip");
          setShared("winxp.clippy.tip", tip == null ? Math.floor(Math.random() * this.tips().length) : null);
          sfx("clippy");
          if (!this.playing) this.play(HOP, cx);
          cx.notify();
        })
        // Every pose, drawn unseen at full size, so a quirk never waits for its picture to load.
        .child(div().absolute().top(0).left(0).size_full().opacity(0).children(Object.values(POSE).map((p) => image(`mods/winxp/img/${p}.svg`).absolute().top(0).left(0).size_full())))
        .child(
          div()
            .relative()
            .top(f.dy)
            .left(f.dx)
            .w(f.w)
            .h(f.h)
            .when(talking, (el) => el.loop("top", { from: 0, to: -5, period: 800 }))
            .when(!talking, (el) =>
              el
                .transition("top", { duration: 140, easing: "ease-out" })
                .transition("left", { duration: 90 })
                .transition("width", { duration: 180, easing: "ease-out" })
                .transition("height", { duration: 180, easing: "ease-out" }),
            )
            .child(image(`mods/winxp/img/${POSE[f.pose] ?? POSE.rest}.svg`).size_full()),
        ),
    );
  }
}

/** The balloon (the clippy role): Office XP's pale yellow, rounded, a thin dark edge, blue
 *  bullets for the choices, and a tail down to the paperclip. A choice acts, then closes it. */
export default class ClippyBalloon {
  init() {}

  async close() {
    setShared("winxp.clippy.closed", { key: props()?.key, at: Date.now() });
  }

  render(_cx) {
    const P = pal();
    const p = props() ?? {};
    const link = P.dark ? "#9cc2ff" : "#0b3fa8";
    return v_flex()
      .id("xp-clippy-balloon")
      .size_full()
      .font_family(uiFont())
      .child(
        own(
          v_flex()
            .id("clippy-body")
            .flex_1()
            .p(9)
            .gap(8)
            .rounded(8)
            .border_1()
            .border_color(P.balloonBorder)
            .bg(P.balloon)
            .text_size(11)
            .text_color(P.dark ? P.faceText : "#000000")
            .child(v_flex().children(String(p.text ?? "").split("\n").map((l) => div().line_height(`${LINE}px`).child(l || " "))))
            .child(
              v_flex()
                .gap(4)
                .children(
                  (p.actions ?? []).map(([t, act], i) =>
                    h_flex()
                      .id(`clip-${i}`)
                      .h(16)
                      .gap(6)
                      .items_center()
                      .cursor_pointer()
                      .on_click(() => {
                        perform(act);
                        closeOverlay(p.overlay);
                      })
                      .child(div().flex_none().w(8).h(8).rounded(4).bg("#2f71cd").border_1().border_color("#1c3f94"))
                      .child(div().text_color(link).hover((s) => s.underline()).child(t)),
                  ),
                ),
            ),
        ),
      )
      .child(h_flex().flex_none().h(12).pl(26).child(pic(P.dark ? "balloon-tail-dark" : "balloon-tail", 14).mt(-1)));
  }
}
