// The desktop: icons down the left edge of the wallpaper. My Computer, the
// Recycle Bin, each space as a folder (the shown one selected), Command
// Prompt and the games. One click opens; right-click for an icon's menu or
// the desktop's. It also keeps the wallpaper in step with the theme: when the
// shown theme turns dark or light it points the layout's background at the
// night or the day picture (layout.set; Herdr caches a background by path).

import { spaces, run, layout } from "herdr";
import { div, v_flex, pal, pic, isDark, uiFont, openMenu, openWindow, openDialog } from "./kit.js";

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
      .flex_none()
      .w(80)
      .items_center()
      .gap(2)
      .py(3)
      .child(div().opacity(on ? 0.75 : 1).child(pic(img, 34)))
      .child(
        div()
          .relative()
          .max_w(78)
          .px(2)
          .rounded(1)
          .when(on, (el) => el.bg(P.deskSelect))
          .when(!on, (el) => el.child(div().absolute().top(1).left(3).text_size(11).text_color(P.deskShadow).opacity(0.75).text_center().line_height("13px").max_h(26).overflow_hidden().child(label)))
          .child(div().relative().text_size(11).text_color(P.deskText).text_center().line_height("13px").max_h(26).overflow_hidden().child(label)),
      )
      .on_mouse_down("left", (_e, cx) => {
        cx.stop_propagation();
        this.sel = key;
        cx.notify();
      })
      .on_click(() => o.open?.())
      .on_mouse_down("right", (e, cx) => {
        cx.stop_propagation();
        this.sel = key;
        if (o.menu) openMenu(o.menu(), e?.position ? { x: e.position.x, y: e.position.y } : undefined);
        cx.notify();
      });
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
    const sp = spaces();
    return v_flex()
      .id("xp-desktop")
      .size_full()
      .font_family(uiFont())
      .items_center()
      .gap(4)
      .pt(40)
      .pb(8)
      .overflow_hidden()
      .on_mouse_down("left", (_e, cx) => {
        this.sel = null;
        cx.notify();
      })
      .on_mouse_down("right", (e, cx) => {
        cx.stop_propagation();
        this.desktopMenu(e);
      })
      .child(this.icon(P, "computer", "computer", "My Computer", { open: () => openWindow("mycomputer"), menu: () => [{ label: "Open", bold: true, act: { open: "mycomputer" } }, { label: "Explore", act: { open: "mycomputer" } }, { sep: true }, { label: "Properties", act: { dialog: "about" } }] }))
      .child(this.icon(P, "bin", "bin", "Recycle Bin", { open: () => openWindow("bin"), menu: () => [{ label: "Open", bold: true, act: { open: "bin" } }, { label: "Empty Recycle Bin", disabled: true }, { sep: true }, { label: "Properties", disabled: true }] }))
      .children(
        sp.map((s) =>
          this.icon(P, `s-${s.id}`, s.active ? "folder-open" : "folder", s.name, {
            selected: this.sel === `s-${s.id}` || (this.sel === null && s.active),
            open: () => run("space.select", { id: s.id }),
            menu: () => [
              { label: "Open", bold: true, act: { run: ["space.select", { id: s.id }] } },
              { label: "New Tab Here", icon: "cmd", act: { run: ["tab.new", { space: s.id }] } },
              { sep: true },
              { label: "Rename", act: { run: ["space.rename", { id: s.id }] } },
              { label: "Delete", act: { dialog: "confirm", props: { title: "Confirm Folder Delete", icon: "warning", text: `Are you sure you want to close '${s.name}' and end its terminals?`, act: { run: ["space.close", { id: s.id, confirmed: true }] } } } },
            ],
          }),
        ),
      )
      .child(this.icon(P, "cmd", "cmd", "Command Prompt", { open: () => run("tab.new", {}) }))
      .child(this.icon(P, "mines", "mines", "Minesweeper", { open: () => openWindow("mines") }))
      .child(this.icon(P, "sol", "sol", "Solitaire", { open: () => openWindow("sol") }))
      .child(this.icon(P, "spider", "spider", "Spider Solitaire", { open: () => openWindow("spider") }));
  }
}
