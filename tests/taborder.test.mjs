// Where a dragged tab or space folder lands (mods/winxp/taborder.js dropPosition), as the
// 1-based index for tab.move / space.move. Run with `mise run test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { dropPosition, siblingMove } from "../mods/winxp/taborder.js";

const order = ["a", "b", "c", "d", "e"];

test("before or after one item, moving down and up", () => {
  assert.equal(dropPosition(order, "a", ["c"], "before"), 2);
  assert.equal(dropPosition(order, "a", ["c"], "after"), 3);
  assert.equal(dropPosition(order, "e", ["b"], "before"), 2);
  assert.equal(dropPosition(order, "e", ["b"], "after"), 3);
  assert.equal(dropPosition(order, "b", ["e"], "after"), 5);
  assert.equal(dropPosition(order, "d", ["a"], "before"), 1);
});

test("a drop that wouldn't move it is null", () => {
  assert.equal(dropPosition(order, "b", ["c"], "before"), null);
  assert.equal(dropPosition(order, "c", ["b"], "after"), null);
  assert.equal(dropPosition(order, "c", ["c"], "before"), null);
  assert.equal(dropPosition(order, "z", ["c"], "before"), null);
  assert.equal(dropPosition(order, "c", ["z"], "before"), null);
});

test("a group: before its first item, after its last", () => {
  assert.equal(dropPosition(order, "a", ["b", "d"], "after"), 4);
  assert.equal(dropPosition(order, "e", ["b", "d"], "before"), 2);
});

test("sibling spaces with another parent's children between them keep their order", () => {
  // Roots r1, r2, r3 in spaces() order; k1 and k2 are r1's children.
  const spaces = ["r1", "k1", "k2", "r2", "r3"];
  const roots = (o) => o.filter((id) => id.startsWith("r"));
  const move = (o, id, index) => {
    const rest = o.filter((x) => x !== id);
    rest.splice(index - 1, 0, id);
    return rest;
  };
  const i = dropPosition(spaces, "r3", ["r1"], "after");
  assert.deepEqual(roots(move(spaces, "r3", i)), ["r1", "r3", "r2"]);
  const j = dropPosition(spaces, "r1", ["r3"], "after");
  assert.deepEqual(roots(move(spaces, "r1", j)), ["r2", "r3", "r1"]);
});

test("a drop moves a space among its siblings unless it would land where it is", () => {
  const sibs = ["r1", "r2", "r3"];
  assert.equal(siblingMove(sibs, "r3", "r1", "after"), true);
  assert.equal(siblingMove(sibs, "r1", "r3", "after"), true);
  assert.equal(siblingMove(sibs, "r1", "r3", "before"), true);
  assert.equal(siblingMove(sibs, "r1", "r2", "before"), false, "already right before it");
  assert.equal(siblingMove(sibs, "r2", "r1", "after"), false, "already right after it");
  assert.equal(siblingMove(sibs, "r2", "r2", "after"), false, "onto itself");
  assert.equal(siblingMove(sibs, "k1", "r2", "after"), false, "not a sibling");
});
