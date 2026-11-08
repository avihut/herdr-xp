// The desktop: icons down the left edge of the wallpaper. My Computer, the
// Recycle Bin, each space as a folder (the shown one selected), Command
// Prompt and the Games folder (its own icon, cards and a joystick, so it
// doesn't pass for a space; it opens an Explorer window of the games). One
// click opens; right-click for an icon's menu or the desktop's.
// Nested spaces show as a tree under their parent's folder, not in a window
// (not XP, but usable here): XP's [+]/[-] box beside a folder that has child
// spaces expands or collapses them, and each child is a compact indented row.
// What is collapsed is shared (workspace-tree.folded), as in every layout's
// space tree; workspace-tree.js reads the hierarchy. It also keeps
// the wallpaper in step with the theme: when the shown theme turns dark or
// light it points the layout's background at the night or the day picture
// (layout.set; Herdr caches a background by path).
// Space folders drag to reorder (space.move): a root folder among the root folders, a child space
// among its siblings. A white bar shows where it lands; letting go anywhere else does nothing.

import { run, layout, shared, spaces } from "herdr";
import { div, h_flex, v_flex, pal, pic, isDark, uiFont, openMenu, openWindow, openDialog } from "./kit.js";
import { GAMES } from "./explorer.js";
import { primaryRows, toggleSpaceChildren } from "./workspace-tree.js";
import { dropPosition } from "./taborder.js";

const SLOP = 4; // px a press moves before it is a drag, not a click
const WALL = (k) => `mods/winxp/img/wallpaper-${k}.svg`;

export default class Desktop {
  init() {
    this.asked = null;
    this.sel = null;
  }

  syncWallpaper(cx) {
    const want = WALL(isDark() ? "night" : "day");
    const L = layout();
    if (!L || typeof L !== "object" || !Array.isArray(L.children)) return;
    const bg = L.background;
    const now = bg && typeof bg === "object" ? bg.image : null;
    // Only a background that is one of ours: a clone that set its own is left alone.
    if (now === want || (now && !String(now).startsWith("mods/winxp/img/wallpaper-"))) return;
    if (this.asked === want) return;
    this.asked = want;
    cx.spawn(async () => {
      run("layout.set", { layout: { ...L, background: { image: want, fit: "cover" } } });
    });
  }

  icon(P, key, img, label, o = {}) {
    const on = o.selected ?? this.sel === key;
    return v_flex()
      .id(`desk-${key}`)
      .relative()
      .flex_none()
      .w(80)
      .items_center()
      .gap(2)
      .py(3)
      .when(Boolean(o.dragging), (el) => el.opacity(0.5))
      .when(Boolean(o.mark), (el) => el.child(this.bar(o.mark, 6, -4)))
      .child(div().opacity(on ? 0.75 : 1).child(pic(img, 34)))
      .child(
        h_flex()
          .items_start()
          .justify_center()
          .gap(3)
          .when(Boolean(o.box), (el) => el.child(div().flex_none().mt(2).child(o.box)))
          .child(
            div()
              .relative()
              .max_w(o.box ? 64 : 78)
              .px(2)
              .rounded(1)
              .when(on, (el) => el.bg(P.deskSelect))
              .when(!on, (el) => el.child(div().absolute().top(1).left(3).text_size(11).text_color(P.deskShadow).opacity(0.75).text_center().line_height("13px").max_h(26).overflow_hidden().child(label)))
              .child(div().relative().text_size(11).text_color(P.deskText).text_center().line_height("13px").max_h(26).overflow_hidden().child(label)),
          ),
      )
      .on_mouse_down("left", (e, cx) => {
        cx.stop_propagation();
        this.sel = key;
        o.onDown?.(e);
        cx.notify();
      })
      .on_mouse_move((e, cx) => (o.onMove ? o.onMove(e, cx) : this.overNothing(e, cx)))
      .when(Boolean(o.onUp), (el) => el.on_mouse_up("left", (e, cx) => o.onUp(e, cx)))
      .on_click(() => !this.justDragged() && o.open?.())
      .on_mouse_down("right", (e, cx) => {
        cx.stop_propagation();
        this.sel = key;
        if (o.menu) openMenu(o.menu(), e?.position ? { x: e.position.x, y: e.position.y } : undefined);
        cx.notify();
      });
  }

  /** The landing bar, above or below a folder. */
  bar(side, inset, off) {
    return div()
      .absolute()
      .left(inset)
      .right(inset)
      .when(side === "before", (el) => el.top(off))
      .when(side !== "before", (el) => el.bottom(off))
      .h(3)
      .rounded(1)
      .bg("#ffffff")
      .border_1()
      .border_color("#0a246a");
  }

  // ---- reordering spaces by dragging their folders
  // this.drag = { id, parent, machine, x0, y0, moved, over: { id, side } } from the press to the release.

  press(s, e) {
    this.drag = e?.position ? { id: s.id, parent: s.nesting.parentId, machine: s.machine ?? null, x0: e.position.x, y0: e.position.y, moved: false, over: null } : null;
  }

  justDragged() {
    return Boolean(this.drag?.moved) || Date.now() - (this.dragEndAt ?? 0) < 300;
  }

  /** Any move: past SLOP the press is a drag. */
  dragMove(e, cx) {
    const d = this.drag;
    if (!d || d.moved || !e?.position) return;
    if (Math.abs(e.position.x - d.x0) > SLOP || Math.abs(e.position.y - d.y0) > SLOP) {
      d.moved = true;
      cx.notify();
    }
  }

  /** A space can land beside s only among its own siblings, on the same machine. */
  sibling(s) {
    const d = this.drag;
    return Boolean(d) && s.id !== d.id && s.nesting.parentId === d.parent && (s.machine ?? null) === d.machine;
  }

  sideOf(e) {
    return e?.local_position && e?.bounds ? (e.local_position.y < e.bounds.height / 2 ? "before" : "after") : null;
  }

  /** The pointer is over space s: which half says before or after it. */
  overSpace(s, e, cx) {
    this.dragMove(e, cx);
    const d = this.drag;
    if (!d?.moved) return;
    const side = this.sibling(s) ? this.sideOf(e) : null;
    const over = side ? { id: s.id, side } : null;
    if (over?.id === d.over?.id && over?.side === d.over?.side) return;
    d.over = over;
    cx.notify();
  }

  overNothing(e, cx) {
    this.dragMove(e, cx);
    const d = this.drag;
    if (!d?.moved || !d.over) return;
    d.over = null;
    cx.notify();
  }

  /** The release over space s. Herdr delivers it to the element under the pointer wherever the
   *  press was, so this, not the moves, decides the drop. */
  upOn(s, e, cx) {
    const d = this.drag;
    if (!d) return;
    const far = e?.position ? Math.abs(e.position.x - d.x0) > SLOP || Math.abs(e.position.y - d.y0) > SLOP : false;
    if (!d.moved && !far && s.id === d.id) {
      this.drag = null; // a click: on_click opens it
      return;
    }
    cx.stop_propagation();
    d.moved = true;
    const side = this.sibling(s) ? this.sideOf(e) ?? (d.over?.id === s.id ? d.over.side : null) : null;
    d.over = side ? { id: s.id, side } : null;
    this.drop(cx);
  }

  drop(cx) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (d.moved) {
      this.dragEndAt = Date.now();
      const index = d.over ? dropPosition(spaces().map((x) => x.id), d.id, [d.over.id], d.over.side) : null;
      if (index) run("space.move", { id: d.id, index });
    }
    cx.notify();
  }

  cancelDrag(cx) {
    if (!this.drag) return;
    if (this.drag.moved) this.dragEndAt = Date.now();
    this.drag = null;
    cx.notify();
  }

  /** Where the landing bar goes on space s, if the dragged space would move there. */
  markFor(s) {
    const d = this.drag;
    if (!d?.moved || d.over?.id !== s.id) return null;
    return dropPosition(spaces().map((x) => x.id), d.id, [s.id], d.over.side) ? d.over.side : null;
  }

  /** The drag hooks a space's folder or row passes to icon() / childRow(). */
  dragHooks(s) {
    return {
      onDown: (e) => this.press(s, e),
      onMove: (e, cx) => this.overSpace(s, e, cx),
      onUp: (e, cx) => this.upOn(s, e, cx),
      mark: this.markFor(s),
      dragging: Boolean(this.drag?.moved && this.drag.id === s.id),
    };
  }

  /** XP's tree box: [+] while a space's children are hidden, [-] while they show. */
  treeBox(s) {
    const open = s.nesting.expanded;
    return div()
      .id(`tree-${s.id}`)
      .relative()
      .flex_none()
      .w(9)
      .h(9)
      .bg("#ffffff")
      .border_1()
      .border_color("#7f9db9")
      .tooltip(open ? "Collapse child spaces" : "Expand child spaces")
      .child(div().absolute().left(1).top(3).w(5).h(1).bg("#000000"))
      .when(!open, (el) => el.child(div().absolute().left(3).top(1).w(1).h(5).bg("#000000")))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => {
        cx.stop_propagation();
        toggleSpaceChildren(s);
        cx.notify();
      });
  }

  spaceMenu(s) {
    const n = s.nesting;
    return [
      { label: "Open", bold: true, act: { run: ["space.select", { id: s.id }] } },
      ...(n.childCount ? [{ label: n.expanded ? "Collapse" : "Expand", act: { shared: ["workspace-tree.folded", { ...(shared("workspace-tree.folded") ?? {}), [s.key]: n.expanded }] } }] : []),
      { label: "New Tab Here", icon: "cmd", act: { run: ["tab.new", { space: s.id }] } },
      { sep: true },
      { label: "Rename", act: { run: ["space.rename", { id: s.id }] } },
      { label: "Delete", act: { dialog: "confirm", props: { title: "Confirm Folder Delete", icon: "warning", text: `Are you sure you want to close '${s.name}' and end its terminals?`, act: { run: ["space.close", { id: s.id, confirmed: true }] } } } },
    ];
  }

  /** A child space under its parent's folder: indented by depth, a small folder and its name. */
  childRow(P, s, boxes) {
    const key = `s-${s.id}`;
    const on = this.sel === key || (this.sel === null && s.active);
    const depth = s.nesting.depth;
    const drag = this.dragHooks(s);
    return h_flex()
      .id(`desk-${key}`)
      .relative()
      .flex_none()
      .when(drag.dragging, (el) => el.opacity(0.5))
      .when(Boolean(drag.mark), (el) => el.child(this.bar(drag.mark, 2, -2)))
      .w_full()
      .py(2)
      .pl(2 + (depth - 1) * 10)
      .pr(2)
      .gap(3)
      .items_start()
      .rounded(2)
      .hover((st) => st.bg("#ffffff1f"))
      .tooltip(s.name)
      .when(boxes, (el) => el.child(div().flex_none().w(9).mt(4).when(Boolean(s.nesting.childCount), (b) => b.child(this.treeBox(s)))))
      .child(pic(s.active ? "folder-open" : "folder", 16))
      .child(
        // Up to three lines: the column is narrow.
        div()
          .relative()
          .flex_1()
          .min_w(0)
          .px(2)
          .rounded(1)
          .when(on, (el) => el.bg(P.deskSelect))
          .when(!on, (el) => el.child(div().absolute().top(1).left(3).text_size(11).text_color(P.deskShadow).opacity(0.75).line_height("13px").max_h(39).overflow_hidden().child(s.name)))
          .child(div().relative().text_size(11).text_color(P.deskText).line_height("13px").max_h(39).overflow_hidden().child(s.name)),
      )
      .on_mouse_down("left", (e, cx) => {
        cx.stop_propagation();
        this.sel = key;
        drag.onDown(e);
        cx.notify();
      })
      .on_mouse_move(drag.onMove)
      .on_mouse_up("left", drag.onUp)
      .on_click(() => !this.justDragged() && run("space.select", { id: s.id }))
      .on_mouse_down("right", (e, cx) => {
        cx.stop_propagation();
        this.sel = key;
        openMenu(this.spaceMenu(s), e?.position ? { x: e.position.x, y: e.position.y } : undefined);
        cx.notify();
      });
  }

  /** Root spaces as desktop folders; an expanded one's descendants in a panel right under it. */
  spaceItems(P, rows) {
    const out = [];
    for (let i = 0; i < rows.length; i++) {
      const s = rows[i];
      out.push(
        this.icon(P, `s-${s.id}`, s.active ? "folder-open" : "folder", s.name, {
          selected: this.sel === `s-${s.id}` || (this.sel === null && s.active),
          box: s.nesting.childCount ? this.treeBox(s) : null,
          open: () => run("space.select", { id: s.id }),
          menu: () => this.spaceMenu(s),
          ...this.dragHooks(s),
        }),
      );
      const kids = [];
      while (rows[i + 1]?.nesting.depth > 0) kids.push(rows[++i]);
      if (kids.length) {
        out.push(
          v_flex()
            .id(`desk-kids-${s.id}`)
            .flex_none()
            .w(92)
            .mt(-2)
            .p(2)
            .gap(1)
            .rounded(4)
            .bg("#0000002e")
            .border_1()
            .border_color("#ffffff33")
            .children(kids.map((k) => this.childRow(P, k, kids.some((x) => x.nesting.childCount > 0)))),
        );
      }
    }
    return out;
  }

  desktopMenu(e) {
    openMenu(
      [
        { label: "Arrange Icons By", sub: [{ label: "Name", disabled: true }, { label: "Type", disabled: true }, { label: "Modified", disabled: true }, { sep: true }, { label: "Auto Arrange", checked: true, disabled: true }, { label: "Align to Grid", checked: true, disabled: true }] },
        { label: "Refresh", act: { run: ["layout.switch", { name: "winxp" }] } },
        { sep: true },
        { label: "Paste", disabled: true },
        { label: "Paste Shortcut", disabled: true },
        { sep: true },
        { label: "New", sub: [{ label: "Space", icon: "folder", act: { run: ["space.new", {}] } }, { label: "Tab", icon: "cmd", act: { run: ["tab.new", {}] } }] },
        { sep: true },
        { label: "Properties", act: { dialog: "display" } },
      ],
      e?.position ? { x: e.position.x, y: e.position.y } : undefined,
    );
  }

  render(cx) {
    this.syncWallpaper(cx);
    const P = pal();
    const rows = primaryRows();
    return v_flex()
      .id("xp-desktop")
      .size_full()
      .font_family(uiFont())
      .items_center()
      .gap(4)
      .pt(40)
      .pb(8)
      .overflow_y_scroll()
      .on_mouse_down("left", (_e, cx) => {
        this.sel = null;
        cx.notify();
      })
      .on_mouse_move((e, cx) => this.dragMove(e, cx))
      .on_mouse_up("left", (_e, cx) => this.drop(cx)) // between folders: where the bar showed, if it did
      .on_hover((over, cx) => !over && this.cancelDrag(cx))
      .on_mouse_down("right", (e, cx) => {
        cx.stop_propagation();
        this.desktopMenu(e);
      })
      .child(this.icon(P, "computer", "computer", "My Computer", { open: () => openWindow("mycomputer"), menu: () => [{ label: "Open", bold: true, act: { open: "mycomputer" } }, { label: "Explore", act: { open: "mycomputer" } }, { sep: true }, { label: "Properties", act: { dialog: "about" } }] }))
      .child(this.icon(P, "bin", "bin", "Recycle Bin", { open: () => openWindow("bin"), menu: () => [{ label: "Open", bold: true, act: { open: "bin" } }, { label: "Empty Recycle Bin", disabled: true }, { sep: true }, { label: "Properties", disabled: true }] }))
      .children(this.spaceItems(P, rows))
      .child(this.icon(P, "cmd", "cmd", "Command Prompt", { open: () => run("tab.new", {}) }))
      .child(
        this.icon(P, "games", "games", "Games", {
          open: () => openWindow("games"),
          menu: () => [
            { label: "Open", bold: true, act: { open: "games" } },
            { sep: true },
            ...GAMES.map(([role, name]) => ({ label: name, icon: role, act: { open: role } })),
            { sep: true },
            { label: "Properties", disabled: true },
          ],
        }),
      );
  }
}
