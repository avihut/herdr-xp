// Where a tab dragged along the taskbar, or a space folder dragged on the desktop, lands. Pure,
// so it can be tested without Herdr (tests/taborder.test.mjs).
//   order  the space's tab ids, in order
//   id     the dragged tab
//   ids    the button it was dropped on: one tab, or a program's group of tabs
//   side   "before" or "after" that button
// Returns the position for tab.move {id, index} (from 1), or null when the tab wouldn't move.
// A group's tabs needn't sit together: before it means before its first tab, after it after its last.

export function dropPosition(order, id, ids, side) {
  const from = order.indexOf(id);
  const at = ids.map((x) => order.indexOf(x)).filter((i) => i >= 0);
  if (from < 0 || !at.length) return null;
  const gap = side === "before" ? Math.min(...at) : Math.max(...at) + 1;
  const to = gap > from ? gap - 1 : gap;
  return to === from ? null : to + 1;
}
