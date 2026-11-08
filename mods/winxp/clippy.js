// The Office Assistant (the clippy role), a paperclip floating at the bottom of the desktop, as
// in the Windows 98 layout. When an agent needs you (blocked) or finished while you looked away
// (done), a yellow Office XP balloon offers to take you there. Click the paperclip for a tip.
// The balloon's "Hide me", Display Properties or Start > All Programs > Accessories > Office
// Assistant hide and show it (shared winxp.clippy: "off" hides it). The paperclip is drawn here
// (img/clippy.svg), not taken from Office.

import { image } from "gpui-kit";
import { agents, run, shared, setShared, placement } from "herdr";
import { div, h_flex, v_flex, pal, pic, uiFont, own, sfx, hasSim } from "./kit.js";

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

export default class Clippy {
  init() {
    this.dismissed = new Set();
    this.tip = null;
  }

  tips() {
    return hasSim() ? [...TIPS, SIM_TIP] : TIPS;
  }

  /** The agent to tell you about: one waiting for you first, else one that finished. */
  news() {
    const list = agents()
      .filter((a) => (a.status === "blocked" || a.status === "done") && !a.focused)
      .filter((a) => !this.dismissed.has(`${a.address}:${a.status}`))
      .sort((a, b) => (a.status === "blocked") - (b.status === "blocked") || a.seq - b.seq);
    return list.pop() ?? null;
  }

  render(_cx) {
    if (shared("winxp.clippy") === "off") return div();
    const P = pal();
    const a = this.news();
    const right = placement()?.edge === "right";
    let balloon = null;
    if (a) {
      const name = a.program?.name ?? a.app ?? "Your agent";
      const where = `'${a.space_name} \\ ${a.tab_name}'`;
      const text =
        a.status === "blocked"
          ? `It looks like ${name} in\n${where} is waiting for you.\n\nWould you like help?`
          : `It looks like ${name} finished\nin ${where}.\n\nWant to see what it did?`;
      balloon = this.balloon(P, right, text, [
        ["Take me there", () => {
          run("agent.focus", { terminal: a.address });
          this.dismissed.add(`${a.address}:${a.status}`);
        }],
        ["Not now", () => this.dismissed.add(`${a.address}:${a.status}`)],
      ]);
    } else if (this.tip !== null) {
      const tips = this.tips();
      balloon = this.balloon(P, right, tips[this.tip % tips.length], [
        ["Next tip", () => (this.tip = (this.tip + 1) % tips.length)],
        ["Close", () => (this.tip = null)],
        ["Hide me", () => setShared("winxp.clippy", "off")],
      ]);
    }
    // Forget dismissals once their agents have moved on.
    for (const k of [...this.dismissed]) {
      const [addr, st] = k.split(":");
      if (!agents().some((x) => x.address === addr && x.status === st)) this.dismissed.delete(k);
    }
    const clip = own(
      div()
        .id("clippy")
        .relative()
        .flex_none()
        .cursor_pointer()
        .tooltip("Office Assistant")
        .when(Boolean(a), (el) => el.loop("top", { from: 0, to: -5, period: 800 }))
        .on_click((_e, cx) => {
          this.tip = this.tip === null ? Math.floor(Math.random() * this.tips().length) : null;
          sfx("clippy");
          cx.notify();
        })
        .child(image("mods/winxp/img/clippy.svg").w(64).h(80)),
    );
    return v_flex()
      .id("xp-clippy")
      .p(4)
      .gap(0)
      .font_family(uiFont())
      .map((el) => (right ? el.items_end() : el.items_start()))
      .when(Boolean(balloon), (el) => el.child(balloon))
      .child(clip);
  }

  /** Office XP's balloon: pale yellow, rounded, a thin dark edge, blue bullets for the choices,
   *  and a tail down to the paperclip. */
  balloon(P, right, text, actions) {
    const link = P.dark ? "#9cc2ff" : "#0b3fa8";
    return v_flex()
      .flex_none()
      .child(
        v_flex()
          .w(210)
          .p(9)
          .gap(8)
          .rounded(8)
          .border_1()
          .border_color(P.balloonBorder)
          .bg(P.balloon)
          .text_size(11)
          .text_color(P.dark ? P.faceText : "#000000")
          .child(v_flex().children(String(text).split("\n").map((l) => div().child(l || " "))))
          .child(
            v_flex()
              .gap(4)
              .children(
                actions.map(([t, fn], i) =>
                  own(
                    h_flex()
                      .id(`clip-${i}`)
                      .gap(6)
                      .items_center()
                      .cursor_pointer()
                      .on_click((_e, cx) => {
                        fn();
                        cx.notify();
                      })
                      .child(div().flex_none().w(8).h(8).rounded(4).bg("#2f71cd").border_1().border_color("#1c3f94"))
                      .child(div().text_color(link).hover((s) => s.underline()).child(t)),
                  ),
                ),
              ),
          ),
      )
      .child(
        h_flex()
          .flex_none()
          .h(12)
          .map((el) => (right ? el.justify_end().pr(26) : el.justify_start().pl(26)))
          .child(pic(P.dark ? "balloon-tail-dark" : "balloon-tail", 14).mt(-1)),
      );
  }
}
