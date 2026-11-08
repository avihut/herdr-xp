// The Changes bar (the changes role): the Git changes in the focused pane's folder, in XP's
// Details view (Name, In Folder, Changes), the picked file's diff below it, and a commit box.
// It follows the focused pane and refreshes when the repository changes (repo.js reads Git).

import { watchFolder, settings } from "herdr";
import { InputState, Input, Scrollbar, v_virtual_list } from "gpui-base";
import { div, h_flex, v_flex, pal, pic, grad, uiFont, button } from "./kit.js";
import { where, readChanges, fileDiff, diffRows, commitAll } from "./repo.js";

const ROW = 18;
const LINE = 16;
const BADGE = { A: ["#2a9d2a", "Added"], M: ["#d07a00", "Modified"], D: ["#d0281e", "Deleted"], U: ["#d0281e", "Conflict"] };

export default class Changes {
  init(_p, cx) {
    this.files = [];
    this.lines = [];
    this.rows = [];
    this.width = 0;
    this.message = "";
    this.input = InputState.new({ placeholder: "Describe the change" });
    this.input.on("change", (_e, cx) => {
      const had = Boolean(this.message.trim());
      this.message = this.input.value();
      if (had !== Boolean(this.message.trim())) cx.notify();
    });
    this.input.on("submit", (_e, cx) => this.commit(cx));
    this.refresh(cx);
    cx.timer.every(10000, (cx) => this.refresh(cx));
  }

  watch(root, cx) {
    if (this.state?.on || this.watched === root) return;
    this.watched = root;
    cx.spawn(async (cx) => {
      try {
        while (this.watched === root) {
          await watchFolder(root);
          if (this.watched === root) this.refresh(cx);
        }
      } catch {
        this.watched = null;
      }
    });
  }

  setLines(lines) {
    this.rows = diffRows(lines);
    this.width = Math.max(300, ...lines.map((l) => l.length * 7 + 60));
  }

  refresh(cx) {
    if (this.loading || this.busy) return;
    const here = where();
    if (here.key !== this.key) {
      this.key = here.key;
      this.state = null;
      this.files = [];
      this.pick = null;
      this.closed = false;
      this.setLines([]);
      this.error = null;
      this.note = null;
      this.watched = null;
    }
    if (!here.cwd) return;
    this.loading = true;
    cx.spawn(async (cx) => {
      try {
        const state = await readChanges(here.cwd, here.on);
        if (where().key !== here.key) return;
        this.state = state.root ? state : null;
        this.files = state.files;
        this.limited = state.limited;
        this.error = state.error ?? null;
        if (!state.root) return this.setLines([]);
        this.watch(state.root, cx);
        if (this.pick && !this.files.some((f) => f.path === this.pick)) {
          this.pick = null;
          this.setLines([]);
        }
        if (!this.pick && !this.closed && this.files.length) this.pick = this.files[0].path; // the first file's diff shows
        if (this.pick) await this.load(this.pick, here.key);
      } catch (e) {
        if (where().key === here.key) this.error = String(e?.message ?? e);
      } finally {
        this.loading = false;
        cx.notify();
      }
    });
  }

  async load(path, key) {
    const file = this.files.find((f) => f.path === path);
    if (!file || !this.state) return;
    try {
      const lines = await fileDiff(this.state, file);
      if (this.key === key && this.pick === path) this.setLines(lines);
    } catch (e) {
      if (this.key === key && this.pick === path) this.setLines([`This diff can't be shown: ${e?.message ?? e}`]);
    }
  }

  choose(path, cx) {
    this.pick = this.pick === path ? null : path;
    this.closed = !this.pick;
    this.setLines([]);
    const key = this.key;
    if (this.pick)
      cx.spawn(async (cx) => {
        await this.load(path, key);
        cx.notify();
      });
    cx.notify();
  }

  commit(cx) {
    const message = this.message.trim();
    if (!message || !this.state || this.busy || this.loading) return;
    const { root, on } = this.state;
    this.busy = true;
    this.note = null;
    cx.spawn(async (cx) => {
      try {
        await commitAll(root, on, message);
        this.message = "";
        this.input.set_value("");
      } catch (e) {
        this.note = `The commit didn't go through: ${e?.message ?? e}`;
      } finally {
        this.busy = false;
        this.refresh(cx);
        cx.notify();
      }
    });
    cx.notify();
  }

  // ---- drawing

  /** A Details view column header: XP's light gradient with a divider on its right. */
  head(P, label, o = {}) {
    let el = div().relative().h_full().flex().items_center().px(5).border_r_1().border_color(P.dark ? "#4a4d55" : "#c7c5b2").child(grad(P.dark ? "#3a3d44" : "#ffffff", P.dark ? "#2f3237" : "#ebeadb", 180)).child(div().relative().truncate().child(label));
    el = o.w ? el.w(o.w).flex_none() : el.flex_1().min_w(0);
    return o.right ? el.justify_end() : el;
  }

  fileRow(P, f) {
    const on = this.pick === f.path;
    const parts = f.path.split("/");
    const name = parts.pop();
    const [color, word] = BADGE[f.status] ?? BADGE.M;
    return h_flex()
      .id(`ch-${f.path}`)
      .flex_none()
      .h(ROW)
      .items_center()
      .when(on, (el) => el.bg(P.menuHover).text_color(P.menuHoverText))
      .tooltip(`${word}: ${f.path}`)
      .child(
        h_flex()
          .flex_1()
          .min_w(0)
          .px(4)
          .gap(4)
          .items_center()
          .child(div().flex_none().w(12).h(12).rounded(2).bg(color).flex().items_center().justify_center().text_size(9).font_weight(700).text_color("#ffffff").child(f.status))
          .child(pic("doc", 14))
          .child(div().truncate().child(name)),
      )
      .child(div().w(110).flex_none().px(5).truncate().when(!on, (el) => el.text_color(P.faceDim)).child(parts.join("/") || "."))
      .child(
        h_flex()
          .w(70)
          .flex_none()
          .px(5)
          .gap(4)
          .justify_end()
          .when(f.binary, (el) => el.child(div().text_color(on ? P.menuHoverText : P.faceDim).child("binary")))
          .when(!f.binary && f.add > 0, (el) => el.child(div().text_color(on ? P.menuHoverText : "#2a9d2a").child(`+${f.add}`)))
          .when(!f.binary && f.del > 0, (el) => el.child(div().text_color(on ? P.menuHoverText : "#d0281e").child(`−${f.del}`))),
      )
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => this.choose(f.path, cx));
  }

  diffRow(P, { kind, number, text }) {
    if (kind === "@") return div().w_full().h(LINE).flex_none().px(6).truncate().bg(P.face).text_color(P.faceDim).child(text);
    const add = P.dark ? "#1f3b22" : "#dcf5dc";
    const del = P.dark ? "#3e2022" : "#fbdcdc";
    return h_flex()
      .w_full()
      .h(LINE)
      .flex_none()
      .gap(8)
      .when(kind === "+", (el) => el.bg(add))
      .when(kind === "-", (el) => el.bg(del))
      .child(div().w(34).flex_none().text_right().text_color(P.faceDim).child(number === undefined ? "" : String(number)))
      .child(div().w(8).flex_none().text_color(kind === "+" ? "#2a9d2a" : kind === "-" ? "#d0281e" : P.faceDim).child(kind === "+" || kind === "-" ? kind : ""))
      .child(div().flex_1().min_w(0).whitespace_nowrap().child(text));
  }

  render(cx) {
    if (where().key !== this.key) this.refresh(cx);
    const P = pal();
    const add = this.files.reduce((n, f) => n + f.add, 0);
    const del = this.files.reduce((n, f) => n + f.del, 0);
    const ink = P.dark ? P.faceText : "#000000";
    const can = Boolean(this.message.trim() && this.state && !this.busy && !this.loading);
    const empty = this.error || (this.loading && !this.files.length ? "Looking for changes…" : this.state ? "No changes since the last commit." : "No folder: focus a window to see its changes.");
    return v_flex()
      .id("xp-changes")
      .size_full()
      .min_h(0)
      .font_family(uiFont())
      .text_size(11)
      .bg(P.list)
      .text_color(ink)
      // Summary, like Explorer's status bar.
      .child(
        h_flex()
          .flex_none()
          .h(22)
          .px(6)
          .gap(6)
          .items_center()
          .bg(P.face)
          .border_b_1()
          .border_color(P.popupBorder)
          .child(div().child(`${this.files.length} file${this.files.length === 1 ? "" : "s"} changed`))
          .child(div().flex_1())
          .child(div().text_color("#2a9d2a").child(`+${add}`))
          .child(div().text_color("#d0281e").child(`−${del}`)),
      )
      // Details view: headers, then the files.
      .child(h_flex().flex_none().h(20).border_b_1().border_color(P.dark ? "#4a4d55" : "#c7c5b2").child(this.head(P, "Name")).child(this.head(P, "In Folder", { w: 110 })).child(this.head(P, "Changes", { w: 70, right: true })))
      .child(
        v_flex()
          .id("ch-list")
          .flex_none()
          .h(Math.min(200, Math.max(ROW * 2, this.files.length * ROW + 4)))
          .overflow_y_scroll()
          .children(this.files.map((f) => this.fileRow(P, f)))
          .when(!this.files.length, (el) => el.child(div().px(8).py(4).text_color(P.faceDim).child(empty))),
      )
      .when(this.limited, (el) => el.child(div().flex_none().px(6).py(2).text_size(10).text_color(P.faceDim).child("Showing the first 1,000 changed files.")))
      // The diff.
      .child(
        div()
          .flex_1()
          .min_h(0)
          .relative()
          .border_t_1()
          .border_color(P.popupBorder)
          .font_family(settings().font_family ?? "Lucida Console")
          .text_size(11)
          .child(div().id("ch-diff-x").size_full().overflow_x_scroll().child(div().w_full().min_w(this.width).h_full().child(v_virtual_list("ch-diff", this.rows.length, LINE, (i) => String(i), (range) => this.rows.slice(range.start, range.end).map((r) => this.diffRow(P, r))).size_full())))
          .child(Scrollbar.vertical("ch-diff").viewport_from_layout().absolute().inset_0())
          .when(!this.pick && this.files.length > 0, (el) => el.child(div().absolute().top(6).left(8).font_family(uiFont()).text_color(P.faceDim).child("Click a file to see its changes."))),
      )
      .when(Boolean(this.note), (el) => el.child(div().flex_none().px(6).py(3).text_color("#d0281e").child(this.note)))
      // Commit: an XP text box and button.
      .child(
        h_flex()
          .flex_none()
          .p(6)
          .gap(6)
          .items_center()
          .bg(P.face)
          .border_t_1()
          .border_color(P.popupBorder)
          .child(div().id("ch-message").flex_1().min_w(0).h(21).px(3).flex().items_center().bg(P.field).border_1().border_color(P.fieldBorder).text_color(ink).on_mouse_down("left", (_e, cx) => cx.stop_propagation()).child(Input.new(this.input).w_full()))
          .child(button(P, "ch-commit", this.busy ? "Committing…" : "Commit", can ? (_e, cx) => this.commit(cx) : null, { disabled: !can })),
      );
  }
}
