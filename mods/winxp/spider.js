// Spider Solitaire: ten columns, 104 cards. Build down regardless of suit; a run
// of one suit moves as a unit; a King-to-Ace run of one suit is put away. Click
// the deck (bottom right) to deal a card onto every column; no column may be
// empty. Difficulty: one, two or four suits. Score starts at 500; a move costs
// 1; a finished run earns 100. H shows an available move.

import { shared, setShared } from "herdr";
import { div, v_flex } from "./kit.js";
import { CardTable } from "./cardtable.js";
import { deck, shuffle, CW, CH } from "./cards.js";

const COLS = Array.from({ length: 10 }, (_, i) => `t${i}`);
const SUITS_FOR = { 1: [0], 2: [0, 1], 4: [0, 1, 2, 3] };

export default class Spider extends CardTable {
  init(p, cx) {
    this.key = "winxp.spider";
    this.icon = "spider";
    this.name = "Spider Solitaire";
    this.dealLabel = "New Game";
    this.celebrate = true;
    this.saveKeys = ["moves"];
    this.suits = Number(shared("winxp.spider.suits") ?? 1);
    if (!SUITS_FOR[this.suits]) this.suits = 1;
    super.init(p, cx);
  }

  title() {
    return "Spider Solitaire";
  }

  setup() {
    const suits = SUITS_FOR[this.suits];
    const d = shuffle(deck(suits, 8 / suits.length));
    COLS.forEach((id, i) => {
      const cards = d.splice(0, i < 4 ? 6 : 5);
      cards.at(-1).up = true;
      this.piles[id] = { cards };
    });
    this.piles.stock = { cards: d };
    this.piles.done = { cards: [] };
    this.score = 500;
    this.moves = 0;
  }

  layout(W, H) {
    const gap = Math.max(4, (W - 16 - 10 * CW) / 9);
    const L = {};
    COLS.forEach((id, i) => (L[id] = { x: 8 + i * (CW + gap), y: 8, fan: "down", fd: 6, fu: 18 }));
    L.stock = { x: W - 8 - CW, y: H - CH - 8, fan: "deals", per: 10 };
    L.done = { x: 8, y: H - CH - 8, fan: "right", step: 14, noDrop: true, hidden: true };
    return L;
  }

  // Columns end above the deck and the finished runs.
  positions(id, L) {
    if (!id.startsWith("t")) return super.positions(id, L);
    const H = this.H;
    this.H = H - CH - 16;
    const out = super.positions(id, L);
    this.H = H;
    return out;
  }

  foundations() {
    return ["done"];
  }

  runFrom(id, i) {
    const p = this.pile(id);
    for (let k = i; k < p.length; k++) {
      if (!p[k].up) return false;
      if (k > i && (p[k].s !== p[k - 1].s || p[k].r !== p[k - 1].r - 1)) return false;
    }
    return true;
  }

  canPick(id, i) {
    return id.startsWith("t") && this.runFrom(id, i);
  }

  canDrop(cards, _from, to) {
    if (!to.startsWith("t")) return false;
    const t = this.top(to);
    return !t || t.r === cards[0].r + 1;
  }

  tidy(id) {
    const p = this.pile(id);
    if (p.length && !p.at(-1).up) p.at(-1).up = true;
    if (p.length >= 13) {
      const tail = p.slice(-13);
      if (tail[0].r === 13 && tail.every((c, k) => c.up && c.s === tail[0].s && c.r === 13 - k)) {
        p.splice(-13);
        this.pile("done").push(tail[0]);
        this.piles.done.full = [...(this.piles.done.full ?? []), ...tail];
        this.score += 100;
        if (p.length && !p.at(-1).up) p.at(-1).up = true;
      }
    }
  }

  moved(from, to) {
    this.moves++;
    this.score--;
    this.tidy(from);
    this.tidy(to);
  }

  clickPile(id) {
    if (id !== "stock") return false;
    if (!this.pile("stock").length) return true;
    if (COLS.some((c) => !this.pile(c).length)) {
      this.say("You are not allowed to deal a new row while any columns are empty.");
      return true;
    }
    this.pushUndo();
    for (const c of COLS) {
      const card = this.pile("stock").pop();
      card.up = true;
      this.pile(c).push(card);
    }
    this.moves++;
    this.score--;
    this.playing = true;
    COLS.forEach((c) => this.tidy(c));
    return true;
  }

  isWon() {
    return this.pile("done").length === 8;
  }

  winText() {
    return `You won! Score ${this.score} in ${this.moves} moves. Play again?`;
  }

  hint() {
    // Prefer moving the longest run onto a card one higher; then onto an empty column.
    for (const empty of [false, true])
      for (const a of COLS) {
        const p = this.pile(a);
        for (let i = 0; i < p.length; i++) {
          if (!this.runFrom(a, i)) continue;
          for (const b of COLS) {
            if (a === b) continue;
            const t = this.top(b);
            if (empty ? !t && i > 0 : t && t.r === p[i].r + 1 && !(i > 0 && p[i - 1].up && p[i - 1].r === t.r)) {
              this.flash = { from: a, i, to: b, until: Date.now() + 1200 };
              return;
            }
          }
          break;
        }
      }
    this.say(this.pile("stock").length ? "There are no more moves available. Deal a new row from the deck." : "There are no more moves available.");
  }

  extras() {
    return [
      v_flex()
        .absolute()
        .bottom(14)
        .left(Math.max(130, this.W / 2 - 80))
        .w(160)
        .p(8)
        .rounded(4)
        .border_1()
        .border_color("#003300")
        .bg("#006400")
        .items_center()
        .text_size(11)
        .text_color("#ffffff")
        .child(div().child(`Score: ${this.score}`))
        .child(div().child(`Moves: ${this.moves}`)),
    ];
  }

  status() {
    return [`Score: ${this.score}`, `Moves: ${this.moves}`];
  }

  gameMenu() {
    const lv = (n, label) => ({ label, radio: this.suits === n, act: this.cmd("suits", { n }) });
    return [
      { label: "Deal New Row", disabled: !this.pile("stock").length, act: this.cmd("deal") },
      { label: "Show an Available Move", shortcut: "H", act: this.cmd("hint") },
      { sep: true },
      { label: "Difficulty", sub: [lv(1, "Easy: One Suit"), lv(2, "Medium: Two Suits"), lv(4, "Difficult: Four Suits")] },
    ];
  }

  onCommand(c) {
    if (c.cmd === "deal") this.clickPile("stock");
    if (c.cmd === "hint") this.hint();
    if (c.cmd === "suits" && SUITS_FOR[c.n]) {
      this.suits = c.n;
      setShared("winxp.spider.suits", c.n);
      this.newGame();
    }
  }

  onKey(k) {
    if (k === "h") this.hint();
    if (k === "d") this.clickPile("stock");
  }
}
