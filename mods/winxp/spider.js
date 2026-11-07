// Spider Solitaire: ten piles, 104 cards. Build down from King to Ace; a run
// of one suit moves as a unit; a full King-to-Ace run of one suit is put
// away. Click the deck (bottom right) to deal a card onto every pile (no pile
// may be empty). Difficulty: one suit, two suits or four. Score starts at
// 500, a move costs 1, a finished run earns 100.

import { props, shared, closeOverlay } from "herdr";
import { div, h_flex, v_flex, pal, pic, frame, menuBar, own } from "./kit.js";
import { card, deck, shuffle, CW, CH } from "./cards.js";

const GAP = 8;
const X = (i) => 8 + i * (CW + GAP);
const TOP = 8;
const SUITS_FOR = { 1: [0], 2: [0, 1], 4: [0, 1, 2, 3] };

export default class Spider {
  init(_p, cx) {
    this.seen = Number(shared("winxp.spider")?.at ?? 0);
    this.suits = Number(shared("winxp.spider.suits") ?? 1) || 1;
    this.deal();
    this.boardH = 440;
  }

  deal() {
    const suits = SUITS_FOR[this.suits] ?? [0];
    const d = shuffle(deck(suits, 8 / suits.length));
    this.piles = Array.from({ length: 10 }, (_, i) => {
      const pile = d.splice(0, i < 4 ? 6 : 5);
      pile[pile.length - 1].up = true;
      return pile;
    });
    this.stock = d; // 50 cards: five deals
    this.done = 0;
    this.score = 500;
    this.moves = 0;
    this.sel = null; // { pile, index }
    this.msg = null;
  }

  command() {
    const c = shared("winxp.spider");
    const at = Number(c?.at ?? 0);
    if (!c || at <= this.seen) return;
    this.seen = at;
    if (c.cmd === "new") this.deal();
    if (c.cmd === "deal") this.dealRow();
    if (c.cmd === "suits") {
      this.suits = c.suits;
      this.deal();
    }
  }

  runOk(pile, index) {
    const p = this.piles[pile];
    for (let i = index; i < p.length; i++) {
      if (!p[i].up) return false;
      if (i > index && (p[i].s !== p[i - 1].s || p[i].r !== p[i - 1].r - 1)) return false;
    }
    return true;
  }

  tidy(pile) {
    const p = this.piles[pile];
    if (p.length && !p.at(-1).up) p.at(-1).up = true;
    // A whole King-to-Ace run of one suit goes away.
    if (p.length >= 13) {
      const tail = p.slice(-13);
      const ok = tail[0].r === 13 && tail.every((c, i) => c.up && c.s === tail[0].s && c.r === 13 - i);
      if (ok) {
        p.splice(-13);
        this.done++;
        this.score += 100;
        if (p.length && !p.at(-1).up) p.at(-1).up = true;
        if (this.done === 8) this.msg = `You won! Score ${this.score} in ${this.moves} moves.`;
      }
    }
  }

  move(to) {
    const { pile, index } = this.sel;
    const cards = this.piles[pile].slice(index);
    const top = this.piles[to].at(-1);
    if (to === pile || (top && top.r !== cards[0].r + 1)) return false;
    this.piles[to].push(...this.piles[pile].splice(index));
    this.sel = null;
    this.moves++;
    this.score--;
    this.tidy(pile);
    this.tidy(to);
    return true;
  }

  dealRow() {
    this.sel = null;
    if (!this.stock.length) return;
    if (this.piles.some((p) => !p.length)) {
      this.msg = "You are not allowed to deal a new row while any pile is empty.";
      return;
    }
    for (let i = 0; i < 10; i++) {
      const c = this.stock.pop();
      c.up = true;
      this.piles[i].push(c);
    }
    this.moves++;
    this.score--;
    for (let i = 0; i < 10; i++) this.tidy(i);
  }

  click(pile, index) {
    this.msg = null;
    const p = this.piles[pile];
    if (this.sel) {
      if (this.move(pile)) return;
      if (this.sel.pile === pile) {
        this.sel = null;
        return;
      }
    }
    if (index >= 0 && p[index]?.up && this.runOk(pile, index)) this.sel = { pile, index };
    else this.sel = null;
  }

  render(_cx) {
    this.command();
    const P = pal();
    const items = [];
    const avail = this.boardH - TOP - 120;
    for (let t = 0; t < 10; t++) {
      const pile = this.piles[t];
      if (!pile.length) {
        items.push(own(div().id(`sp-${t}-e`).absolute().left(X(t)).top(TOP).child(card({ slot: true })).on_click((_e, cx) => {
          this.click(t, -1);
          cx.notify();
        })));
        continue;
      }
      const downs = pile.filter((c) => !c.up).length;
      const ups = pile.length - downs;
      const upStep = Math.max(9, Math.min(18, (avail - downs * 6) / Math.max(1, ups - 1)));
      let y = TOP;
      pile.forEach((c, i) => {
        const selected = this.sel && this.sel.pile === t && i >= this.sel.index;
        items.push(own(div().id(`sp-${t}-${i}`).absolute().left(X(t)).top(y).child(card(c, { selected })).on_click((_e, cx) => {
          this.click(t, i);
          cx.notify();
        })));
        y += c.up ? upStep : 6;
      });
    }
    // finished runs, bottom left
    for (let k = 0; k < this.done; k++) items.push(div().absolute().left(8 + k * 14).bottom(8).child(card({ s: 0, r: 13, up: true })));
    // the deck, bottom right: one back per deal left
    const deals = Math.ceil(this.stock.length / 10);
    for (let k = 0; k < deals; k++)
      items.push(own(div().id(`sp-deal-${k}`).absolute().right(8 + k * 14).bottom(8).child(card({ up: false })).on_click((_e, cx) => {
        this.dealRow();
        cx.notify();
      })));
    let board = div()
      .id("sp-board")
      .relative()
      .flex_1()
      .min_h(0)
      .bg("#007f00")
      .overflow_hidden()
      .on_size_change((size, cx) => {
        if (Math.abs((size?.height ?? 0) - this.boardH) > 2) {
          this.boardH = size.height;
          cx.notify();
        }
      })
      .children(items)
      .child(
        div()
          .absolute()
          .bottom(24)
          .left(320)
          .w(160)
          .p(8)
          .rounded(4)
          .border_1()
          .border_color("#003300")
          .bg("#006400")
          .text_size(11)
          .text_color("#ffffff")
          .flex()
          .flex_col()
          .items_center()
          .child(`Score: ${this.score}`)
          .child(`Moves: ${this.moves}`),
      );
    if (this.msg) board = board.child(div().absolute().top(160).left(250).w(300).p(12).rounded(4).bg(P.face).border_1().border_color(P.frame).text_size(11).text_color(P.faceText).child(this.msg));
    const lv = (n, label) => ({ label, radio: this.suits === n, act: { shared: ["winxp.spider", { cmd: "suits", suits: n, at: Date.now() }] } });
    const body = v_flex()
      .size_full()
      .child(
        menuBar(P, "sp", [
          ["Game", () => [
            { label: "New Game", shortcut: "F2", act: { shared: ["winxp.spider", { cmd: "new", at: Date.now() }] } },
            { label: "Deal Next Row", disabled: !this.stock.length, act: { shared: ["winxp.spider", { cmd: "deal", at: Date.now() }] } },
            { sep: true },
            { label: "Difficulty", sub: [lv(1, "Easy: One Suit"), lv(2, "Medium: Two Suits"), lv(4, "Difficult: Four Suits")] },
            { label: "Statistics...", disabled: true },
          ]],
          ["Help", [{ label: "Contents", act: { run: ["app.help", {}] } }, { sep: true }, { label: "About Spider Solitaire...", act: { dialog: "about" } }]],
        ]),
      )
      .child(board);
    return frame(P, {
      id: "xp-spider",
      title: "Spider Solitaire",
      icon: pic("spider", 16),
      caps: [["ctl-min", () => closeOverlay(props()?.overlay)], ["ctl-max", () => {}], ["ctl-close", () => closeOverlay(props()?.overlay)]],
      body,
    });
  }
}
