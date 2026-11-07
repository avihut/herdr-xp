// Explorer windows with XP's blue task pane:
//   mycomputer  your spaces as drives (click one to show it), other machines
//   bin         the Recycle Bin (empty: Herdr closes things for good)

import { props, closeOverlay, spaces, machines, run } from "herdr";
import { div, h_flex, v_flex, pal, bands, grad, pic, frame, menuBar, uiFont, tildePath, own } from "./kit.js";

export default class Explorer {
  init(p) {
    this.role = p?.role ?? props()?.role;
    this.sel = null;
  }

  dismiss() {
    closeOverlay(props()?.overlay);
  }

  box(P, title, links) {
    return v_flex()
      .flex_none()
      .rounded_tl(4)
      .rounded_tr(4)
      .overflow_hidden()
      .child(div().relative().h(24).child(grad(P.paneBoxHead[0], P.paneBoxHead[1], 90)).child(div().relative().px(10).pt(5).text_size(11).font_weight(700).text_color(P.paneBoxText).child(title)))
      .child(
        v_flex()
          .bg(P.paneBox)
          .p(10)
          .gap(6)
          .children(
            links.map(([icon, label, act], i) =>
              own(
                h_flex()
                  .id(`tp-${title}-${i}`)
                  .gap(6)
                  .items_center()
                  .text_size(11)
                  .text_color(act ? P.paneLink : P.faceDim)
                  .when(Boolean(act), (el) => el.hover((s) => s.underline()))
                  .child(pic(icon, 16))
                  .child(div().child(label))
                  .on_click(() => act?.()),
              ),
            ),
          ),
      );
  }

  toolbar(P, where) {
    const tool = (icon, label, dis = true) =>
      h_flex()
        .gap(4)
        .px(4)
        .h(28)
        .items_center()
        .rounded(3)
        .opacity(dis ? 0.5 : 1)
        .child(pic(icon, 22))
        .when(Boolean(label), (el) => el.child(div().text_size(11).child(label)));
    return v_flex()
      .flex_none()
      .bg(P.face)
      .child(h_flex().h(34).px(4).gap(2).items_center().child(tool("back", "Back")).child(tool("forward", null)).child(tool("up", null)).child(div().w(1).h(24).mx(4).bg(P.popupBorder)).child(tool("search", "Search", false)).child(tool("folders", "Folders")))
      .child(
        h_flex()
          .h(24)
          .px(6)
          .gap(6)
          .items_center()
          .border_t_1()
          .border_color(P.popupBorder)
          .child(div().text_size(11).text_color(P.faceDim).child("Address"))
          .child(h_flex().flex_1().h(19).bg(P.field).border_1().border_color(P.fieldBorder).px(3).gap(4).items_center().child(pic(this.role === "bin" ? "bin" : "computer", 14)).child(div().text_size(11).child(where)))
          .child(h_flex().gap(3).items_center().child(pic("go", 18)).child(div().text_size(11).child("Go"))),
      );
  }

  drive(P, s) {
    const on = this.sel === s.id || (this.sel === null && s.active);
    return own(
      h_flex()
        .id(`drv-${s.id}`)
        .w(220)
        .gap(8)
        .p(4)
        .items_center()
        .rounded(2)
        .when(on, (el) => el.bg(P.menuHover).text_color("#ffffff"))
        .child(pic(s.machine ? "netdrive" : "drive", 32))
        .child(
          v_flex()
            .min_w(0)
            .child(div().truncate().text_size(11).child(`${s.name} (${String.fromCharCode(67 + Math.min(23, s.index - 1))}:)`))
            .child(div().truncate().text_size(10).opacity(0.7).child(`${s.tabs.length} tab${s.tabs.length === 1 ? "" : "s"} · ${s.machine ? `on ${s.machine}` : tildePath(s.folder) || "~"}`)),
        )
        .on_click((e, cx) => {
          this.sel = s.id;
          if (e?.click_count >= 2 || true) run("space.select", { id: s.id });
          cx.notify();
        }),
    );
  }

  group(P, title, children) {
    return v_flex()
      .gap(6)
      .child(v_flex().child(div().text_size(11).font_weight(700).text_color(P.listHead).child(title)).child(div().h(1).mt(2).child(grad(P.listHead, "#ffffff00", 90))))
      .child(div().flex().flex_row().flex_wrap().gap(8).pl(8).children(children));
  }

  render(_cx) {
    const P = pal();
    const bin = this.role === "bin";
    const title = bin ? "Recycle Bin" : "My Computer";
    const sp = spaces();
    const local = sp.filter((s) => !s.machine);
    const remote = sp.filter((s) => s.machine);
    const others = (() => {
      try {
        return machines().filter((m) => m.name);
      } catch {
        return [];
      }
    })();
    const pane = v_flex()
      .flex_none()
      .w(190)
      .h_full()
      .min_h(0)
      .overflow_hidden()
      .relative()
      .child(bands(P.pane))
      .child(
        v_flex()
          .relative()
          .p(10)
          .gap(12)
          .child(
            bin
              ? this.box(P, "Recycle Bin Tasks", [["bin", "Empty the Recycle Bin", null], ["restore", "Restore all items", null]])
              : this.box(P, "System Tasks", [["info", "View system information", () => run("app.settings", {})], ["control", "Change a setting", () => run("app.settings", {})], ["folder-new", "Add a new space", () => run("space.new", {})]]),
          )
          .child(this.box(P, "Other Places", [["computer", bin ? "My Computer" : "My Documents", null], ["network", "My Network Places", null], ["control", "Control Panel", () => run("app.settings", {})]])),
      );
    const content = bin
      ? v_flex().flex_1().min_w(0).h_full().p(16).bg(P.list).child(div().text_size(11).text_color(P.faceDim).child("This folder is empty."))
      : v_flex()
          .flex_1()
          .min_w(0)
          .h_full()
          .p(14)
          .gap(16)
          .bg(P.list)
          .overflow_hidden()
          .child(this.group(P, "Spaces Stored on This Computer", local.map((s) => this.drive(P, s))))
          .when(remote.length > 0, (el) => el.child(this.group(P, "Network Spaces", remote.map((s) => this.drive(P, s)))))
          .when(others.length > 0, (el) => el.child(this.group(P, "Other Machines", others.map((m) => h_flex().w(220).gap(8).p(4).items_center().child(pic("network", 32)).child(div().text_size(11).child(`${m.name} (${m.layout})`))))));
    const count = bin ? 0 : sp.length;
    return frame(P, {
      id: `xp-${this.role}`,
      title,
      icon: pic(bin ? "bin" : "computer", 16),
      caps: [["ctl-min", () => this.dismiss()], ["ctl-max", () => {}], ["ctl-close", () => this.dismiss()]],
      body: v_flex()
        .size_full()
        .child(menuBar(P, "ex", [["File", [{ label: "Close", act: null }]], ["Edit", [{ label: "Select All", disabled: true }]], ["View", [{ label: "Tiles", radio: true }, { label: "Icons", disabled: true }]], ["Favorites", [{ label: "(Empty)", disabled: true }]], ["Tools", [{ label: "Folder Options...", act: { run: ["app.settings", {}] } }]], ["Help", [{ label: "About Herdr XP", act: { dialog: "about" } }]]]))
        .child(this.toolbar(P, title))
        .child(div().flex().flex_row().flex_1().min_h(0).overflow_hidden().child(pane).child(content))
        .child(h_flex().flex_none().h(20).px(6).items_center().bg(P.face).border_t_1().border_color(P.popupBorder).text_size(11).child(`${count} object${count === 1 ? "" : "s"}`)),
    });
  }
}
