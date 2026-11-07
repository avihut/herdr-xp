// Minesweeper: Beginner 9×9 (10 mines), Intermediate 16×16 (40), Expert
// 30×16 (99). The first click is always safe. Left click opens, right click
// flags (then ?), double-click a number to open around it when its flags
// add up. The smiley starts over; the counters are mines left and seconds.

import { props, shared, settings, openOverlay } from "herdr";
import { div, h_flex, v_flex, pal, pic, frame, menuBar, uiFont, own } from "./kit.js";
import { closeOverlay } from "herdr";

const LEVELS = { beginner: [9, 9, 10], intermediate: [16, 16, 40], expert: [30, 16, 99] };
const NUM = ["", "#0000ff", "#008000", "#ff0000", "#000080", "#800000", "#008080", "#000000", "#808080"];
const CELL = 16;

export function minesSize(level) {
  const [cols, rows] = LEVELS[level] ?? LEVELS.beginner;
  return [Math.max(190, cols * CELL + 32), rows * CELL + 150];
}

export default class Mines {
  init(p, cx) {
    this.level = p?.level ?? props()?.level ?? "beginner";
    this.seen = Number(shared("winxp.mines")?.at ?? 0);
    this.reset();
    cx.timer.every(1000, (cx) => {
      if (this.state === "play") {
        this.time = Math.min(999, this.time + 1);
        cx.notify();
      }
    });
  }

  reset() {
    const [cols, rows, mines] = LEVELS[this.level] ?? LEVELS.beginner;
    Object.assign(this, { cols, rows, mines, n: cols * rows, state: "ready", time: 0, boom: -1, pressing: false });
    this.mine = new Array(this.n).fill(false);
    this.open = new Array(this.n).fill(false);
    this.flag = new Array(this.n).fill(0);
    this.count = new Array(this.n).fill(0);
  }

  around(i) {
    const x = i % this.cols, y = Math.floor(i / this.cols), out = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < this.cols && ny < this.rows) out.push(ny * this.cols + nx);
      }
    return out;
  }

  plant(safe) {
    const keep = new Set([safe, ...this.around(safe)]);
    let left = this.mines;
    while (left > 0) {
      const i = Math.floor(Math.random() * this.n);
      if (this.mine[i] || keep.has(i)) continue;
      this.mine[i] = true;
      left--;
    }
    for (let i = 0; i < this.n; i++) this.count[i] = this.around(i).filter((j) => this.mine[j]).length;
  }

  reveal(i) {
    if (this.state === "won" || this.state === "lost" || this.open[i] || this.flag[i] === 1) return;
    if (this.state === "ready") {
      this.plant(i);
      this.state = "play";
    }
    if (this.mine[i]) {
      this.boom = i;
      this.state = "lost";
      for (let j = 0; j < this.n; j++) if (this.mine[j]) this.open[j] = true;
      return;
    }
    const stack = [i];
    while (stack.length) {
      const j = stack.pop();
      if (this.open[j] || this.flag[j] === 1) continue;
      this.open[j] = true;
      if (this.count[j] === 0) for (const k of this.around(j)) if (!this.open[k] && !this.mine[k]) stack.push(k);
    }
    if (this.open.filter((o, j) => o && !this.mine[j]).length === this.n - this.mines) {
      this.state = "won";
      for (let j = 0; j < this.n; j++) if (this.mine[j]) this.flag[j] = 1;
    }
  }

  chord(i) {
    if (!this.open[i] || !this.count[i]) return;
    const near = this.around(i);
    if (near.filter((j) => this.flag[j] === 1).length !== this.count[i]) return;
    for (const j of near) if (!this.open[j] && this.flag[j] !== 1) this.reveal(j);
  }

  toggleFlag(i) {
    if (this.open[i] || this.state === "won" || this.state === "lost") return;
    this.flag[i] = (this.flag[i] + 1) % 3;
  }

  setLevel(level) {
    const [w, h] = minesSize(level);
    const z = Number(settings()?.zoom) || 1;
    openOverlay({ mod: "winxp", kind: "window", frame: "none", key: "winxp-mines", width: w * z, height: h * z, props: { role: "mines", level } });
  }

  command() {
    const c = shared("winxp.mines");
    const at = Number(c?.at ?? 0);
    if (!c || at <= this.seen) return;
    this.seen = at;
    if (c.cmd === "new") this.reset();
    if (c.cmd === "level" && c.level !== this.level) this.setLevel(c.level);
  }

  raised(content, size) {
    return div()
      .w(size)
      .h(size)
      .flex_none()
      .bg("#c0c0c0")
      .border_r(2)
      .border_b(2)
      .border_color("#808080")
      .child(div().size_full().border_t(2).border_l(2).border_color("#ffffff").flex().items_center().justify_center().child(content));
  }

  sunken(content, w) {
    return div().flex_none().border_t(w).border_l(w).border_color("#808080").child(div().border_r(w).border_b(w).border_color("#ffffff").child(content));
  }

  led(n) {
    const s = n < 0 ? `-${String(Math.min(99, -n)).padStart(2, "0")}` : String(Math.min(999, n)).padStart(3, "0");
    return this.sunken(div().w(41).h(25).bg("#000000").flex().items_center().justify_center().font_family("Courier New").font_weight(700).text_size(22).text_color("#ff0000").child(s), 1);
  }

  cell(i) {
    const shownOpen = this.open[i];
    if (!shownOpen) {
      const f = this.flag[i];
      const wrongFlag = this.state === "lost" && f === 1 && !this.mine[i];
      let inner = f === 1 ? pic(wrongFlag ? "mine-wrong" : "mine-flag", 12) : f === 2 ? div().text_size(11).font_weight(700).child("?") : div();
      return own(
        div()
          .id(`mc-${i}`)
          .child(this.raised(inner, CELL))
          .on_mouse_down("left", (_e, cx) => {
            cx.stop_propagation();
            if (this.state === "ready" || this.state === "play") this.pressing = true;
            cx.notify();
          })
          .on_mouse_up("left", (_e, cx) => {
            this.pressing = false;
            cx.notify();
          })
          .on_click((_e, cx) => {
            this.pressing = false;
            this.reveal(i);
            cx.notify();
          })
          .on_mouse_down("right", (_e, cx) => {
            cx.stop_propagation();
            this.toggleFlag(i);
            cx.notify();
          }),
      );
    }
    const bomb = this.mine[i];
    return own(
      div()
        .id(`mc-${i}`)
        .w(CELL)
        .h(CELL)
        .flex_none()
        .bg(i === this.boom ? "#ff0000" : "#c0c0c0")
        .border_r_1()
        .border_b_1()
        .border_color("#808080")
        .flex()
        .items_center()
        .justify_center()
        .child(bomb ? pic("mine-bomb", 13) : div().font_family(uiFont()).font_weight(700).text_size(12).text_color(NUM[this.count[i]] || "#000000").child(this.count[i] ? String(this.count[i]) : ""))
        .on_click((e, cx) => {
          if (e?.click_count >= 2) this.chord(i);
          cx.notify();
        }),
    );
  }

  render(_cx) {
    this.command();
    const P = pal();
    const face = this.state === "lost" ? "face-dead" : this.state === "won" ? "face-cool" : this.pressing ? "face-ooh" : "face-smile";
    const flags = this.flag.filter((f) => f === 1).length;
    const rows = [];
    for (let y = 0; y < this.rows; y++) rows.push(h_flex().children(Array.from({ length: this.cols }, (_, x) => this.cell(y * this.cols + x))));
    const lv = (key, label) => ({ label, radio: this.level === key, act: { shared: ["winxp.mines", { cmd: "level", level: key, at: Date.now() }] } });
    const body = v_flex()
      .size_full()
      .child(
        menuBar(P, "mn", [
          ["Game", () => [
            { label: "New", shortcut: "F2", act: { shared: ["winxp.mines", { cmd: "new", at: Date.now() }] } },
            { sep: true },
            lv("beginner", "Beginner"),
            lv("intermediate", "Intermediate"),
            lv("expert", "Expert"),
            { label: "Custom...", disabled: true },
            { sep: true },
            { label: "Marks (?)", checked: true, disabled: true },
            { label: "Color", checked: true, disabled: true },
            { sep: true },
            { label: "Best Times...", disabled: true },
          ]],
          ["Help", [{ label: "Contents", act: { run: ["app.help", {}] } }, { sep: true }, { label: "About Minesweeper...", act: { dialog: "about" } }]],
        ]),
      )
      .child(
        v_flex()
          .flex_1()
          .bg("#c0c0c0")
          .p(6)
          .gap(6)
          .border_t(3)
          .border_l(3)
          .border_color("#ffffff")
          .child(
            this.sunken(
              h_flex()
                .h(36)
                .px(5)
                .items_center()
                .justify_between()
                .bg("#c0c0c0")
                .child(this.led(this.mines - flags))
                .child(
                  own(
                    div()
                      .id("mn-face")
                      .child(this.raised(pic(face, 18), 26))
                      .on_click((_e, cx) => {
                        this.reset();
                        cx.notify();
                      }),
                  ),
                )
                .child(this.led(this.time)),
              2,
            ),
          )
          .child(this.sunken(v_flex().children(rows), 3)),
      );
    return frame(P, {
      id: "xp-mines",
      title: "Minesweeper",
      icon: pic("mines", 16),
      caps: [["ctl-min", () => closeOverlay(props()?.overlay)], ["ctl-close", () => closeOverlay(props()?.overlay)]],
      body,
      bodyBg: "#c0c0c0",
    });
  }
}
