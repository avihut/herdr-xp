// The card table every card game here is built on (Solitaire, Spider, FreeCell).
// It owns what makes them feel like XP's games, so each game only states its rules:
//   - drag and drop: press a card, drag it (and the cards on it) over a pile, let go;
//     a press without a drag is a click: pick a card up, click where it goes
//   - double-click or right-click: the game's automatic move (home to a foundation)
//   - Undo (Ctrl+Z / ⌘Z), New (F2), the Game and Help menus, the status bar, a timer
//   - messages on the table ("That move requires..."), a hint flash
//   - the bouncing-cards win (Solitaire's), when a game asks for it
//
// A game extends CardTable and fills in:
//   title(), icon, key (its shared command key), saveKeys (extra state Undo restores)
//   setup()                       deal: fill this.piles = { id: { cards: [{ s, r, up }] } }
//   layout(W, H)                  { id: { x, y, fan, fd, fu, step, label } } in table px;
//                                 fan: "down" (a column), "none" (a stack), "right3" (the last
//                                 three fanned, Draw Three), "right" (a row, step px), "deals"
//   canPick(id, i)                may the cards from i up be lifted
//   canDrop(cards, from, to)      true, false, or a sentence saying why not
//   moved(from, to, cards)        after a move: score, flip, put away, autoplay
//   clickPile(id, i)              a click the game handles itself (the deck, a face-down card)
//   autoMove(id)                  the double-click / right-click move; true if it moved
//   isWon(), status() [strings], gameMenu() [items], onCommand(c), onKey(keystroke)
//   celebrate (bouncing cards), foundations() (where they bounce from)

import { props, shared, closeOverlay } from "herdr";
import { div, h_flex, v_flex, pal, pic, frame, menuBar, uiFont, button } from "./kit.js";
import { card, CW, CH } from "./cards.js";

export const FELT = "#007f00";

export class CardTable {
  init(_p, cx) {
    this.W = 600;
    this.H = 400;
    this.focus = cx.focus_handle();
    this.seen = Number(shared(this.key)?.at ?? 0);
    this.newGame();
    cx.timer.every(1000, (cx) => {
      if (this.playing && !this.won) {
        this.time++;
        this.tick?.();
        cx.notify();
      }
    });
  }

  async close() {
    this.stopAnim();
  }

  // ---- state

  newGame() {
    this.stopAnim();
    this.piles = {};
    this.score = 0;
    this.time = 0;
    this.playing = false;
    this.won = false;
    this.sel = null;
    this.pending = null;
    this.msg = null;
    this.flash = null;
    this.undoStack = [];
    this.setup();
  }

  snapshot() {
    return JSON.stringify({ piles: this.piles, score: this.score, extra: (this.saveKeys ?? []).map((k) => this[k]) });
  }

  pushUndo() {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 300) this.undoStack.shift();
  }

  undo() {
    const s = this.undoStack.pop();
    if (!s) return;
    const d = JSON.parse(s);
    this.piles = d.piles;
    this.score = d.score;
    (this.saveKeys ?? []).forEach((k, i) => (this[k] = d.extra[i]));
    this.sel = null;
    this.msg = null;
    this.won = false;
    this.stopAnim();
  }

  pile(id) {
    return this.piles[id]?.cards ?? [];
  }

  top(id) {
    return this.pile(id).at(-1);
  }

  say(text, action = null) {
    this.msg = { text, action };
  }

  /** Moves the cards from index i of `from` onto `to`, if the rules allow it. */
  move(from, i, to, cx) {
    if (from === to) return false;
    const cards = this.pile(from).slice(i);
    if (!cards.length) return false;
    const ok = this.canDrop(cards, from, to);
    if (ok !== true) {
      if (typeof ok === "string") this.say(ok);
      return false;
    }
    this.pushUndo();
    this.pile(from).splice(i);
    this.pile(to).push(...cards);
    this.playing = true;
    this.sel = null;
    this.moved(from, to, cards);
    this.checkWin(cx);
    return true;
  }

  checkWin(cx) {
    if (this.won || !this.isWon()) return;
    this.won = true;
    this.playing = false;
    this.sel = null;
    if (this.celebrate && cx) this.startAnim(cx);
    else this.say(this.winText?.() ?? "Congratulations, you won! Deal again?", { label: "Deal", cmd: "new" });
  }

  // ---- the bouncing win

  startAnim(cx) {
    const L = this.layout(this.W, this.H);
    const queue = [];
    const founds = (this.foundations?.() ?? []).map((id) => ({ id, cards: [...this.pile(id)] }));
    for (let round = 0; round < 13; round++)
      for (const f of founds) {
        const c = f.cards.pop();
        if (c) queue.push({ c: { ...c, up: true }, x: L[f.id]?.x ?? 0, y: L[f.id]?.y ?? 0 });
      }
    this.anim = { queue, active: null, stamps: [] };
    this.anim.task = cx.timer.every(28, (cx) => this.step(cx));
  }

  step(cx) {
    const a = this.anim;
    if (!a) return;
    if (!a.active) {
      const next = a.queue.shift();
      if (!next) {
        a.task?.cancel();
        a.done = true;
        this.say(this.winText?.() ?? "Congratulations, you won! Deal again?", { label: "Deal", cmd: "new" });
        cx.notify();
        return;
      }
      const dir = Math.random() < 0.5 ? -1 : 1;
      a.active = { ...next, vx: dir * (2 + Math.random() * 5), vy: -(Math.random() * 8) };
    }
    const c = a.active;
    c.vy += 0.9;
    c.x += c.vx;
    c.y += c.vy;
    const floor = this.H - CH;
    if (c.y > floor) {
      c.y = floor;
      c.vy = -c.vy * 0.72;
      if (Math.abs(c.vy) < 2.5) c.vy = -7;
    }
    a.stamps.push({ c: c.c, x: c.x, y: c.y });
    if (a.stamps.length > 360) a.stamps.shift();
    if (c.x < -CW || c.x > this.W) a.active = null;
    cx.notify();
  }

  stopAnim() {
    this.anim?.task?.cancel();
    this.anim = null;
  }

  // ---- pointer

  press(id, i, x, y, e, cx) {
    this.focus.focus();
    if (this.anim) {
      this.stopAnim();
      if (this.won) return this.newGame();
    }
    this.msg = null;
    if (i >= 0 && e?.click_count >= 2) {
      this.pending = null;
      this.sel = null;
      this.autoMove?.(id, cx);
      return;
    }
    const gx = e?.local_position?.x ?? CW / 2;
    const gy = e?.local_position?.y ?? 10;
    this.pending = { id, i, gx, gy, sx: x + gx, sy: y + gy, x, y, drag: false };
  }

  hover(e, cx) {
    const p = e?.local_position;
    if (!p) return;
    this.pointer = p;
    this.hovered?.(p);
    const d = this.pending;
    if (!d) return;
    if (!d.drag) {
      if (Math.hypot(p.x - d.sx, p.y - d.sy) < 4) return;
      if (d.i < 0 || !this.canPick(d.id, d.i)) return;
      d.drag = true;
      this.sel = null;
    }
    d.x = p.x - d.gx;
    d.y = p.y - d.gy;
    cx.notify();
  }

  release(_e, cx) {
    const d = this.pending;
    this.pending = null;
    if (!d) return;
    if (d.drag) {
      const to = this.dropTarget(d.x + CW / 2, d.y + CH / 3, d.id);
      if (to) this.move(d.id, d.i, to, cx);
      cx.notify();
      return;
    }
    this.click(d.id, d.i, cx);
    cx.notify();
  }

  click(id, i, cx) {
    if (this.clickPile?.(id, i, cx)) {
      this.sel = null;
      this.checkWin(cx);
      return;
    }
    if (this.sel) {
      if (this.sel.id === id) {
        this.sel = null;
        return;
      }
      if (this.move(this.sel.id, this.sel.i, id, cx)) return;
      this.sel = null;
    }
    if (i >= 0 && this.canPick(id, i)) this.sel = { id, i };
  }

  rightClick(id, cx) {
    this.focus.focus();
    this.msg = null;
    this.sel = null;
    this.autoMove?.(id, cx);
  }

  /** The pile under a point: the nearest whose area (stack, or column to its last card) holds it. */
  dropTarget(px, py, from) {
    let best = null;
    let bestD = Infinity;
    for (const [id, r] of Object.entries(this.rects ?? {})) {
      if (id === from || r.noDrop) continue;
      const pad = 14;
      if (px < r.x - pad || px > r.x + r.w + pad || py < r.y - pad || py > r.y + r.h + pad) continue;
      const d = Math.abs(px - (r.x + r.w / 2)) + Math.abs(py - Math.min(r.y + r.h - CH / 2, Math.max(r.y + CH / 2, py))) * 0.3;
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    return best;
  }

  // ---- layout of cards

  positions(id, L) {
    const cards = this.pile(id);
    const out = [];
    if (!L) return out;
    if (L.fan === "down") {
      const room = this.H - L.y - CH - 6;
      const downs = cards.filter((c) => !c.up).length;
      const ups = cards.length - downs;
      const fd = L.fd ?? 4;
      let fu = L.fu ?? 16;
      if (ups > 1 && downs * fd + (ups - 1) * fu > room) fu = Math.max(6, (room - downs * fd) / (ups - 1));
      let y = L.y;
      cards.forEach((c) => {
        out.push({ x: L.x, y });
        y += c.up ? fu : fd;
      });
    } else if (L.fan === "right3") {
      const first = Math.max(0, cards.length - 3);
      cards.forEach((_, i) => out.push({ x: L.x + Math.max(0, i - first) * 14, y: L.y }));
    } else if (L.fan === "right") {
      cards.forEach((_, i) => out.push({ x: L.x + i * (L.step ?? 12), y: L.y }));
    } else {
      cards.forEach(() => out.push({ x: L.x, y: L.y }));
    }
    return out;
  }

  // ---- commands from menus (they live in other overlays) and keys

  cmd(c, extra = {}) {
    return { shared: [this.key, { cmd: c, ...extra, at: Date.now() }] };
  }

  command() {
    const c = shared(this.key);
    const at = Number(c?.at ?? 0);
    if (!c || at <= this.seen) return;
    this.seen = at;
    if (c.cmd === "new") this.newGame();
    else if (c.cmd === "undo") this.undo();
    else if (c.cmd === "exit") closeOverlay(props()?.overlay);
    else this.onCommand?.(c);
  }

  key(e, cx) {
    const k = e?.keystroke ?? "";
    if (k === "f2") this.newGame();
    else if (k === "cmd-z" || k === "ctrl-z") this.undo();
    else if (k === "escape") this.sel = null;
    else this.onKey?.(k, cx);
    cx.notify();
  }

  // ---- drawing

  cardAt(id, i, c, x, y, o = {}) {
    return div()
      .id(`${this.key}-${id}-${i}`)
      .absolute()
      .left(x)
      .top(y)
      .child(card(c, o))
      .on_mouse_down("left", (e, cx) => {
        cx.stop_propagation();
        this.press(id, i, x, y, e, cx);
        cx.notify();
      })
      .on_mouse_down("right", (_e, cx) => {
        cx.stop_propagation();
        this.rightClick(id, cx);
        cx.notify();
      });
  }

  table(P) {
    const L = this.layout(this.W, this.H);
    const items = [];
    const rects = {};
    const d = this.pending?.drag ? this.pending : null;
    const flash = this.flash && Date.now() < this.flash.until ? this.flash : null;
    for (const [id, l] of Object.entries(L)) {
      const cards = this.pile(id);
      const pos = this.positions(id, l);
      const last = pos.at(-1) ?? { x: l.x, y: l.y };
      rects[id] = { x: l.x, y: l.y, w: (l.fan === "right" || l.fan === "right3" ? last.x - l.x : 0) + CW, h: last.y - l.y + CH, noDrop: l.noDrop };
      if (l.fan === "deals") {
        const n = Math.ceil(cards.length / (l.per ?? 10));
        for (let k = 0; k < n; k++) items.push(this.cardAt(id, -1, { up: false }, l.x - k * 12, l.y));
        rects[id] = { x: l.x - (n - 1) * 12, y: l.y, w: CW + (n - 1) * 12, h: CH, noDrop: true };
        continue;
      }
      if (!cards.length) {
        if (!l.hidden) items.push(this.cardAt(id, -1, { slot: true }, l.x, l.y, { label: l.label }));
        continue;
      }
      // A stack shows its top two (the second for depth while the top is dragged).
      const from = l.fan === "none" ? Math.max(0, cards.length - 2) : 0;
      for (let i = from; i < cards.length; i++) {
        if (d && d.id === id && i >= d.i) continue;
        const selected = (this.sel && this.sel.id === id && i >= this.sel.i) || (flash && ((flash.from === id && i >= flash.i) || (flash.to === id && i === cards.length - 1)));
        items.push(this.cardAt(id, i, cards[i], pos[i].x, pos[i].y, { selected }));
      }
    }
    this.rects = rects;
    if (this.anim) for (const s of this.anim.stamps) items.push(div().absolute().left(s.x).top(s.y).child(card(s.c)));
    if (d) {
      const lifted = this.pile(d.id).slice(d.i);
      const L0 = L[d.id];
      const step = L0?.fan === "down" ? L0.fu ?? 16 : 0;
      lifted.forEach((c, k) => items.push(div().absolute().left(d.x).top(d.y + k * step).child(card(c))));
    }
    let board = div()
      .id(`${this.key}-board`)
      .relative()
      .flex_1()
      .min_h(0)
      .bg(FELT)
      .overflow_hidden()
      .track_focus(this.focus)
      .on_key_down((e, cx) => this.key(e, cx))
      .on_size_change((size, cx) => {
        if (!size) return;
        if (Math.abs(size.width - this.W) > 1 || Math.abs(size.height - this.H) > 1) {
          this.W = size.width;
          this.H = size.height;
          cx.notify();
        }
      })
      .on_mouse_down("left", (_e, cx) => {
        cx.stop_propagation();
        this.focus.focus();
        if (this.anim) {
          this.stopAnim();
          if (this.won) this.newGame();
        }
        this.sel = null;
        this.msg = null;
        cx.notify();
      })
      .on_mouse_move((e, cx) => this.hover(e, cx))
      .on_mouse_up("left", (e, cx) => this.release(e, cx))
      .children(items);
    if (this.extras) board = board.children(this.extras(P, L));
    if (this.msg) board = board.child(this.message(P));
    return board;
  }

  message(P) {
    const m = this.msg;
    return v_flex()
      .absolute()
      .top(Math.max(20, this.H / 2 - 60))
      .left(Math.max(10, this.W / 2 - 150))
      .w(300)
      .p(12)
      .gap(10)
      .rounded(4)
      .bg(P.face)
      .border_1()
      .border_color(P.frame)
      .items_center()
      .text_size(11)
      .text_color(P.faceText)
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .child(h_flex().gap(10).items_start().child(pic(m.action ? "info" : "warning", 32)).child(div().flex_1().child(m.text)))
      .child(
        h_flex()
          .gap(8)
          .when(Boolean(m.action), (el) =>
            el.child(
              button(P, `${this.key}-msg-act`, m.action.label, (_e, cx) => {
                const a = m.action;
                this.msg = null;
                if (a.cmd === "new") this.newGame();
                else this.onCommand?.({ cmd: a.cmd });
                cx.notify();
              }, { isDefault: true }),
            ),
          )
          .child(button(P, `${this.key}-msg-ok`, m.action ? "No" : "OK", (_e, cx) => {
            this.msg = null;
            cx.notify();
          }, { isDefault: !m.action })),
      );
  }

  render(_cx) {
    this.command();
    const P = pal();
    const gameMenu = () => [
      { label: this.dealLabel ?? "Deal", shortcut: "F2", act: this.cmd("new") },
      { sep: true },
      { label: "Undo", shortcut: "Ctrl+Z", disabled: !this.undoStack.length, act: this.cmd("undo") },
      ...(this.gameMenu?.() ?? []),
      { sep: true },
      { label: "Statistics...", disabled: true },
      { sep: true },
      { label: "Exit", act: this.cmd("exit") },
    ];
    const body = v_flex()
      .size_full()
      .font_family(uiFont())
      .child(menuBar(P, `${this.key}-mb`, [["Game", gameMenu], ["Help", [{ label: "Contents", act: { run: ["app.help", {}] } }, { sep: true }, { label: `About ${this.name}...`, act: { dialog: "about" } }]]]))
      .child(this.table(P))
      .child(
        h_flex()
          .flex_none()
          .h(20)
          .px(8)
          .gap(20)
          .justify_end()
          .items_center()
          .bg(P.face)
          .border_t_1()
          .border_color(P.popupBorder)
          .text_size(11)
          .text_color(P.faceText)
          .children(this.status().map((s) => div().child(s))),
      );
    return frame(P, {
      id: `xp-${this.key}`,
      title: this.title(),
      icon: pic(this.icon, 16),
      caps: [["ctl-min", () => closeOverlay(props()?.overlay)], ["ctl-close", () => closeOverlay(props()?.overlay)]],
      body,
    });
  }
}
