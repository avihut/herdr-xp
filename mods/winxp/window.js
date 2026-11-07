// A pane's title bar (the layout's pane header): Luna blue on the focused
// pane, faded on the others. Minimize settles the tab to the taskbar,
// Maximize zooms the pane, Close closes it; a double-click maximizes. The
// icon and a right-click open the window menu. Drag the bar to move the
// window onto another one in the tab (panedrag.js); the window menu's Move
// moves it one place left, right, up or down.

import { panes, props, run } from "herdr";
import { div, pal, titleBar, programIcon, pic, paneTitle, statusColor, openMenu, own } from "./kit.js";
import { noteTitleBar, liftWindow } from "./panedrag.js";

const SLOP = 4; // px the pointer moves before a press on the bar becomes a drag

export default class PaneWindow {
  init() {
    this.press = null;
  }

  menu(e, p, movable) {
    const id = p?.pane;
    const zoomed = Boolean(p?.zoomed);
    const move = (dir, label) => ({ label, act: { runs: [["pane.focus", { pane: id }], ["pane.swap", { direction: dir }]] } });
    openMenu(
      [
        { label: "Restore", disabled: !zoomed, act: { run: ["pane.zoom", { pane: id }] } },
        movable ? { label: "Move", sub: [move("left", "Left"), move("right", "Right"), move("up", "Up"), move("down", "Down")] } : { label: "Move", disabled: true },
        { label: "Size", disabled: true },
        { label: "Minimize", act: { run: ["tab.settle", { id: p?.tab }] } },
        { label: "Maximize", disabled: zoomed, act: { run: ["pane.zoom", { pane: id }] } },
        { sep: true },
        { label: "Split Right", act: { run: ["pane.split", { direction: "right", pane: id }] } },
        { label: "Split Down", act: { run: ["pane.split", { direction: "down", pane: id }] } },
        { sep: true },
        { label: "Close", bold: true, shortcut: "Alt+F4", act: { run: ["pane.close", { pane: id }] } },
      ],
      e?.position ? { x: e.position.x, y: e.position.y } : undefined,
    );
  }

  lift(p) {
    const press = this.press;
    this.press = null;
    if (press && p) liftWindow(p, press, paneTitle(p));
  }

  render(_cx) {
    const P = pal();
    const id = props()?.pane;
    const all = panes();
    const p = all.find((x) => x.pane === id);
    const active = Boolean(p?.focused);
    const zoomed = Boolean(p?.zoomed);
    // Herdr's grip is off in this layout, so the bar decides: a split, unzoomed tab.
    const movable = Boolean(p) && !zoomed && all.filter((x) => x.tab === p.tab).length > 1;
    const icon = own(
      div()
        .id(`wicon-${id}`)
        .flex_none()
        .child(p?.mod ? pic("folder", 16) : programIcon(p?.program, 16))
        .on_click((e) => this.menu(e, p, movable)),
    );
    const badge = p?.status && p.status !== "idle" ? div().flex_none().w(8).h(8).mr(2).rounded(4).border_1().border_color("#ffffff").bg(statusColor(p.status)) : null;
    return div()
      .id(`pwin-${id}`)
      .size_full()
      // Every press anywhere tells this bar where it is; a drag needs every window's place.
      .on_mouse_down_out((e) => noteTitleBar(id, e))
      .on_mouse_down("left", (e) => {
        noteTitleBar(id, e);
        // XP activates a window on the press, not the click.
        if (!active) run("pane.focus", { pane: id });
        this.press = movable && (e?.click_count ?? 1) < 2 && e?.position ? { x: e.position.x, y: e.position.y } : null;
      })
      .on_mouse_move((e) => {
        if (this.press && e?.position && Math.hypot(e.position.x - this.press.x, e.position.y - this.press.y) > SLOP) this.lift(p);
      })
      .on_mouse_up("left", () => {
        this.press = null;
      })
      // Held and gone off the bar before moving far: it's a drag (the layer catches the release).
      .on_hover((over) => {
        if (!over && this.press) this.lift(p);
      })
      .child(
        titleBar(P, {
          id: `pw-${id}`,
          h: 30,
          active,
          icon,
          title: paneTitle(p),
          extra: badge,
          caps: [
            ["ctl-min", () => run("tab.settle", { id: p?.tab })],
            [zoomed ? "ctl-restore" : "ctl-max", () => run("pane.zoom", { pane: id })],
            ["ctl-close", () => run("pane.close", { pane: id })],
          ],
          onClick: () => run("pane.focus", { pane: id }),
          onDouble: () => run("pane.zoom", { pane: id }),
          onRight: (e) => this.menu(e, p, movable),
        }),
      );
  }
}
