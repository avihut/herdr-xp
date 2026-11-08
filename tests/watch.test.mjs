// The Folders and Changes bars' folder watch (mods/winxp/watch.js): one loop per folder however
// often the focus comes and goes, nothing while the bar is closed, and no home-sized trees.
// Run with `mise run test` (or `node --test tests/watch.test.mjs`).

import { test } from "node:test";
import assert from "node:assert/strict";
import { Watch, watchable } from "../mods/winxp/watch.js";

/** A watchFolder whose changes the test fires: change(path) resolves every watch waiting there. */
function fakeFolders() {
  const waiting = new Map();
  return {
    watchFolder(path) {
      return new Promise((resolve) => waiting.set(path, [...(waiting.get(path) ?? []), resolve]));
    },
    pending: (path) => waiting.get(path)?.length ?? 0,
    async change(path) {
      const all = waiting.get(path) ?? [];
      waiting.delete(path);
      all.forEach((resolve) => resolve([path]));
      for (let i = 0; i < 5; i++) await Promise.resolve(); // let the loops run up to their next wait
    },
  };
}

/** What a bar does on each refresh: begin, and spawn the loop when one comes back. */
function start(w, path, keep, onChange) {
  const loop = w.begin(path, keep, onChange);
  if (loop) loop({});
}

test("focus going away and back many times keeps one loop and one watch per folder", async () => {
  const fs = fakeFolders();
  const w = new Watch(fs.watchFolder);
  let calls = 0;
  for (let i = 0; i < 50; i++) {
    for (const path of ["/r/a", "/r/b"]) {
      w.stop(); // the focus moved: the bar resets
      start(w, path, () => true, () => calls++);
      start(w, path, () => true, () => calls++); // the 10-second timer refreshes the same folder
      await Promise.resolve();
    }
  }
  assert.equal(w.loops, 2);
  assert.equal(fs.pending("/r/a"), 1);
  assert.equal(fs.pending("/r/b"), 1);
  assert.equal(w.path, "/r/b");
  await fs.change("/r/b");
  assert.equal(calls, 1, "one refresh per change");
  assert.equal(fs.pending("/r/b"), 1, "and one watch after it");
  await fs.change("/r/a"); // a folder the bar left: its loop ends, refreshing nothing
  assert.equal(calls, 1);
  assert.equal(w.loops, 1);
  assert.equal(fs.pending("/r/a"), 0);
});

test("a closed bar's loop ends at the next change, and showing it again starts one", async () => {
  const fs = fakeFolders();
  const w = new Watch(fs.watchFolder);
  let shown = true;
  let calls = 0;
  start(w, "/r/a", () => shown, () => calls++);
  await Promise.resolve();
  shown = false;
  await fs.change("/r/a");
  assert.equal(calls, 0);
  assert.equal(w.loops, 0);
  assert.equal(w.path, null);
  shown = true;
  start(w, "/r/a", () => shown, () => calls++);
  await Promise.resolve();
  assert.equal(w.loops, 1);
  await fs.change("/r/a");
  assert.equal(calls, 1);
});

test("a bar closed and opened before the folder changed takes its waiting loop back", async () => {
  const fs = fakeFolders();
  const w = new Watch(fs.watchFolder);
  let calls = 0;
  start(w, "/r/a", () => true, () => calls++);
  await Promise.resolve();
  for (let i = 0; i < 20; i++) {
    w.stop();
    start(w, "/r/a", () => true, () => calls++);
  }
  await Promise.resolve();
  assert.equal(w.loops, 1);
  assert.equal(fs.pending("/r/a"), 1);
  await fs.change("/r/a");
  assert.equal(calls, 1);
});

test("a failed watch ends its loop, and the next refresh starts another", async () => {
  const w = new Watch(() => Promise.reject(new Error("gone")));
  start(w, "/r/a", () => true, () => {});
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(w.loops, 0);
  assert.notEqual(w.begin("/r/a", () => true, () => {}), null);
});

test("only folders inside a Git repository, and nothing home-sized, are watched", () => {
  const home = "/Users/me";
  assert.equal(watchable("/Users/me/code/app", "/Users/me/code/app", home), true);
  assert.equal(watchable("/Users/me/code/app/src", "/Users/me/code/app", home), true);
  assert.equal(watchable("/Users/me/Projects", null, home), false, "not a repository");
  assert.equal(watchable("/Users/me", "/Users/me", home), false, "home");
  assert.equal(watchable("/Users/me/", "/Users/me", home), false, "home with a slash");
  assert.equal(watchable("/Users/me/.config", "/Users/me", home), false, "a repository rooted at home");
  assert.equal(watchable("/Users", "/Users", home), false, "above home");
  assert.equal(watchable("/", "/", home), false, "the disk");
  assert.equal(watchable("/Users/meta/app", "/Users/meta/app", home), true, "a name that starts like home");
  assert.equal(watchable(null, null, home), false);
});
