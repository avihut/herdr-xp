// The Start menu: XP's two columns under a blue banner with your picture.
// Left: pinned (Command Prompt, your first agent), then often used (other
// agents, the games, the tour), then All Programs ▸. Right: My Spaces ▸,
// My Recent Tabs ▸, My Computer; Control Panel, Layouts ▸ (the layout
// switcher); Help and Support, Search, Run. Bottom: Log Off, Turn Off.

import { spaces, panes, props, closeOverlay, knownAgents, setShared, shared } from "herdr";
import { div, h_flex, v_flex, pal, bands, grad, pic, iconOf, glyph, shadowed, uiFont, titleFont, userName, tildePath, paneTitle, perform, openMenu, closeOverlays, layoutItems, fadeLine } from "./kit.js";

export const MENU_W = 380;
export const MENU_H = 448;

export function programsMenu(agents) {
  const agentItems = agents.map((a) => ({ label: a.name, icon: { program: a }, act: { run: ["tab.new", { name: a.name, argv: a.run }] } }));
  return [
    { label: "Accessories", icon: "programs", sub: [
      { label: "Games", icon: "programs", sub: [
        { label: "FreeCell", icon: "freecell", act: { open: "freecell" } },
        { label: "Minesweeper", icon: "mines", act: { open: "mines" } },
        { label: "Solitaire", icon: "sol", act: { open: "sol" } },
        { label: "Spider Solitaire", icon: "spider", act: { open: "spider" } },
      ] },
      { label: "System Tools", icon: "programs", sub: [
        { label: "Task Manager", icon: "taskman", act: { open: "taskman" } },
        { label: "Desktop Cleanup Wizard", icon: "cleanup", act: { dialog: "cleanup" } },
        { label: "Display Properties", icon: "display", act: { dialog: "display" } },
      ] },
      { label: "Command Prompt", icon: "cmd", act: { run: ["tab.new", {}] } },
      { label: "Command Palette", icon: "search", act: { run: ["app.palette", {}] } },
      { label: "Tour Herdr XP", icon: "tour", act: { shared: ["winxp.balloon", { kind: "tour", at: Date.now() }] } },
    ] },
    { label: "Agents", icon: "programs", sub: agentItems.length ? agentItems : [{ label: "(Empty)", disabled: true }] },
    { sep: true },
    { label: "New Space", icon: "folder-new", act: { run: ["space.new", {}] } },
    { label: "Herdr Update", icon: "update", act: { run: ["app.settings", { section: "updates" }] } },
    { label: "About Herdr XP", icon: "info", act: { dialog: "about" } },
  ];
}

export default class StartMenu {
  init(_p, cx) {
    this.agents = [];
    this.bounds = {};
    this.sub = null;
    cx.spawn(async (cx) => {
      try {
        this.agents = (await knownAgents()).filter((a) => a.installed);
      } catch {}
      cx.notify();
    });
  }

  // No closing of the open submenu here: a press inside it may close the Start menu first.
  async close() {
    setShared("winxp.start", null);
    setShared("winxp.startClosedAt", Date.now());
  }

  done(act) {
    if (this.sub) closeOverlays([this.sub.id]);
    closeOverlay(props()?.overlay);
    perform(act);
  }

  openSub(key, items) {
    if (this.sub?.key === key) return;
    if (this.sub) closeOverlays([this.sub.id]);
    this.sub = null;
    const b = this.bounds[key];
    if (!items || !b) return;
    // All Programs sits at the bottom: its menu grows upward from the row, as in XP.
    const id = openMenu(items, { beside: b }, { parents: [props()?.overlay], bottom: key === "all" });
    this.sub = { key, id };
  }

  /** A row. Left rows are 34px with 30px icons, right rows 26px with 22px icons (XP's sizes). o: { sub, sublabel, bold, right } */
  item(P, key, icon, title, act, o = {}) {
    const right = Boolean(o.right);
    const ink = right ? P.menuRightText : P.menuText;
    let row = h_flex()
      .id(`sm-${key}`)
      .relative()
      .flex_none()
      .h(right ? 26 : 34)
      .mb(4)
      .px(1)
      .gap(3)
      .items_center()
      .text_color(ink)
      .hover((s) => s.bg(P.menuHover).text_color(P.menuHoverText))
      .on_mouse_move((e, cx) => {
        if (e?.bounds) this.bounds[key] = e.bounds;
        this.openSub(o.sub ? key : null, o.sub);
        cx.notify();
      })
      .child(iconOf(icon, right ? 22 : 30))
      .child(
        v_flex()
          .flex_1()
          .min_w(0)
          .justify_center()
          .child(div().truncate().text_size(11).line_height("13px").font_weight(o.bold ? 700 : 400).child(title))
          .when(Boolean(o.sublabel), (el) => el.child(div().truncate().text_size(11).line_height("12px").opacity(0.45).child(o.sublabel))),
      )
      .when(Boolean(o.sub), (el) => el.child(div().flex_none().pr(4).child(glyph("menu-arrow", 8))));
    row = row.on_click((_e, cx) => {
      if (o.sub) {
        this.openSub(key, o.sub);
        cx.notify();
        return;
      }
      this.done(act);
    });
    return row;
  }

  sep(color) {
    return div().flex_none().h(7).flex().items_center().child(fadeLine(color));
  }

  render(_cx) {
    const P = pal();
    const [first, ...rest] = this.agents;
    const sp = spaces();
    const shown = sp.find((s) => s.active);
    const tabItems = (shown?.tabs ?? []).map((t) => {
      const lead = panes().find((p) => p.tab === t.id && p.focused) ?? panes().find((p) => p.tab === t.id);
      return { label: t.named ? t.name : paneTitle(lead) || `Tab ${t.index}`, icon: lead?.program && !lead.program.shell ? { program: lead.program } : "cmd", act: { run: ["tab.select", { id: t.id }] } };
    });
    const spaceItems = sp.map((s) => ({ label: s.name, icon: s.active ? "folder-open" : "folder", radio: false, act: { run: ["space.select", { id: s.id }] } }));

    const left = v_flex()
      .flex_none()
      .w(190)
      .h_full()
      .bg(P.menuLeft)
      .pt(6)
      .px(5)
      .child(this.item(P, "cmd", "cmd", "Command Prompt", { run: ["tab.new", {}] }, { bold: true, sublabel: "A new tab" }))
      .when(Boolean(first), (el) => el.child(this.item(P, `a-${first.key}`, { program: first }, first.name, { run: ["tab.new", { name: first.name, argv: first.run }] }, { bold: true, sublabel: "Coding agent" })))
      .child(this.sep(P.menuSep))
      .children(rest.slice(0, 3).map((a) => this.item(P, `a-${a.key}`, { program: a }, a.name, { run: ["tab.new", { name: a.name, argv: a.run }] })))
      .child(this.item(P, "sol", "sol", "Solitaire", { open: "sol" }))
      .child(this.item(P, "mines", "mines", "Minesweeper", { open: "mines" }))
      .child(div().flex_1())
      .child(this.sep(P.menuSep))
      .child(
        h_flex()
          .id("sm-all")
          .flex_none()
          .h(24)
          .mb(4)
          .justify_center()
          .items_center()
          .gap(6)
          .text_color(P.menuText)
          .hover((s) => s.bg(P.menuHover).text_color(P.menuHoverText))
          .on_mouse_move((e, cx) => {
            if (e?.bounds) this.bounds.all = e.bounds;
            this.openSub("all", programsMenu(this.agents));
            cx.notify();
          })
          .child(div().text_size(11).font_weight(700).child("All Programs"))
          .child(pic("all-programs", 18)),
      );

    const right = v_flex()
      .flex_1()
      .min_w(0)
      .h_full()
      .bg(P.menuRight)
      .border_l_1()
      .border_color(P.menuRightBorder)
      .pt(6)
      .px(5)
      .child(this.item(P, "spaces", "documents", "My Spaces", null, { bold: true, right: true, sub: spaceItems }))
      .child(this.item(P, "recent", "recent", "My Recent Tabs", null, { bold: true, right: true, sub: tabItems.length ? tabItems : [{ label: "(Empty)", disabled: true }] }))
      .child(this.item(P, "computer", "computer", "My Computer", { open: "mycomputer" }, { bold: true, right: true }))
      .child(this.sep(P.menuSepRight))
      .child(this.item(P, "control", "control", "Control Panel", { run: ["app.settings", {}] }, { right: true }))
      .child(this.item(P, "layouts", "display", "Layouts", null, { right: true, sub: layoutItems() }))
      .child(this.item(P, "display", "display-props", "Display Properties", { dialog: "display" }, { right: true }))
      .child(this.sep(P.menuSepRight))
      .child(this.item(P, "help", "help", "Help and Support", { run: ["app.help", {}] }, { right: true }))
      .child(this.item(P, "search", "search", "Search", { run: ["app.palette", {}] }, { right: true }))
      .child(this.item(P, "run", "run", "Run...", { dialog: "run" }, { right: true }));

    const head = div()
      .relative()
      .flex_none()
      .h(54)
      .w_full()
      .rounded_tl(5)
      .rounded_tr(5)
      .overflow_hidden()
      .child(bands(P.menuHead))
      .child(div().absolute().top(1).left(0).w_full().h(3).child(fadeLine("#ffffff80")))
      .child(
        h_flex()
          .relative()
          .size_full()
          .items_center()
          .gap(5)
          .pt(6)
          .pb(5)
          .px(5)
          .child(div().flex_none().rounded(3).border_2().border_color("#dededecc").overflow_hidden().child(pic("user", 42)))
          .child(div().font_family(uiFont()).font_weight(700).text_size(14).child(shadowed(userName(), "#ffffff", "#000000"))),
      );

    const footButton = (key, icon, label, act) =>
      h_flex()
        .id(`sm-${key}`)
        .flex_none()
        .items_center()
        .gap(2)
        .p(3)
        .mr(10)
        .hover((s) => s.bg("#3c50d280"))
        .child(div().rounded(3).overflow_hidden().child(pic(icon, 22)))
        .child(div().text_size(11).text_color("#ffffff").child(label))
        .on_click(() => this.done(act));
    const foot = div()
      .relative()
      .flex_none()
      .h(36)
      .w_full()
      .child(bands(P.menuFoot))
      .child(
        h_flex()
          .relative()
          .size_full()
          .items_center()
          .justify_end()
          .child(footButton("logoff", "logoff", "Log Off", { dialog: "logoff" }))
          .child(footButton("turnoff", "power", "Turn Off Computer", { dialog: "turnoff" })),
      );

    const body = div()
      .relative()
      .flex()
      .flex_row()
      .flex_1()
      .min_h(0)
      .mx(2)
      .border_t_1()
      .border_color(P.menuTopLine)
      .child(left)
      .child(right)
      .child(div().absolute().top(0).left(0).w_full().h(2).child(fadeLine(P.menuLine)));

    return v_flex()
      .id("xp-start-menu")
      .w(MENU_W)
      .h(MENU_H)
      .font_family(uiFont())
      .bg(P.menuBg)
      .rounded_tl(5)
      .rounded_tr(5)
      .overflow_hidden()
      .child(head)
      .child(body)
      .child(foot);
  }
}
