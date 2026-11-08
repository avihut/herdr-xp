// The Explorer bar's header (the panelbar role): Herdr's Files and Changes mods sit docked on
// the right in the layout's "panel" column, and this strip on top names them in the Explorer
// task pane's look. Click Folders or Changes to switch, × to close. Quick Launch and
// Accessories open it too (togglePanel in kit.js).

import { run } from "herdr";
import { div, h_flex, pal, grad, pic, uiFont, panelShown, togglePanel } from "./kit.js";

const BARS = [
  ["files", "folders", "Folders"],
  ["changes", "changes", "Changes"],
];

export default class PanelBar {
  init() {}

  tab(P, [id, icon, label], on) {
    return h_flex()
      .id(`pb-${id}`)
      .flex_none()
      .h(20)
      .px(6)
      .gap(4)
      .items_center()
      .rounded(3)
      .text_size(11)
      .text_color(P.paneBoxText)
      .when(on, (el) => el.font_weight(700).bg("#ffffff59").border_1().border_color(P.popupBorder))
      .when(!on, (el) => el.hover((s) => s.underline()))
      .child(pic(icon, 16))
      .child(div().child(label))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click(() => !on && run("layout.select", { stack: "panel-body", child: id }));
  }

  render(_cx) {
    const P = pal();
    const shown = panelShown() ?? "files";
    return div()
      .id("xp-panelbar")
      .relative()
      .size_full()
      .font_family(uiFont())
      .border_b_1()
      .border_color(P.popupBorder)
      .child(grad(P.paneBoxHead[0], P.paneBoxHead[1], 90))
      .child(
        h_flex()
          .relative()
          .size_full()
          .px(4)
          .gap(2)
          .items_center()
          .children(BARS.map((b) => this.tab(P, b, b[0] === shown)))
          .child(div().flex_1())
          .child(
            div()
              .id("pb-close")
              .flex_none()
              .tooltip("Close")
              .child(pic("ctl-close", 16))
              .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
              .on_click(() => togglePanel(shown)),
          ),
      );
  }
}
