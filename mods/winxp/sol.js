// Solitaire (Klondike). Draw One or Draw Three (Game menu). Build the four
// foundations up from Ace by suit; build the seven columns down in alternating
// colors; only a King goes on an empty column. Standard scoring: +5 waste to
// column, +10 to a foundation, -15 back out, +5 for turning a card, -100 per
// pass through the deck in Draw One. The cards bounce when you win.

import { shared, setShared } from "herdr";
import { CardTable } from "./cardtable.js";
import { deck, shuffle, red, CW, CH } from "./cards.js";

const TAB = ["t0", "t1", "t2", "t3", "t4", "t5", "t6"];
const FOUND = ["f0", "f1", "f2", "f3"];

export default class Sol extends CardTable {
  init(p, cx) {
    this.key = "winxp.sol";
    this.icon = "sol";
    this.name = "Solitaire";
    this.celebrate = true;
    this.draw = Number(shared("winxp.sol.draw") ?? 1) === 3 ? 3 : 1;
    super.init(p, cx);
  }

  title() {
    return "Solitaire";
  }

  setup() {
    const d = shuffle(deck());
    TAB.forEach((id, i) => {
      const cards = d.splice(0, i + 1);
      cards.at(-1).up = true;
      this.piles[id] = { cards };
    });
    this.piles.stock = { cards: d };
    this.piles.waste = { cards: [] };
    FOUND.forEach((id) => (this.piles[id] = { cards: [] }));
  }

  layout(W) {
    const gap = Math.max(8, Math.min(16, (W - 20 - 7 * CW) / 6));
    const x = (i) => 10 + i * (CW + gap);
    const top = 10;
    const tab = top + CH + 18;
    const L = { stock: { x: x(0), y: top, fan: "none", label: "○", noDrop: true }, waste: { x: x(1), y: top, fan: this.draw === 3 ? "right3" : "none", hidden: true, noDrop: true } };
    FOUND.forEach((id, i) => (L[id] = { x: x(3 + i), y: top, fan: "none" }));
    TAB.forEach((id, i) => (L[id] = { x: x(i), y: tab, fan: "down", fd: 4, fu: 16 }));
    return L;
  }

  foundations() {
    return FOUND;
  }

  canPick(id, i) {
    const cards = this.pile(id);
    const c = cards[i];
    if (!c?.up || id === "stock") return false;
    if (id === "waste" || id.startsWith("f")) return i === cards.length - 1;
    return true;
  }

  canFound(c, f) {
    const t = this.top(f);
    return t ? t.s === c.s && c.r === t.r + 1 : c.r === 1;
  }

  canDrop(cards, from, to) {
    const c = cards[0];
    if (to.startsWith("f")) return cards.length === 1 && this.canFound(c, to);
    if (to.startsWith("t")) {
      const t = this.top(to);
      return t ? t.up && red(t.s) !== red(c.s) && c.r === t.r - 1 : c.r === 13;
    }
    return false;
  }

  moved(from, to) {
    if (to.startsWith("f")) this.score += from.startsWith("f") ? 0 : 10;
    else if (from === "waste") this.score += 5;
    else if (from.startsWith("f")) this.score -= 15;
    const rest = this.pile(from);
    if (from.startsWith("t") && rest.length && !rest.at(-1).up) {
      rest.at(-1).up = true;
      this.score += 5;
    }
    this.score = Math.max(0, this.score);
  }

  clickPile(id, i) {
    if (id === "stock") {
      this.pushUndo();
      this.playing = true;
      const stock = this.pile("stock");
      if (stock.length) {
        for (let k = 0; k < this.draw && stock.length; k++) {
          const c = stock.pop();
          c.up = true;
          this.pile("waste").push(c);
        }
      } else {
        this.piles.stock.cards = this.pile("waste").reverse().map((c) => ({ ...c, up: false }));
        this.piles.waste.cards = [];
        this.score = Math.max(0, this.score - (this.draw === 1 ? 100 : 20));
      }
      return true;
    }
    const cards = this.pile(id);
    if (id.startsWith("t") && i === cards.length - 1 && i >= 0 && !cards[i].up) {
      this.pushUndo();
      cards[i].up = true;
      this.score += 5;
      return true;
    }
    return false;
  }

  autoMove(id, cx) {
    const c = this.top(id);
    if (!c?.up || id.startsWith("f") || id === "stock") return false;
    const f = FOUND.find((f) => this.canFound(c, f));
    return f ? this.move(id, this.pile(id).length - 1, f, cx) : false;
  }

  isWon() {
    return FOUND.every((f) => this.pile(f).length === 13);
  }

  winText() {
    return `Game over. Score ${this.score} in ${this.time} seconds. Deal again?`;
  }

  status() {
    return [`Score: ${this.score}`, `Time: ${this.time}`];
  }

  gameMenu() {
    return [
      { sep: true },
      { label: "Draw One", radio: this.draw === 1, act: this.cmd("draw", { n: 1 }) },
      { label: "Draw Three", radio: this.draw === 3, act: this.cmd("draw", { n: 3 }) },
    ];
  }

  onCommand(c) {
    if (c.cmd === "draw" && (c.n === 1 || c.n === 3)) {
      this.draw = c.n;
      setShared("winxp.sol.draw", c.n);
      this.newGame();
    }
  }
}
