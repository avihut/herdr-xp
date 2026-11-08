// An XP popup menu: props { items, parents }. White, a thin gray edge, blue
// highlight. Hovering a row with `sub` opens its submenu to the right; a
// choice closes the whole chain and acts.

import { props, closeOverlay, setShared, shared } from "herdr";
import { div, h_flex, v_flex, pal, iconOf, uiFont, glyph, perform, openMenu, closeOverlays, closeMenuTree, ROW, SEP } from "./kit.js";

const KEY = "winxp.menus";
const chain = () => shared(KEY) ?? [];

export default class Menu {
  init(_p, cx) {
    this.sub = null; // { id, index }
    this.bounds = {};
    const p = props() ?? {};
    const parents = p.parents ?? [];
    // A top menu starts the chain over; a submenu joins it.
    setShared(KEY, parents.length ? [...chain(), { id: p.overlay, parents }] : [{ id: p.overlay, parents: [] }]);
  }

  // Only bookkeeping: a press inside a submenu may close this menu first, and closing the
  // submenu from here would swallow that press. A choice closes the whole chain (closeAll).
  async close() {
    const me = props()?.overlay;
    setShared(KEY, chain().filter((m) => m.id !== me));
  }

  closeAll() {
    const all = chain().map((m) => m.id);
    const me = props()?.overlay;
    closeOverlays([...all.filter((id) => id !== me), me]);
    setShared(KEY, []);
    if (shared("winxp.start")) closeOverlay(shared("winxp.start"));
  }

  openSub(index, item) {
    if (this.sub?.index === index) return;
    if (this.sub) closeMenuTree(this.sub.id);
    this.sub = null;
    const b = this.bounds[index];
    if (!item?.sub?.length || !b) return;
    const p = props() ?? {};
    const id = openMenu(item.sub, { beside: b }, { parents: [...(p.parents ?? []), p.overlay] });
    this.sub = { id, index };
  }

  row(P, it, i) {
    if (it.sep) return div().flex_none().h(SEP).flex().items_center().px(2).child(div().w_full().h(1).bg(P.popupBorder));
    const dis = Boolean(it.disabled);
    const mark = it.radio ? "dot" : it.checked ? "check" : null;
    return h_flex()
      .id(`mi-${i}`)
      .flex_none()
      .h(ROW)
      .items_center()
      .gap(6)
      .pl(4)
      .pr(8)
      .text_color(dis ? P.popupDisabled : P.popupText)
      .when(!dis, (el) => el.hover((s) => s.bg(P.menuHover).text_color(P.menuHoverText)))
      .on_mouse_move((e, cx) => {
        if (e?.bounds) this.bounds[i] = e.bounds;
        if (!dis) this.openSub(i, it);
        cx.notify();
      })
      .child(
        div()
          .flex_none()
          .w(18)
          .flex()
          .items_center()
          .justify_center()
          .child(mark ? glyph(mark === "dot" ? "menu-dot" : "menu-check", 12) : iconOf(it.icon, 16)),
      )
      .child(div().flex_1().min_w(0).truncate().font_weight(it.bold ? 700 : 400).child(String(it.label ?? "")))
      .when(Boolean(it.shortcut), (el) => el.child(div().flex_none().pl(16).child(it.shortcut)))
      .when(Boolean(it.sub), (el) => el.child(glyph("menu-arrow", 10)))
      .on_click((_e, cx) => {
        if (dis) return;
        if (it.sub) {
          this.openSub(i, it);
          cx.notify();
          return;
        }
        this.closeAll();
        perform(it.act);
      });
  }

  render(_cx) {
    const P = pal();
    const items = props()?.items ?? [];
    return v_flex()
      .id("xp-menu")
      .size_full()
      .font_family(uiFont())
      .text_size(11)
      .bg(P.popup)
      .border_1()
      .border_color(P.popupBorder)
      .py(2)
      .px(1)
      .children(items.map((it, i) => this.row(P, it, i)));
  }
}
