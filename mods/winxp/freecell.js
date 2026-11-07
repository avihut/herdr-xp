// FreeCell: every card dealt face up into eight columns, Microsoft's numbered
// deals (Game #1 to #32000; the classic generator). Four free cells hold one card
// each; build the foundations up by suit and the columns down in alternating
// colors. A run moves as one when there is room for it: (free cells + 1) × 2 per
// empty column. Cards that can't be needed any more go home by themselves. The
// king between the cells looks toward the side your pointer is on.

import { shared } from "herdr";
import { div, pic } from "./kit.js";
import { CardTable } from "./cardtable.js";
import { red, CW, CH } from "./cards.js";

const COLS = Array.from({ length: 8 }, (_, i) => `t${i}`);
const CELLS = ["c0", "c1", "c2", "c3"];
const FOUND = ["f0", "f1", "f2", "f3"];
// Microsoft's deck order is clubs, diamonds, hearts, spades; cards.js uses ♠ ♥ ♦ ♣.
const MS_SUIT = [3, 2, 1, 0];

/** The deal of Microsoft FreeCell game `n`: 52 cards in dealing order. */
export function msDeal(n) {
  let seed = n;
  const rand = () => {
    seed = (seed * 214013 + 2531011) % 2147483648;
    return Math.floor(seed / 65536);
  };
  const deck = Array.from({ length: 52 }, (_, i) => i);
  const out = [];
  for (let left = 52; left > 0; left--) {
    const j = rand() % left;
    out.push(deck[j]);
    deck[j] = deck[left - 1];
  }
  return out.map((k) => ({ r: Math.floor(k / 4) + 1, s: MS_SUIT[k % 4], up: true }));
}

export default class FreeCell extends CardTable {
  init(p, cx) {
    this.key = "winxp.freecell";
    this.icon = "freecell";
    this.name = "FreeCell";
    this.dealLabel = "New Game";
    this.saveKeys = [];
    this.look = "left";
    this.number = 1 + Math.floor(Math.random() * 32000);
    super.init(p, cx);
  }

  title() {
    return `FreeCell Game #${this.number}`;
  }

  setup() {
    COLS.forEach((id) => (this.piles[id] = { cards: [] }));
    msDeal(this.number).forEach((c, i) => this.piles[COLS[i % 8]].cards.push(c));
    [...CELLS, ...FOUND].forEach((id) => (this.piles[id] = { cards: [] }));
  }

  newGame(number) {
    if (typeof number === "number") this.number = number;
    else if (this.piles) this.number = 1 + Math.floor(Math.random() * 32000);
    super.newGame();
  }

  layout(W) {
    const L = {};
    CELLS.forEach((id, i) => (L[id] = { x: 6 + i * (CW + 2), y: 8, fan: "none" }));
    FOUND.forEach((id, i) => (L[id] = { x: W - 6 - (4 - i) * (CW + 2) + 2, y: 8, fan: "none" }));
    const gap = Math.max(4, (W - 16 - 8 * CW) / 7);
    COLS.forEach((id, i) => (L[id] = { x: 8 + i * (CW + gap), y: CH + 28, fan: "down", fu: 20 }));
    return L;
  }

  hovered(p) {
    this.look = p.x < this.W / 2 ? "left" : "right";
  }

  extras() {
    return [div().absolute().top(8 + (CH - 40) / 2).left(this.W / 2 - 20).child(pic(this.won ? "king-happy" : `king-${this.look}`, 40))];
  }

  room(to) {
    const freeCells = CELLS.filter((c) => !this.pile(c).length).length;
    const emptyCols = COLS.filter((c) => c !== to && !this.pile(c).length).length;
    return (freeCells + 1) * 2 ** emptyCols;
  }

  runFrom(id, i) {
    const p = this.pile(id);
    for (let k = i + 1; k < p.length; k++) if (red(p[k].s) === red(p[k - 1].s) || p[k].r !== p[k - 1].r - 1) return false;
    return true;
  }

  canPick(id, i) {
    if (id.startsWith("f")) return false;
    const p = this.pile(id);
    if (id.startsWith("c")) return i === p.length - 1;
    return this.runFrom(id, i);
  }

  canFound(c, f) {
    const t = this.top(f);
    return t ? t.s === c.s && c.r === t.r + 1 : c.r === 1;
  }

  canDrop(cards, _from, to) {
    const c = cards[0];
    if (to.startsWith("c")) return cards.length === 1 && !this.pile(to).length;
    if (to.startsWith("f")) return cards.length === 1 && this.canFound(c, to);
    const t = this.top(to);
    if (t && !(red(t.s) !== red(c.s) && c.r === t.r - 1)) return false;
    const room = this.room(to);
    if (cards.length > room) return `That move requires moving ${cards.length} cards. You only have enough free space to move ${room} card${room === 1 ? "" : "s"}.`;
    return true;
  }

  // A card goes home by itself once no card that could still go on it is out:
  // both foundations of the other color are within one of it (Aces and Twos always).
  safeHome(c) {
    if (c.r <= 2) return true;
    const other = FOUND.map((f) => this.top(f)).filter((t) => t && red(t.s) !== red(c.s));
    return other.length === 2 && other.every((t) => t.r >= c.r - 1);
  }

  autoplay() {
    for (let moved = true; moved; ) {
      moved = false;
      for (const id of [...CELLS, ...COLS]) {
        const c = this.top(id);
        if (!c || !this.safeHome(c)) continue;
        const f = FOUND.find((f) => this.canFound(c, f));
        if (!f) continue;
        this.pile(id).pop();
        this.pile(f).push(c);
        moved = true;
      }
    }
  }

  moved() {
    this.autoplay();
  }

  autoMove(id, cx) {
    const c = this.top(id);
    if (!c || id.startsWith("f")) return false;
    const i = this.pile(id).length - 1;
    const f = FOUND.find((f) => this.canFound(c, f));
    if (f) return this.move(id, i, f, cx);
    if (id.startsWith("t")) {
      const cell = CELLS.find((x) => !this.pile(x).length);
      if (cell) return this.move(id, i, cell, cx);
    }
    return false;
  }

  isWon() {
    return FOUND.every((f) => this.pile(f).length === 13);
  }

  winText() {
    return "Congratulations, you win! Do you want to play again?";
  }

  status() {
    const left = 52 - FOUND.reduce((n, f) => n + this.pile(f).length, 0);
    return [`Cards Left: ${left}`];
  }

  gameMenu() {
    return [{ label: "Restart Game", act: this.cmd("restart") }];
  }

  onCommand(c) {
    if (c.cmd === "restart") this.newGame(this.number);
  }
}
