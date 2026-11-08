// A bar's folder watch, kept to one loop per folder. No drawing and no imports, so it runs under
// plain Node (tests/watch.test.mjs) and another layout's mod can copy it as it is.
//   watchable(path, root, home)   whether to watch path at all (root: its Git repository, or null)
//   new Watch(watchFolder)        .begin(path, keep, onChange): the loop to pass to cx.spawn, or
//                                 null when path's loop is still waiting and takes the work back
//                                 .stop()   .path: the folder being watched   .loops: loops alive

/** watchFolder can't be cancelled, and on macOS it watches the whole tree below a folder, ignored
 *  folders included. So only a folder inside a Git repository is watched (the bars refresh on
 *  their timer elsewhere), and never home, a folder above it, or a repository rooted there. */
export function watchable(path, root, home) {
  if (!path || !root) return false;
  const tidy = (p) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
  const h = tidy(home || "/");
  const covers = (p) => {
    p = tidy(p);
    return p === "/" || p === h || h.startsWith(`${p}/`);
  };
  return !covers(path) && !covers(root);
}

export class Watch {
  constructor(watchFolder) {
    this.watchFolder = watchFolder;
    this.current = null; // the loop doing the work
    this.alive = new Map(); // path → its loop, until that loop ends
  }

  get loops() {
    return this.alive.size;
  }

  get path() {
    return this.current?.path ?? null;
  }

  /** A loop calls onChange(cx) after each change while it's the current one and keep() holds;
   *  otherwise it ends at its next change. A folder whose loop is still waiting (its watch can't
   *  be cancelled) gets that loop back instead of a second one. */
  begin(path, keep, onChange) {
    const waiting = this.alive.get(path);
    if (waiting) {
      Object.assign(waiting, { keep, onChange });
      this.current = waiting;
      return null;
    }
    const loop = { path, keep, onChange };
    this.alive.set(path, loop);
    this.current = loop;
    const mine = () => this.current === loop && loop.keep();
    return async (cx) => {
      try {
        while (mine()) {
          await this.watchFolder(path);
          if (mine()) loop.onChange(cx);
        }
      } catch {
        // The watch failed (the folder went away): the next refresh starts another.
      } finally {
        if (this.alive.get(path) === loop) this.alive.delete(path);
        if (this.current === loop) this.current = null;
      }
    };
  }

  stop() {
    this.current = null;
  }
}
