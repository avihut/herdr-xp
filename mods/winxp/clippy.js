// The Office Assistant, as in the Windows 98 layout: a paperclip at the bottom of the desktop.
// When an agent needs you (blocked) or finished while you looked away (done), a yellow Office XP
// balloon offers to take you there. Click the paperclip for a tip. The balloon's "Hide me",
// Display Properties or Start > All Programs > Accessories > Office Assistant hide and show it
// (shared winxp.clippy: "off" hides it). An agent's balloon closes itself after a few seconds;
// a light bulb then shows it has something to say, and a click brings it back. Now and then it blinks, looks around, hops, wiggles or
// naps (SCRIPT, played natively); "Hold still" stops that. The paperclip is drawn here
// (img/clippy*.svg), not taken from Office.
//
// The desktop draws the paperclip itself (Assistant.element), straight on the wallpaper: Herdr
// frames a floating block with a panel of its own, which an assistant shouldn't have. Its balloon
// is a frameless overlay above it (the clippy role, the default export), kept in step with what
// there is to say by Assistant.sync on each desktop render.
//   shared winxp.clippy            "off" hides it
//   shared winxp.clippy.tip        the tip showing, or null
//   shared winxp.clippy.dismissed  "<agent address>:<status>" balloons answered or put off
//   shared winxp.clippy.closed     { key, at }: a balloon closed itself (a choice in it)
//   shared winxp.clippy.quiet      agent balloons that closed themselves unread: the light bulb
//   shared winxp.clippy.recall     what a click on the paperclip brought back: one message's key,
//                                  or "list" for the sheet of them all

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
const quieted = () => shared("winxp.clippy.quiet") ?? [];
const keyOf = (a) => `${a.address}:${a.status}`;
const AUTO_CLOSE = 5000; // an agent's balloon closes itself after this, unless pointed at
const SHEET_ROW = 34;
const SHEET_ROWS = 5; // rows the sheet shows before it scrolls
const SHEET_W = 270;
const where = (a) => `${a.space_name} \\ ${a.tab_name}`;
const nameOf = (a) => a.program?.name ?? a.app ?? "Your agent";

// Its quirks, played natively: no JavaScript timer redraws anything. A five-minute script (built
// once, from a fixed seed) says, for each 120 ms tick, which eye drawing shows (img/clippy-*.svg
// over the resting one), how far it's lifted and how far it's shifted. GPUI's .frames() plays it:
// each pose's layer is clipped to the width of an invisible text that is either empty (hidden) or
// long (shown), and the lift and shift are invisible texts of so many lines or dots under and
// beside it. Every copy shares one clock, so they stay in step. "Hold still" (winxp.clippy.still,
// in its balloon or Display Properties) leaves the resting drawing alone.
const TICK = 120;
const CYCLE = 2500; // ticks: five minutes, then it starts over
const LAYERS = ["shut", "left", "up", "front"];
const CLEAR = "#00000000";
const LIFT_PX = 3; // per line of the lift text
const REST_LIFT = 1;
const REST_SHIFT = 2;

function seeded(n) {
  return () => ((n = (n * 1103515245 + 12345) % 2147483648) / 2147483648);
}

const SCRIPT = (() => {
  const pose = Array(CYCLE).fill("");
  const lift = Array(CYCLE).fill(REST_LIFT);
  const shift = Array(CYCLE).fill(REST_SHIFT);
  const rnd = seeded(20011025);
  const put = (t, list, key) => list.forEach((v, k) => t + k < CYCLE && v !== undefined && (key === "pose" ? (pose[t + k] = v) : key === "lift" ? (lift[t + k] = v) : (shift[t + k] = v)));
  const ACTS = {
    lookAround: { pose: Array(4).fill("left").concat(["up", "up", "up", "front", "front", "front", "front"]) },
    huh: { pose: Array(8).fill("up"), lift: [5, 5, 4, 3, 2, 2, 1] },
    bounce: { lift: [5, 3, 1, 4, 2, 1, 3, 1] },
    wiggle: { shift: [4, 0, 4, 0, 4, 1, 3, 2] },
    nap: { pose: Array(18).fill("shut").concat(["up", "up", "up", "up", "up"]), lift: Array(16).fill(0).concat([0, 0, 5, 4, 3, 2, 1]) },
  };
  const order = ["lookAround", "bounce", "huh", "wiggle", "nap", "lookAround", "huh", "bounce"];
  let a = 0;
  for (let t = Math.round(20000 / TICK); t < CYCLE - 40; t += Math.round((40000 + rnd() * 40000) / TICK)) {
    const act = ACTS[order[a++ % order.length]];
    for (const key of ["pose", "lift", "shift"]) if (act[key]) put(t, act[key], key);
  }
  for (let t = 30; t < CYCLE; t += Math.round((4000 + rnd() * 7000) / TICK)) if (!pose[t] && !pose[t + 1]) pose[t] = "shut";
  const text = (n, ch) => Array(n).fill(ch).join(ch === "." ? "" : "\n");
  return {
    layers: Object.fromEntries(LAYERS.map((l) => [l, pose.map((p) => (p === l ? "MMMMMMMMMMMMMMMM" : ""))])),
    lift: lift.map((n) => text(n, "|")),
    shift: shift.map((n) => text(n, ".")),
  };
})();

/** The desktop's half: the paperclip, and the balloon it keeps open or closed. */
export class Assistant {
  constructor() {
    this.balloon = null; // { key, id, at }
    // A balloon left open by the previous build of the mod (a reload) has no owner now.
    const old = shared("winxp.clippy.balloonId");
    if (old) closeOverlays([old]);
  }

  shown() {
    return shared("winxp.clippy") !== "off";
  }

  still() {
    return shared("winxp.clippy.still") === true;
  }

  tips() {
    return hasSim() ? [...TIPS, SIM_TIP] : TIPS;
  }

  /** The agents to tell you about, put-off ones left out, the most pressing last: blocked before
   *  done, then newest. */
  items() {
    const done = new Set(dismissed());
    return agents()
      .filter((a) => (a.status === "blocked" || a.status === "done") && !a.focused)
      .filter((a) => !done.has(keyOf(a)))
      .sort((a, b) => (a.status === "blocked") - (b.status === "blocked") || a.seq - b.seq);
  }

  /** Balloons that closed themselves before you answered: the light bulb's messages. */
  pending() {
    const quiet = new Set(quieted());
    return this.items().filter((a) => quiet.has(keyOf(a)));
  }

  /** What the balloon should say now: { key, text, actions: [[label, act]] }, or null. */
  want() {
    if (!this.shown()) return null;
    const list = this.items();
    const quiet = new Set(quieted());
    const recall = shared("winxp.clippy.recall");
    if (recall === "list") {
      const waiting = this.pending().reverse(); // the most pressing first
      if (waiting.length > 1) {
        const keys = waiting.map(keyOf);
        const answer = (k) => [["winxp.clippy.dismissed", [...dismissed(), ...k]], ["winxp.clippy.recall", null]];
        return {
          key: `list:${keys.join(",")}`,
          text: `You have ${waiting.length} messages from your agents.`,
          sheet: waiting.map((a) => ({
            name: nameOf(a),
            where: where(a),
            status: a.status,
            act: { run: ["agent.focus", { terminal: a.address }], shareds: answer([keyOf(a)]) },
          })),
          actions: [["Dismiss all", { shareds: answer(keys) }], ["Close", { shared: ["winxp.clippy.recall", null] }]],
        };
      }
    }
    const called = recall && recall !== "list" ? list.find((x) => keyOf(x) === recall) : null;
    const a = called ?? list.filter((x) => !quiet.has(keyOf(x))).pop();
    if (a) {
      const key = keyOf(a);
      const name = a.program?.name ?? a.app ?? "Your agent";
      const where = `'${a.space_name} \\ ${a.tab_name}'`;
      const text =
        a.status === "blocked"
          ? `It looks like ${name} in ${where} is waiting for you.\n\nWould you like help?`
          : `It looks like ${name} finished in ${where}.\n\nWant to see what it did?`;
      const put = { shared: ["winxp.clippy.dismissed", [...dismissed(), key]] };
      // A new one closes itself after a few seconds (the light bulb keeps it); one brought back
      // with a click stays until answered.
      return { key: `agent:${key}:${called ? "again" : "new"}`, agent: key, auto: !called, text, actions: [["Take me there", { run: ["agent.focus", { terminal: a.address }], ...put }], ["Not now", put]] };
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
        this.still() ? ["Move around again", { shared: ["winxp.clippy.still", false] }] : ["Hold still", { shared: ["winxp.clippy.still", true] }],
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
    const live = new Set(this.items().map(keyOf));
    const stillQuiet = quieted().filter((k) => live.has(k));
    if (stillQuiet.length !== quieted().length) setShared("winxp.clippy.quiet", stillQuiet);
    const recall = shared("winxp.clippy.recall");
    if (recall === "list" ? this.pending().length < 2 : recall && !live.has(recall)) setShared("winxp.clippy.recall", null);
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
    const sheet = want.sheet ? Math.min(want.sheet.length, SHEET_ROWS) * SHEET_ROW + 2 + 8 : 0;
    const h = 2 + 18 + lines * LINE + 8 + sheet + want.actions.length * 16 + (want.actions.length - 1) * 4 + 12 + 6;
    const z = zoom();
    const win = windowSize();
    const id = openOverlay({
      mod: "winxp",
      kind: "window",
      frame: "none",
      width: (want.sheet ? SHEET_W : BALLOON_W) * z,
      height: h * z,
      at: { x: (LEFT - 6) * z, y: Math.max(0, win.height - (TASKBAR + BOTTOM + CLIP_H + h - 4) * z) },
      props: { role: "clippy", key: want.key, agent: want.agent ?? null, auto: Boolean(want.auto), text: want.text, sheet: want.sheet ?? null, actions: want.actions },
    });
    this.balloon = { key: want.key, id, at: Date.now() };
    setShared("winxp.clippy.balloonId", id);
  }

  /** The paperclip, for the desktop to place over its strip's bottom; null while hidden. While an
   *  agent's balloon is up it bobs (a native loop); otherwise it plays its script, unless held
   *  still. Nothing here asks for a render. */
  element(talking) {
    if (!this.shown()) return null;
    const lively = !talking && !this.still();
    const waiting = this.pending().length;
    const img = (name) => image(`mods/winxp/img/${name}.svg`).absolute().top(0).left(0).w(CLIP_W).h(CLIP_H);
    // A pose's layer shows as wide as its invisible text: none, or all of the paperclip.
    const layer = (name) =>
      div()
        .absolute()
        .top(0)
        .left(0)
        .h(CLIP_H)
        .max_w(CLIP_W)
        .overflow_hidden()
        .child(div().text_size(10).text_color(CLEAR).frames(SCRIPT.layers[name], TICK))
        .child(img(`clippy-${name}`));
    const figure = div()
      .relative()
      .flex_none()
      .w(CLIP_W)
      .h(CLIP_H)
      .when(talking, (el) => el.loop("top", { from: 0, to: -5, period: 800 }))
      .child(img("clippy"))
      .when(lively, (el) => el.children(LAYERS.map(layer)))
      // Office's light bulb: it has something to say (balloons that closed unread).
      .when(waiting > 0, (el) => el.child(image("mods/winxp/img/clippy-bulb.svg").absolute().top(-8).right(-6).w(22).h(22)))
      .when(waiting > 1, (el) =>
        el.child(
          div()
            .absolute()
            .top(-10)
            .right(-12)
            .min_w(14)
            .h(14)
            .px(3)
            .rounded(7)
            .bg("#d8261a")
            .border_1()
            .border_color("#ffffff")
            .flex()
            .items_center()
            .justify_center()
            .text_size(9)
            .font_weight(700)
            .text_color("#ffffff")
            .child(String(waiting)),
        ),
      );
    return own(
      v_flex()
        .id("clippy")
        .absolute()
        .left(LEFT - REST_SHIFT * 2)
        .bottom(BOTTOM - REST_LIFT * LIFT_PX)
        .items_start()
        .cursor_pointer()
        .tooltip(waiting ? `Office Assistant: ${waiting} message${waiting === 1 ? "" : "s"} (click to see)` : "Office Assistant")
        .on_click((_e, cx) => {
          // With messages waiting (the light bulb), a click brings the latest back; again, it goes.
          const waiting = this.pending();
          const recall = shared("winxp.clippy.recall");
          if (recall) setShared("winxp.clippy.recall", null);
          else if (waiting.length) {
            setShared("winxp.clippy.tip", null);
            setShared("winxp.clippy.recall", waiting.length > 1 ? "list" : keyOf(waiting[0]));
          } else {
            const tip = shared("winxp.clippy.tip");
            setShared("winxp.clippy.tip", tip == null ? Math.floor(Math.random() * this.tips().length) : null);
          }
          sfx("clippy");
          cx.notify();
        })
        .child(
          h_flex()
            .items_end()
            // The shift: so many dots of invisible text to the paperclip's left.
            .when(lively, (el) => el.child(div().flex_none().text_size(4).text_color(CLEAR).frames(SCRIPT.shift, TICK)))
            .when(!lively, (el) => el.child(div().flex_none().w(REST_SHIFT * 2)))
            .child(figure),
        )
        // The lift: so many lines of invisible text under it.
        .when(lively, (el) => el.child(div().flex_none().text_size(2).line_height(`${LIFT_PX}px`).text_color(CLEAR).frames(SCRIPT.lift, TICK)))
        .when(!lively, (el) => el.child(div().flex_none().h(REST_LIFT * LIFT_PX))),
    );
  }
}

/** The balloon (the clippy role): Office XP's pale yellow, rounded, a thin dark edge, blue
 *  bullets for the choices, and a tail down to the paperclip. A choice acts, then closes it. */
export default class ClippyBalloon {
  init(_p, cx) {
    const p = props() ?? {};
    if (!p.auto || !cx) return;
    // Closes itself unread after a few seconds (the light bulb remembers it), waiting while the
    // pointer is over it. One timer at a time, only while it's open.
    const tick = (c) => {
      if (this.hovered) return c.timer.after(1500, (d) => tick(d ?? c));
      setShared("winxp.clippy.quiet", [...new Set([...quieted(), p.agent])]);
      closeOverlay(p.overlay);
    };
    cx.timer.after(AUTO_CLOSE, (c) => tick(c ?? cx));
  }

  async close() {
    setShared("winxp.clippy.closed", { key: props()?.key, at: Date.now() });
  }

  /** The messages as a list in a sunken white field (XP's list box): who, where, and whether it
   *  waits for you or finished. It shows SHEET_ROWS rows, then scrolls. A row takes you there. */
  sheet(P, p) {
    const rows = p.sheet;
    return v_flex()
      .id("clippy-sheet")
      .flex_none()
      .h(Math.min(rows.length, SHEET_ROWS) * SHEET_ROW + 2)
      .border_1()
      .border_color(P.fieldBorder)
      .bg(P.field)
      .overflow_y_scroll()
      .children(
        rows.map((r, i) =>
          h_flex()
            .id(`clip-row-${i}`)
            .flex_none()
            .h(SHEET_ROW)
            .px(6)
            .gap(6)
            .items_center()
            .cursor_pointer()
            .text_color(P.dark ? P.faceText : "#000000")
            .hover((s) => s.bg(P.menuHover).text_color(P.menuHoverText))
            .on_click(() => {
              perform(r.act);
              closeOverlay(p.overlay);
            })
            .child(pic(r.status === "blocked" ? "warning" : "info", 16))
            .child(
              v_flex()
                .flex_1()
                .min_w(0)
                .child(div().truncate().font_weight(700).child(r.name))
                .child(div().truncate().text_size(10).opacity(0.8).child(`${r.status === "blocked" ? "Waiting for you" : "Finished"} · ${r.where}`)),
            ),
        ),
      );
  }

  render(_cx) {
    const P = pal();
    const p = props() ?? {};
    const link = P.dark ? "#9cc2ff" : "#0b3fa8";
    return v_flex()
      .id("xp-clippy-balloon")
      .on_hover((over) => {
        this.hovered = over;
      })
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
            .when(Boolean(p.sheet?.length), (el) => el.child(this.sheet(P, p)))
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
