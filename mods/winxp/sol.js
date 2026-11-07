// Solitaire (Klondike, draw one): click the deck to turn a card; click a card
// to pick it up (and the cards on it), then click where it goes; double-click
// sends a card home to the foundations. Standard scoring.

import { props, shared, closeOverlay } from "herdr";
import { div, h_flex, v_flex, pal, pic, frame, menuBar, uiFont, own } from "./kit.js";
import { card, deck, shuffle, red, CW, CH } from "./cards.js";

const GAP = 11;
const X = (i) => 10 + i * (CW + GAP);
const TOP = 10;
const TAB = TOP + CH + 18;

export default class Sol {
  init(_p, cx) {
    this.seen = Number(shared("winxp.sol")?.at ?? 0);
    this.deal();
    cx.timer.every(1000, (cx) => {
      if (this.playing) {
        this.time++;
        cx.notify();
      }
    });
  }

  deal() {
    const d = shuffle(deck());
    this.tab = Array.from({ length: 7 }, (_, i) => {
      const pile = d.splice(0, i + 1);
      pile[pile.length - 1].up = true;
      return pile;
    });
    this.stock = d;
    this.waste = [];
    this.found = [[], [], [], []];
    this.sel = null; // { from: "waste" | "tab" | "found", pile, index }
    this.score = 0;
    this.time = 0;
    this.playing = false;
    this.won = false;
  }

  command() {
    const c = shared("winxp.sol");
    const at = Number(c?.at ?? 0);
    if (!c || at <= this.seen) return;
    this.seen = at;
    if (c.cmd === "deal") this.deal();
  }

  pileOf(from, pile) {
    return from === "waste" ? this.waste : from === "found" ? this.found[pile] : this.tab[pile];
  }

  picked() {
    if (!this.sel) return [];
    return this.pileOf(this.sel.from, this.sel.pile).slice(this.sel.index);
  }

  canFound(c, f) {
    const top = this.found[f].at(-1);
    return top ? top.s === c.s && c.r === top.r + 1 : c.r === 1;
  }

  canTab(c, t) {
    const top = this.tab[t].at(-1);
    return top ? top.up && red(top.s) !== red(c.s) && c.r === top.r - 1 : c.r === 13;
  }

  take() {
    const src = this.pileOf(this.sel.from, this.sel.pile);
    const moved = src.splice(this.sel.index);
    if (this.sel.from === "tab" && src.length && !src.at(-1).up) {
      src.at(-1).up = true;
      this.score += 5;
    }
    return moved;
  }

  moveTo(kind, i) {
    const cards = this.picked();
    if (!cards.length) return false;
    if (kind === "found") {
      if (cards.length !== 1 || !this.canFound(cards[0], i)) return false;
      const from = this.sel.from;
      this.found[i].push(...this.take());
      this.score += from === "found" ? 0 : 10;
    } else {
      if (!this.canTab(cards[0], i)) return false;
      const from = this.sel.from;
      this.tab[i].push(...this.take());
      this.score += from === "waste" ? 5 : from === "found" ? -15 : 0;
    }
    this.score = Math.max(0, this.score);
    this.sel = null;
    this.playing = true;
    this.won = this.found.every((f) => f.length === 13);
    if (this.won) this.playing = false;
    return true;
  }

  home(from, pile) {
    const src = this.pileOf(from, pile);
    const c = src.at(-1);
    if (!c || !c.up) return;
    for (let f = 0; f < 4; f++)
      if (this.canFound(c, f)) {
        this.sel = { from, pile, index: src.length - 1 };
        this.moveTo("found", f);
        return;
      }
  }

  clickStock() {
    this.sel = null;
    this.playing = true;
    if (this.stock.length) {
      const c = this.stock.pop();
      c.up = true;
      this.waste.push(c);
    } else {
      this.stock = this.waste.reverse().map((c) => ({ ...c, up: false }));
      this.waste = [];
      this.score = Math.max(0, this.score - 100);
    }
  }

  clickCard(from, pile, index, e) {
    const src = this.pileOf(from, pile);
    const c = src[index];
    if (from === "tab" && !c.up) {
      if (index === src.length - 1) {
        c.up = true;
        this.score += 5;
      }
      this.sel = null;
      return;
    }
    if (e?.click_count >= 2 && index === src.length - 1 && from !== "found") {
      this.sel = null;
      this.home(from, pile);
      return;
    }
    if (this.sel) {
      const same = this.sel.from === from && this.sel.pile === pile;
      if (same) {
        this.sel = null;
        return;
      }
      if (from === "tab" && this.moveTo("tab", pile)) return;
      if (from === "found" && this.moveTo("found", pile)) return;
    }
    if (from === "waste" || from === "found") index = src.length - 1;
    this.sel = { from, pile, index };
  }

  clickEmpty(kind, i) {
    if (this.sel) this.moveTo(kind, i);
  }

  at(el, x, y) {
    return div().absolute().left(x).top(y).child(el);
  }

  render(_cx) {
    this.command();
    const P = pal();
    const sel = this.sel;
    const isSel = (from, pile, index) => sel && sel.from === from && sel.pile === pile && index >= sel.index;
    const items = [];
    // deck
    items.push(
      own(
        div()
          .id("sol-stock")
          .absolute()
          .left(X(0))
          .top(TOP)
          .child(this.stock.length ? card({ up: false }) : card({ slot: true }, { label: "○" }))
          .on_click((_e, cx) => {
            this.clickStock();
            cx.notify();
          }),
      ),
    );
    // waste: the top card (and a hint of the one under it)
    if (this.waste.length > 1) items.push(this.at(card(this.waste.at(-2)), X(1), TOP));
    if (this.waste.length) {
      const i = this.waste.length - 1;
      items.push(own(div().id("sol-waste").absolute().left(X(1)).top(TOP).child(card(this.waste[i], { selected: isSel("waste", 0, i) })).on_click((e, cx) => {
        this.clickCard("waste", 0, i, e);
        cx.notify();
      })));
    }
    // foundations
    for (let f = 0; f < 4; f++) {
      const pile = this.found[f];
      const el = pile.length ? card(pile.at(-1), { selected: isSel("found", f, pile.length - 1) }) : card({ slot: true });
      items.push(own(div().id(`sol-f${f}`).absolute().left(X(3 + f)).top(TOP).child(el).on_click((e, cx) => {
        if (pile.length) this.clickCard("found", f, pile.length - 1, e);
        else this.clickEmpty("found", f);
        cx.notify();
      })));
    }
    // tableau
    for (let t = 0; t < 7; t++) {
      const pile = this.tab[t];
      if (!pile.length) {
        items.push(own(div().id(`sol-t${t}-empty`).absolute().left(X(t)).top(TAB).child(card({ slot: true })).on_click((_e, cx) => {
          this.clickEmpty("tab", t);
          cx.notify();
        })));
        continue;
      }
      let y = TAB;
      pile.forEach((c, i) => {
        items.push(own(div().id(`sol-t${t}-${i}`).absolute().left(X(t)).top(y).child(card(c, { selected: isSel("tab", t, i) })).on_click((e, cx) => {
          this.clickCard("tab", t, i, e);
          cx.notify();
        })));
        y += c.up ? 16 : 4;
      });
    }
    let board = div().relative().flex_1().min_h(0).bg("#007f00").overflow_hidden().children(items);
    if (this.won) {
      board = board.child(
        v_flex()
          .absolute()
          .top(150)
          .left(170)
          .w(260)
          .p(14)
          .gap(10)
          .rounded(4)
          .bg(P.face)
          .border_1()
          .border_color(P.frame)
          .items_center()
          .child(div().font_weight(700).text_size(13).text_color(P.faceText).child("Game over"))
          .child(div().text_size(11).text_color(P.faceText).child(`Score ${this.score} in ${this.time} seconds. Deal again?`))
          .child(own(div().id("sol-again").px(14).py(3).rounded(3).border_1().border_color(P.buttonBorder).bg(P.button[0]).text_size(11).text_color("#000000").child("Deal").on_click((_e, cx) => {
            this.deal();
            cx.notify();
          }))),
      );
    }
    const body = v_flex()
      .size_full()
      .child(
        menuBar(P, "sl", [
          ["Game", () => [{ label: "Deal", shortcut: "F2", act: { shared: ["winxp.sol", { cmd: "deal", at: Date.now() }] } }, { sep: true }, { label: "Undo", disabled: true }, { label: "Deck...", disabled: true }, { label: "Options...", disabled: true }]],
          ["Help", [{ label: "Contents", act: { run: ["app.help", {}] } }, { sep: true }, { label: "About Solitaire...", act: { dialog: "about" } }]],
        ]),
      )
      .child(board)
      .child(h_flex().flex_none().h(20).px(8).gap(20).justify_end().items_center().bg(P.face).text_size(11).text_color(P.faceText).child(`Score: ${this.score}`).child(`Time: ${this.time}`));
    return frame(P, {
      id: "xp-sol",
      title: "Solitaire",
      icon: pic("sol", 16),
      caps: [["ctl-min", () => closeOverlay(props()?.overlay)], ["ctl-max", () => {}], ["ctl-close", () => closeOverlay(props()?.overlay)]],
      body,
    });
  }
}
