// Where a tab dragged along the taskbar, or a space folder dragged on the desktop, lands. Pure,
// so it can be tested without Herdr (tests/taborder.test.mjs).
//   order  the space's tab ids, in order
//   id     the dragged tab
//   ids    the button it was dropped on: one tab, or a program's group of tabs
//   side   "before" or "after" that button
// Returns the position for tab.move {id, index} (from 1), or null when the tab wouldn't move.
// A group's tabs needn't sit together: before it means before its first tab, after it after its last.

/** Would dropping space id before or after space over change the order among its siblings?
 *  siblings: those ids in the order the desktop shows them. Everything it needs is passed in:
 *  the desktop clears its drag before it drops. */
export function siblingMove(siblings, id, over, side) {
  const a = siblings.indexOf(id);
  const t = siblings.indexOf(over);
  if (a < 0 || t < 0 || a === t) return false;
  return side === "before" ? a !== t - 1 : a !== t + 1;
}

export function dropPosition(order, id, ids, side) {
  const from = order.indexOf(id);
  const at = ids.map((x) => order.indexOf(x)).filter((i) => i >= 0);
  if (from < 0 || !at.length) return null;
  const gap = side === "before" ? Math.min(...at) : Math.max(...at) + 1;
  const to = gap > from ? gap - 1 : gap;
  return to === from ? null : to + 1;
}
