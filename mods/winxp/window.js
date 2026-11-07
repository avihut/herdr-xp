// A pane's title bar (the layout's pane header): Luna blue on the focused
// pane, faded on the others. Minimize settles the tab to the taskbar,
// Maximize zooms the pane, Close closes it; a double-click maximizes. The
// icon and a right-click open the window menu.

import { panes, props, run } from "herdr";
import { div, pal, titleBar, programIcon, pic, paneTitle, statusColor, openMenu, own } from "./kit.js";

export default class PaneWindow {
  init() {}

  menu(e, p) {
    const id = p?.pane;
    const zoomed = Boolean(p?.zoomed);
    openMenu(
      [
        { label: "Restore", disabled: !zoomed, act: { run: ["pane.zoom", { pane: id }] } },
        { label: "Move", disabled: true },
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

  render(_cx) {
    const P = pal();
    const id = props()?.pane;
    const p = panes().find((x) => x.pane === id);
    const active = Boolean(p?.focused);
    const zoomed = Boolean(p?.zoomed);
    const icon = own(
      div()
        .id(`wicon-${id}`)
        .flex_none()
        .child(p?.mod ? pic("folder", 16) : programIcon(p?.program, 16))
        .on_click((e) => this.menu(e, p)),
    );
    const badge = p?.status && p.status !== "idle" ? div().flex_none().w(8).h(8).mr(2).rounded(4).border_1().border_color("#ffffff").bg(statusColor(p.status)) : null;
    return div()
      .size_full()
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
          onRight: (e) => this.menu(e, p),
        }),
      );
  }
}
