// Playing cards for Solitaire and Spider: drawn here (white faces with real
// pip layouts, simple court cards, a blue back), plus deck helpers.

import { div, image } from "gpui-kit";
import { ASSETS } from "./kit.js";

export const CW = 71;
export const CH = 96;
export const SUITS = ["♠", "♥", "♦", "♣"];
export const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const red = (s) => s === 1 || s === 2;
const INK = (s) => (red(s) ? "#d40000" : "#000000");
const CARD_FONT = "Arial";

// Pip spots on a 3-column grid: [column 0..2, row 0..1 as a share of the pip area, upside down].
const PIPS = {
  2: [[1, 0], [1, 1, 1]],
  3: [[1, 0], [1, 0.5], [1, 1, 1]],
  4: [[0, 0], [2, 0], [0, 1, 1], [2, 1, 1]],
  5: [[0, 0], [2, 0], [1, 0.5], [0, 1, 1], [2, 1, 1]],
  6: [[0, 0], [2, 0], [0, 0.5], [2, 0.5], [0, 1, 1], [2, 1, 1]],
  7: [[0, 0], [2, 0], [1, 0.25], [0, 0.5], [2, 0.5], [0, 1, 1], [2, 1, 1]],
  8: [[0, 0], [2, 0], [1, 0.25], [0, 0.5], [2, 0.5], [1, 0.75, 1], [0, 1, 1], [2, 1, 1]],
  9: [[0, 0], [2, 0], [0, 1 / 3], [2, 1 / 3], [1, 0.5], [0, 2 / 3, 1], [2, 2 / 3, 1], [0, 1, 1], [2, 1, 1]],
  10: [[0, 0], [2, 0], [1, 1 / 6], [0, 1 / 3], [2, 1 / 3], [0, 2 / 3, 1], [2, 2 / 3, 1], [1, 5 / 6, 1], [0, 1, 1], [2, 1, 1]],
};

export function deck(suits = [0, 1, 2, 3], copies = 1) {
  const out = [];
  for (let k = 0; k < copies; k++) for (const s of suits) for (let r = 1; r <= 13; r++) out.push({ s, r, up: false });
  return out;
}

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function corner(c, flip) {
  const el = div()
    .absolute()
    .w(14)
    .flex()
    .flex_col()
    .items_center()
    .font_family(CARD_FONT)
    .text_color(INK(c.s))
    .child(div().text_size(c.r === 10 ? 11 : 13).font_weight(700).line_height("13px").child(RANKS[c.r]))
    .child(div().text_size(11).line_height("11px").child(SUITS[c.s]));
  return flip ? el.bottom(3).right(2) : el.top(3).left(2);
}

function pips(c) {
  const spots = PIPS[c.r] ?? [];
  const x0 = 17, x1 = CW - 17, y0 = 14, y1 = CH - 14;
  return spots.map(([col, row, down]) =>
    div()
      .absolute()
      .left(x0 + ((x1 - x0) / 2) * col - 7)
      .top(y0 + (y1 - y0) * row - 9)
      .w(14)
      .h(18)
      .flex()
      .items_center()
      .justify_center()
      .font_family(CARD_FONT)
      .text_size(17)
      .text_color(INK(c.s))
      .opacity(down ? 0.92 : 1)
      .child(SUITS[c.s]),
  );
}

function center(c) {
  if (c.r === 1) return [div().absolute().top(0).left(0).size_full().flex().items_center().justify_center().font_family(CARD_FONT).text_size(c.s === 0 ? 40 : 32).text_color(INK(c.s)).child(SUITS[c.s])];
  if (c.r <= 10) return pips(c);
  // Court cards: a framed panel with the rank and its suit.
  return [
    div()
      .absolute()
      .top(14)
      .left(13)
      .w(CW - 26)
      .h(CH - 28)
      .rounded(2)
      .border_1()
      .border_color(red(c.s) ? "#d40000" : "#1f3d8a")
      .bg(red(c.s) ? "#fff1d6" : "#e6eeff")
      .flex()
      .flex_col()
      .items_center()
      .justify_center()
      .child(div().font_family("Trebuchet MS").font_weight(700).text_size(26).text_color(red(c.s) ? "#b00000" : "#1f3d8a").child(RANKS[c.r]))
      .child(div().font_family(CARD_FONT).text_size(18).text_color(INK(c.s)).child(SUITS[c.s])),
  ];
}

/** A card face up, face down, or an empty slot ({ slot: true }). o: { selected } */
export function card(c, o = {}) {
  if (!c || c.slot) {
    return div().w(CW).h(CH).flex_none().rounded(4).border_1().border_color("#004d00").bg("#00000014").when(Boolean(o.label), (el) => el.flex().items_center().justify_center().text_size(26).text_color("#00000040").child(o.label));
  }
  if (!c.up) return image(`${ASSETS}/card-back.svg`).w(CW).h(CH).flex_none().rounded(4);
  return div()
    .relative()
    .w(CW)
    .h(CH)
    .flex_none()
    .rounded(4)
    .border_1()
    .border_color("#000000")
    .bg("#ffffff")
    .overflow_hidden()
    .child(corner(c, false))
    .child(corner(c, true))
    .children(center(c))
    .when(Boolean(o.selected), (el) => el.child(div().absolute().top(0).left(0).size_full().bg("#0a246a").opacity(0.45)));
}
