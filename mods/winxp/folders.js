// The Folders bar (the folders role): the focused pane's folder as XP's Explorer tree, in the
// Explorer bar on the right. Folders open with the [+]/[-] box or a click on their name; a file
// opens a read-only preview with a Back button. Git's changes mark files (A, M, D, U). It follows
// the focused pane and refreshes when the folder changes (repo.js reads it).

import { watchFolder, readTextFile, theme, settings } from "herdr";
import { Editor, EditorState } from "gpui-base";
import { div, h_flex, v_flex, pal, pic, uiFont } from "./kit.js";
import { where, listFolder, gitMarks, PER_FOLDER } from "./repo.js";

const ROW = 18;
const INDENT = 19;
const TOTAL = 5000;
const LANG = { ts: "js", tsx: "js", mts: "js", cts: "js", jsx: "js", mjs: "js", toml: "yaml", jsonc: "json", svelte: "html", vue: "html" };
const MARK = { A: "#2a9d2a", M: "#d07a00", D: "#d0281e", U: "#d0281e" };

export default class Folders {
  init(_p, cx) {
    this.saved = new Map(); // what was open, per folder
    this.reset(null);
    this.refresh(cx);
    cx.timer.every(10000, (cx) => this.refresh(cx));
  }

  reset(here) {
    this.here = here;
    this.entries = new Map(); // "" = the root, else a relative path
    this.open = new Set();
    this.marks = {};
    this.sel = null;
    this.error = null;
    this.limited = false;
    this.loading = false;
    this.watched = null;
    this.closePreview();
  }

  current(here) {
    return this.here === here && where().key === here.key;
  }

  watch(here, cx) {
    if (here.on || this.watched === here.cwd) return;
    this.watched = here.cwd;
    cx.spawn(async (cx) => {
      try {
        while (this.current(here)) {
          await watchFolder(here.cwd);
          if (this.current(here)) this.refresh(cx);
        }
      } catch {
        if (this.here === here) this.watched = null;
      }
    });
  }

  async load(path, here) {
    const list = await listFolder(path ? `${here.cwd}/${path}` : here.cwd, here.on);
    if (!this.current(here) || (path && !this.open.has(path))) return;
    const used = [...this.entries].filter(([p]) => p !== path).reduce((n, [, e]) => n + e.length, 0);
    this.entries.set(path, list.slice(0, Math.max(0, Math.min(PER_FOLDER, TOTAL - used))));
    if (list.length > PER_FOLDER || used + list.length > TOTAL) this.limited = true;
  }

  refresh(cx) {
    const now = where();
    if (now.key !== this.here?.key) {
      if (this.here) this.saved.set(this.here.key, { open: this.open, file: this.file });
      const saved = this.saved.get(now.key);
      this.reset(now);
      if (saved) this.open = new Set(saved.open);
      if (saved?.file) this.preview(saved.file, cx);
    }
    if (!now.cwd || this.loading) return;
    const here = this.here;
    this.loading = true;
    this.limited = false;
    cx.spawn(async (cx) => {
      try {
        for (const path of ["", ...this.open]) {
          if (!this.current(here)) return;
          await this.load(path, here).catch((e) => {
            if (!path) throw e;
            this.open.delete(path); // a folder that went away
          });
        }
        const marks = await gitMarks(here.cwd, here.on);
        if (!this.current(here)) return;
        this.marks = marks;
        this.error = null;
        this.watch(here, cx);
      } catch (e) {
        if (this.current(here)) this.error = String(e?.message ?? e);
      } finally {
        if (this.here === here) this.loading = false;
        cx.notify();
      }
    });
  }

  toggle(path, cx) {
    if (this.open.has(path)) {
      for (const p of [...this.open]) if (p === path || p.startsWith(`${path}/`)) this.open.delete(p);
    } else {
      this.open.add(path);
      const here = this.here;
      if (!this.entries.has(path))
        cx.spawn(async (cx) => {
          try {
            await this.load(path, here);
          } catch (e) {
            if (this.current(here)) this.error = String(e?.message ?? e);
          } finally {
            cx.notify();
          }
        });
    }
    cx.notify();
  }

  closePreview() {
    this.code?.release?.();
    this.code = null;
    this.file = null;
    this.fileError = null;
  }

  preview(path, cx) {
    this.closePreview();
    this.file = path;
    const here = this.here;
    cx.spawn(async (cx) => {
      try {
        const text = await readTextFile(`${here.cwd}/${path}`, { on: here.on });
        if (this.file !== path || !this.current(here)) return;
        if (text === null) this.fileError = "This file is no longer there.";
        else if (text.includes("\0")) this.fileError = "This is a binary file; there is no text to show.";
        else {
          const t = theme();
          const ext = path.includes(".") ? path.split(".").pop() : "txt";
          this.code = EditorState.new({
            language: LANG[ext] ?? ext,
            readonly: true,
            value: text.length > 400000 ? `${text.slice(0, 400000)}\n… (the rest of the file is not shown)` : text,
            font_family: settings().font_family,
            font_size: 12,
            syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6 },
          });
        }
      } catch {
        if (this.file === path) this.fileError = "This file can't be shown (binary, too large or unreadable).";
      } finally {
        cx.notify();
      }
    });
    cx.notify();
  }

  /** XP's tree box: [+] closed, [-] open. */
  box(P, open) {
    return div()
      .relative()
      .w(9)
      .h(9)
      .flex_none()
      .bg(P.dark ? "#2a2c31" : "#ffffff")
      .border_1()
      .border_color(P.dark ? "#7a8296" : "#919b9c")
      .child(div().absolute().left(1).top(3).w(5).h(1).bg(P.faceText))
      .when(!open, (el) => el.child(div().absolute().left(3).top(1).w(1).h(5).bg(P.faceText)));
  }

  /** One row of the tree: the guide lines for each level above it, then box, icon and name. */
  row(P, { path, name, dir, depth, last, guides }) {
    const open = dir && this.open.has(path);
    const on = this.sel === path;
    const line = P.dark ? "#5a6070" : "#a0a0a0";
    const mark = this.marks[`${this.here.cwd}/${path}`];
    const lead = [];
    for (let d = 0; d < depth; d++) lead.push(div().relative().w(INDENT).h(ROW).flex_none().when(guides[d], (el) => el.child(div().absolute().left(9).top(0).w(1).h(ROW).bg(line))));
    return h_flex()
      .id(`fd-${path}`)
      .flex_none()
      .h(ROW)
      .pl(4)
      .items_center()
      .children(lead)
      .child(
        // This level's elbow: down from above, across to the icon, and on down unless it's the last.
        div()
          .relative()
          .w(INDENT)
          .h(ROW)
          .flex_none()
          .child(div().absolute().left(9).top(0).w(1).h(last ? ROW / 2 : ROW).bg(line))
          .child(div().absolute().left(9).top(ROW / 2).w(9).h(1).bg(line))
          .when(dir, (el) =>
            el.child(
              div()
                .id(`fb-${path}`)
                .absolute()
                .left(5)
                .top(5)
                .child(this.box(P, open))
                .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
                .on_click((_e, cx) => this.toggle(path, cx)),
            ),
          ),
      )
      .child(pic(dir ? (open ? "folder-open" : "folder") : "doc", 16))
      .child(
        h_flex()
          .ml(3)
          .px(2)
          .h(16)
          .min_w(0)
          .items_center()
          .gap(4)
          .when(on, (el) => el.bg(P.menuHover).text_color(P.menuHoverText))
          .child(div().truncate().child(name))
          .when(Boolean(mark), (el) => el.child(div().flex_none().text_size(10).font_weight(700).text_color(on ? P.menuHoverText : MARK[mark]).child(mark))),
      )
      .on_mouse_down("left", (_e, cx) => {
        cx.stop_propagation();
        this.sel = path;
        cx.notify();
      })
      .on_click((_e, cx) => (dir ? this.toggle(path, cx) : this.preview(path, cx)));
  }

  rows(prefix, depth, guides, out) {
    const list = this.entries.get(prefix) ?? [];
    list.forEach((e, i) => {
      if (out.length >= TOTAL) return;
      const path = prefix ? `${prefix}/${e.name}` : e.name;
      const last = i === list.length - 1;
      out.push({ path, name: e.name, dir: e.dir, depth, last, guides });
      if (e.dir && this.open.has(path) && depth < 40) this.rows(path, depth + 1, [...guides, !last], out);
    });
    return out;
  }

  tree(P) {
    const name = this.here?.cwd ? this.here.cwd.split(/[\\/]/).pop() || this.here.cwd : "";
    const items = this.rows("", 0, [], []).map((r) => this.row(P, r));
    const note = this.error || (!this.here?.cwd ? "No folder: focus a window to see its files." : !this.entries.get("")?.length ? (this.loading ? "Loading…" : "This folder is empty.") : null);
    return v_flex()
      .id("fd-tree")
      .flex_1()
      .min_h(0)
      .py(4)
      .overflow_y_scroll()
      .when(Boolean(name), (el) =>
        el.child(
          h_flex()
            .flex_none()
            .h(ROW)
            .pl(6)
            .gap(3)
            .items_center()
            .tooltip(this.here.cwd)
            .child(pic("folder-open", 16))
            .child(div().font_weight(700).truncate().child(name)),
        ),
      )
      .children(items)
      .when(Boolean(note), (el) => el.child(div().px(10).py(6).text_color(P.faceDim).child(note)))
      .when(this.limited, (el) => el.child(div().px(10).py(4).text_size(10).text_color(P.faceDim).child(`Showing up to ${PER_FOLDER} items per folder and ${TOTAL} in all.`)));
  }

  previewPane(P) {
    return v_flex()
      .flex_1()
      .min_h(0)
      .child(
        h_flex()
          .flex_none()
          .h(30)
          .px(4)
          .gap(6)
          .items_center()
          .bg(P.face)
          .border_b_1()
          .border_color(P.popupBorder)
          .child(
            h_flex()
              .id("fd-back")
              .flex_none()
              .h(24)
              .px(4)
              .gap(3)
              .items_center()
              .rounded(3)
              .hover((s) => s.bg(P.dark ? "#ffffff1a" : "#00000012"))
              .child(pic("back", 20))
              .child(div().text_size(11).child("Back"))
              .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
              .on_click((_e, cx) => {
                this.closePreview();
                cx.notify();
              }),
          )
          .child(h_flex().flex_1().min_w(0).h(20).px(4).gap(4).items_center().bg(P.field).border_1().border_color(P.fieldBorder).child(pic("doc", 14)).child(div().truncate().text_size(11).text_color(P.dark ? P.faceText : "#000000").child(this.file))),
      )
      .child(this.code ? Editor.new(this.code).flex_1().min_h(0) : div().p(10).text_color(P.faceDim).child(this.fileError || "Opening…"));
  }

  render(cx) {
    if (where().key !== this.here?.key) this.refresh(cx);
    const P = pal();
    return v_flex()
      .id("xp-folders")
      .size_full()
      .min_h(0)
      .font_family(uiFont())
      .text_size(11)
      .bg(P.list)
      .text_color(P.dark ? P.faceText : "#000000")
      .child(this.file ? this.previewPane(P) : this.tree(P));
  }
}
