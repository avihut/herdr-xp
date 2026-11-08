// The taskbar: the start button, Quick Launch (Show Desktop, a new Command
// Prompt, your agents), a button per tab of the shown space (XP groups them
// by program when they don't fit), and the notification area (the hide-
// inactive-icons chevron, agents by status, network, volume, the clock).
// Drag a tab's button along the taskbar to reorder the tabs (tab.move); a white
// bar shows where it lands. Dragging off the taskbar cancels: Herdr reports no
// release outside it.
// It also runs what keys send (`winxp.start` and the rest), the first-run
// boot screen, and XP's balloon tips.

import { spaces, panes, agents, run, shared, setShared, nextCommand, knownAgents, openOverlay, closeOverlay, settings } from "herdr";
import { div, h_flex, pal, bands, grad, pic, glyph, programIcon, shadowed, own, uiFont, paneTitle, statusColor, openMenu, openDialog, openWindow, panelShown, togglePanel, openBrowser, hasSim } from "./kit.js";
import { MENU_W, MENU_H } from "./start.js";
import { watchPlacement } from "./panedrag.js";
import { watchBattery, batteryTip, batteryReport } from "./battery.js";
import { watchNetwork, networkTip, networkReport, networkName, networkIcon } from "./network.js";
import { dropPosition } from "./taborder.js";

const SLOP = 4; // px a press moves before it is a drag, not a click

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const clock = (d) => `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "AM" : "PM"}`;
const longDate = (d) => `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
const zoom = () => Number(settings()?.zoom) || 1;

const COMMANDS = {
  simulator: () => hasSim() && togglePanel("herdr-sim"),
  run: () => openDialog("run"),
  logoff: () => openDialog("logoff"),
  turnoff: () => openDialog("turnoff"),
  display: () => openDialog("display"),
  about: () => openDialog("about"),
  cleanup: () => openDialog("cleanup"),
  boot: () => openDialog("boot"),
  welcome: () => openDialog("welcome"),
  mines: () => openWindow("mines"),
  sol: () => openWindow("sol"),
  spider: () => openWindow("spider"),
  freecell: () => openWindow("freecell"),
  mycomputer: () => openWindow("mycomputer"),
  internet: () => openBrowser(),
  taskman: () => openWindow("taskman"),
  tour: () => setShared("winxp.balloon", { kind: "tour", at: Date.now() }),
};

/** The pane a tab's button shows: its focused one, else its first. */
function lead(tabId) {
  const ps = panes().filter((p) => p.tab === tabId);
  return ps.find((p) => p.focused) ?? ps[0] ?? null;
}

export default class Taskbar {
  init(_p, cx) {
    this.now = new Date();
    watchBattery(this, cx); // this.battery: the power icon (none on a computer without a battery)
    watchNetwork(this, cx); // this.network: the connection icon (Ethernet, Wi-Fi or not connected)
    this.quick = [];
    this.bar = null;
    this.expanded = false;
    this.balloonAt = Number(shared("winxp.balloon")?.at ?? 0);
    this.shownAt = Date.now();
    const tick = (cx) => {
      this.now = new Date();
      this.maybeCleanup();
      cx.notify();
    };
    cx.timer.after(60000 - (Date.now() % 60000) + 50, (cx) => {
      tick(cx);
      cx.timer.every(60000, tick);
    });
    cx.spawn(async (cx) => {
      try {
        this.quick = (await knownAgents()).filter((a) => a.installed).slice(0, 2);
      } catch {}
      cx.notify();
    });
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        try {
          if (c === "start") this.toggleStart(null);
          else COMMANDS[c]?.();
        } catch (e) {
          console.log(`winxp: ${c}: ${e}`);
        }
        cx.notify();
      }
    });
    if (shared("winxp.start")) setShared("winxp.start", null);
    // The first time Herdr XP shows: the boot screen, then the tour balloon.
    if (!shared("winxp.firstrun")) {
      setShared("winxp.firstrun", Date.now());
      cx.timer.after(400, () => openDialog("boot", { then: "tour" }));
    }
  }

  // Once a day, after half an hour on XP: the Desktop Cleanup Wizard's nag.
  maybeCleanup() {
    const last = Number(shared("winxp.cleanupAt") ?? 0);
    if (Date.now() - this.shownAt < 30 * 60000 || Date.now() - last < 24 * 3600000) return;
    setShared("winxp.cleanupAt", Date.now());
    setShared("winxp.balloon", { kind: "cleanup", at: Date.now() });
  }

  // A new balloon request (shared "winxp.balloon") opens one above the tray.
  showBalloon() {
    const b = shared("winxp.balloon");
    const at = Number(b?.at ?? 0);
    if (!b || at <= this.balloonAt) return;
    this.balloonAt = at;
    let size = { width: 1200, height: 800 };
    try {
      size = window.bounds();
    } catch {}
    const w = 300, h = 104;
    const old = shared("winxp.balloonId");
    if (old) closeOverlay(old);
    const id = openOverlay({
      mod: "winxp",
      kind: "window",
      frame: "none",
      width: w * zoom(),
      height: h * zoom(),
      at: { x: Math.max(0, size.width - (w + 24) * zoom()), y: Math.max(0, size.height - (30 + h + 2) * zoom()) },
      props: { role: "balloon", kind: b.kind },
    });
    setShared("winxp.balloonId", id);
  }

  toggleStart(bounds) {
    if (shared("winxp.start")) return; // a click beside the popup already closes it
    if (Date.now() - Number(shared("winxp.startClosedAt") ?? 0) < 300) return; // that click just closed it
    const b = bounds ?? this.bar;
    const at = b ? { x: b.x, y: Math.max(0, b.y - MENU_H * zoom()) } : undefined;
    const id = openOverlay({ mod: "winxp", kind: "popup", frame: "none", width: MENU_W * zoom(), height: MENU_H * zoom(), ...(at ? { at } : {}), props: { role: "start" } });
    setShared("winxp.start", id);
  }

  startButton(P) {
    const open = Boolean(shared("winxp.start"));
    return div()
      .id("xp-start")
      .relative()
      .flex_none()
      .h_full()
      .w(100)
      .rounded_tr(10)
      .rounded_br(10)
      .overflow_hidden()
      .child(bands(open ? P.startDown : P.start))
      .child(div().id("xp-start~hover").absolute().top(0).left(0).size_full().opacity(0).when(!open, (el) => el.hover((s) => s.opacity(1))).child(bands(P.startHover)))
      .child(
        h_flex()
          .relative()
          .size_full()
          .items_center()
          .pl(8)
          .gap(4)
          .child(pic("flag", 22))
          .child(div().font_family("Trebuchet MS").italic().font_weight(700).text_size(18).child(shadowed("start", "#ffffff", "#1a4a17"))),
      )
      .on_mouse_down("left", (e, cx) => {
        cx.stop_propagation();
        this.toggleStart(e?.bounds ?? null);
      });
  }

  quickLaunch() {
    const item = (id, icon, tip, act, on = false) =>
      own(div().id(id).flex_none().w(24).h(24).rounded(3).flex().items_center().justify_center().tooltip(tip).when(on, (el) => el.bg("#00000038").border_1().border_color("#ffffff40")).hover((s) => s.bg("#ffffff33")).child(icon).on_click(() => act()));
    const shown = spaces().find((s) => s.active);
    const bar = panelShown();
    const items = [
      item("ql-desktop", pic("show-desktop", 18), "Show Desktop", () => (shown?.tabs ?? []).filter((t) => !t.settled).forEach((t) => run("tab.settle", { id: t.id }))),
      item("ql-internet", pic("internet", 18), "Internet", () => openBrowser()),
      item("ql-cmd", pic("cmd", 18), "Command Prompt", () => run("tab.new", {})),
      item("ql-files", pic("folders", 18), "Folders", () => togglePanel("files"), bar === "files"),
      item("ql-changes", pic("changes", 18), "Changes", () => togglePanel("changes"), bar === "changes"),
      ...(hasSim() ? [item("ql-sim", pic("phone", 18), "Simulator", () => togglePanel("herdr-sim"), bar === "herdr-sim")] : []),
      ...this.quick.map((a) => item(`ql-${a.key}`, programIcon(a, 18), a.name, () => run("tab.new", { name: a.name, argv: a.run }))),
    ];
    return h_flex()
      .flex_none()
      .h_full()
      .items_center()
      .gap(1)
      .pl(6)
      .pr(4)
      .child(div().flex_none().w(1).h(22).bg("#00000040"))
      .child(div().flex_none().w(1).h(22).mr(3).bg("#ffffff40"))
      .children(items)
      .child(div().flex_none().w(1).h(22).ml(3).bg("#00000040"))
      .child(div().flex_none().w(1).h(22).bg("#ffffff40"));
  }

  /** A taskbar button (the winXP clone's measurements): flat blue, a light top-left edge, a dark right edge. */
  taskButton(P, key, o) {
    const bg = o.flash ? "#f08f30" : o.pressed ? P.taskOn : P.task;
    const hover = o.flash ? "#ffa64d" : o.pressed ? P.taskOnHover : P.taskHover;
    return div()
      .id(`task-${key}`)
      .relative()
      .flex_1()
      .min_w(40)
      .max_w(150)
      .h(22)
      .mt(2)
      .rounded(2)
      .overflow_hidden()
      .bg(bg)
      .hover((s) => s.bg(hover))
      .when(Boolean(o.dragging), (el) => el.opacity(0.55))
      .tooltip(o.label)
      .child(div().absolute().top(0).left(0).size_full().rounded(2).border_t_1().border_l_1().border_color(o.pressed ? "#00000059" : "#ffffff33"))
      .child(div().absolute().top(0).right(0).w(1).h_full().bg("#0000004d"))
      .child(
        h_flex()
          .relative()
          .size_full()
          .items_center()
          .gap(5)
          .px(8)
          .child(div().relative().flex_none().child(o.icon).when(Boolean(o.badge), (el) => el.child(div().absolute().bottom(-2).right(-2).w(7).h(7).rounded(4).border_1().border_color("#ffffff").bg(statusColor(o.badge)))))
          .child(div().flex_1().min_w(0).text_size(11).child(shadowed(o.label, P.taskText, "#00000059", { truncate: true })))
          .when(Boolean(o.group), (el) => el.child(glyph("menu-up", 8, "#ffffff"))),
      )
      .when(Boolean(o.mark), (el) =>
        el.child(
          div()
            .absolute()
            .top(0)
            .w(3)
            .h_full()
            .bg("#ffffff")
            .border_color("#0a246a")
            .when(o.mark === "before", (b) => b.left(0).border_r_1())
            .when(o.mark === "after", (b) => b.right(0).border_l_1()),
        ),
      )
      .on_mouse_down("left", (e, cx) => {
        cx.stop_propagation();
        o.onDown?.(e);
      })
      .when(Boolean(o.onMove), (el) => el.on_mouse_move((e, cx) => o.onMove(e, cx)))
      .when(Boolean(o.onUp), (el) => el.on_mouse_up("left", (e, cx) => o.onUp(e, cx)))
      .on_click(() => {
        // The release that ends a drag isn't a click.
        if (this.tabDrag?.moved || Date.now() - (this.dragEndAt ?? 0) < 300) return;
        o.onClick?.();
      });
  }

  // ---- reordering tabs by dragging their buttons
  // this.tabDrag = { id, x0, moved, over: { ids, side } } from the press until the release.

  pressTab(id, e) {
    this.tabDrag = e?.position ? { id, x0: e.position.x, moved: false, over: null } : null;
  }

  /** The release over a button (ids: its tabs). Herdr delivers it to the button under the
   *  pointer wherever the press was, so this, not the moves, decides the drop. */
  upOn(ids, e, order, cx) {
    const d = this.tabDrag;
    if (!d) return;
    const far = e?.position ? Math.abs(e.position.x - d.x0) > SLOP : false;
    if (!d.moved && !far && ids.includes(d.id)) {
      this.tabDrag = null; // a click: on_click handles it
      return;
    }
    const side = e?.local_position && e?.bounds ? (e.local_position.x < e.bounds.width / 2 ? "before" : "after") : d.over?.side ?? "after";
    d.over = { ids, side };
    d.moved = true;
    this.dropTab(order, cx);
  }

  /** The pointer is over a button (ids: its tabs): which half says before or after it. */
  overButton(ids, e, cx) {
    const d = this.tabDrag;
    if (!d || !e?.bounds || !e?.local_position) return;
    const side = e.local_position.x < e.bounds.width / 2 ? "before" : "after";
    if (d.over?.side === side && d.over.ids.join() === ids.join()) return;
    d.over = { ids, side };
    if (d.moved) cx.notify();
  }

  /** Any move along the strip: past SLOP it is a drag. */
  dragMove(e, cx) {
    const d = this.tabDrag;
    if (!d || d.moved || !e?.position) return;
    if (Math.abs(e.position.x - d.x0) > SLOP) {
      d.moved = true;
      cx.notify();
    }
  }

  dropTab(order, cx) {
    const d = this.tabDrag;
    this.tabDrag = null;
    if (!d) return;
    if (d.moved) {
      this.dragEndAt = Date.now();
      const index = d.over ? dropPosition(order, d.id, d.over.ids, d.over.side) : null;
      if (index) run("tab.move", { id: d.id, index });
    }
    cx.notify();
  }

  cancelDrag(cx) {
    if (!this.tabDrag) return;
    this.tabDrag = null;
    cx.notify();
  }

  /** Where the landing bar goes on a button (ids), if the dragged tab would land beside it. */
  markFor(ids, order) {
    const d = this.tabDrag;
    if (!d?.moved || !d.over || d.over.ids.join() !== ids.join()) return null;
    return dropPosition(order, d.id, ids, d.over.side) ? d.over.side : null;
  }

  tasks(P, tabs) {
    const order = tabs.map((t) => t.id);
    const info = tabs.map((t) => {
      const p = lead(t.id);
      return { t, p, key: p?.program && !p.program.shell ? p.program.key : "shell", name: p?.program && !p.program.shell ? p.program.name : "Command Prompt" };
    });
    const tabButton = ({ t, p }) => {
      const pressed = t.active && !t.settled;
      const ids = [t.id];
      return this.taskButton(P, t.id, {
        label: t.named ? t.name : paneTitle(p) || `Tab ${t.index}`,
        icon: programIcon(p?.program, 15, "#ffffff"),
        pressed,
        flash: t.status === "blocked",
        badge: t.status === "working" || t.status === "done" ? t.status : null,
        dragging: this.tabDrag?.moved && this.tabDrag.id === t.id,
        mark: this.markFor(ids, order),
        onDown: (e) => tabs.length > 1 && this.pressTab(t.id, e),
        onMove: (e, cx) => this.overButton(ids, e, cx),
        onUp: (e, cx) => this.upOn(ids, e, order, cx),
        onClick: () => (pressed ? run("tab.settle", { id: t.id }) : run("tab.select", { id: t.id })),
      });
    };
    if (info.length <= 5) return info.map(tabButton);
    // XP's taskbar grouping: tabs of one program share a button that lists them.
    const groups = new Map();
    for (const i of info) groups.set(i.key, [...(groups.get(i.key) ?? []), i]);
    const out = [];
    for (const [key, list] of groups) {
      if (list.length === 1) {
        out.push(tabButton(list[0]));
        continue;
      }
      const active = list.some(({ t }) => t.active && !t.settled);
      const ids = list.map(({ t }) => t.id);
      const status = list.some(({ t }) => t.status === "blocked") ? "blocked" : list.some(({ t }) => t.status === "working") ? "working" : null;
      out.push(
        this.taskButton(P, `g-${key}`, {
          label: `${list.length} ${list[0].name}`,
          icon: programIcon(list[0].p?.program, 15, "#ffffff"),
          pressed: active,
          flash: status === "blocked",
          badge: status === "working" ? "working" : null,
          group: true,
          mark: this.markFor(ids, order),
          onMove: (e, cx) => this.overButton(ids, e, cx),
          onUp: (e, cx) => this.upOn(ids, e, order, cx),
          onDown: (e) => {
            this.tabDrag = null;
            const b = e?.bounds;
            const items = list.map(({ t, p }) => ({ label: t.named ? t.name : paneTitle(p) || `Tab ${t.index}`, icon: p?.program && !p.program.shell ? { program: p.program } : "cmd", bold: t.active, act: { run: ["tab.select", { id: t.id }] } }));
            openMenu(items, b ? { above: b } : undefined);
          },
        }),
      );
    }
    return out;
  }

  // XP's power meter icon: an upright battery cell, dark where it's empty and filled from the
  // bottom with the charge (green; amber at 25% and under; red at 10%), with the plug while on
  // AC power. Click for the Power Meter.
  powerIcon(b) {
    const color = b.pct <= 10 ? "#ff2a1a" : b.pct <= 25 ? "#ffb000" : "#2ee82e";
    const fill = Math.max(1, Math.round((b.pct / 100) * 10));
    return own(
      div()
        .id("tray-power")
        .flex_none()
        .p(2)
        .rounded(3)
        .tooltip(batteryTip(b))
        .hover((s) => s.bg("#ffffff26"))
        .on_click(() => openDialog("message", { title: "Power Meter", icon: "info", text: batteryReport(b) }))
        .child(
          div()
            .relative()
            .w(16)
            .h(16)
            .child(div().absolute().left(6).top(0).w(5).h(3).rounded_tl(1).rounded_tr(1).border_1().border_color("#0b1220").bg("#d8dde6"))
            .child(
              div()
                .absolute()
                .left(4)
                .top(2)
                .w(9)
                .h(14)
                .rounded(1)
                .border_1()
                .border_color("#0b1220")
                .bg("#1c2430")
                .child(div().absolute().left(0).bottom(0).w_full().h(Math.round((fill / 10) * 12)).bg(color))
                .child(div().absolute().left(1).top(0).w(2).h_full().bg("#ffffff").opacity(0.3)),
            )
            .when(b.ac, (el) =>
              el
                .child(div().absolute().left(0).top(8).child(glyph("plug", 9, "#0b1220")))
                .child(div().absolute().left(-1).top(7).child(glyph("plug", 9, "#ffffff"))),
            ),
        ),
    );
  }

  // XP's connection icon: two monitors for a wired connection, a monitor and its radio waves
  // for Wi-Fi, a red X when there is none. Click for the connection's status.
  netIcon(n) {
    return own(
      div()
        .id("tray-net")
        .flex_none()
        .p(2)
        .rounded(3)
        .tooltip(networkTip(n))
        .hover((s) => s.bg("#ffffff26"))
        .on_click(() => openDialog("message", { title: `${networkName(n)} Status`, icon: n.kind === "none" ? "warning" : "info", text: networkReport(n) }))
        .child(pic(networkIcon(n), 16)),
    );
  }

  tray(P) {
    const all = agents();
    const by = (s) => all.filter((a) => a.status === s);
    const dot = (status, list, tip) =>
      own(
        h_flex()
          .id(`tray-${status}`)
          .flex_none()
          .items_center()
          .gap(2)
          .px(2)
          .h(20)
          .rounded(3)
          .tooltip(tip)
          .hover((s) => s.bg("#ffffff26"))
          .child(div().w(10).h(10).rounded(5).border_1().border_color("#ffffff").bg(statusColor(status)))
          .child(div().text_size(11).text_color("#ffffff").child(String(list.length)))
          .on_click(() => list[0] && run("agent.focus", { terminal: list[0].address })),
      );
    const icon = (id, name, tip, act) => own(div().id(id).flex_none().p(2).rounded(3).tooltip(tip).hover((s) => s.bg("#ffffff26")).child(pic(name, 16)).on_click(() => act?.()));
    const blocked = by("blocked");
    const working = by("working");
    const done = by("done");
    const always = [
      blocked.length ? dot("blocked", blocked, `${blocked.length} agent${blocked.length === 1 ? " needs" : "s need"} you`) : null,
      this.network ? this.netIcon(this.network) : null,
      this.battery ? this.powerIcon(this.battery) : null,
      icon("tray-volume", "volume", "Volume", () => run("app.settings", { section: "alerts" })),
    ];
    const hidden = [
      working.length ? dot("working", working, `${working.length} working`) : null,
      done.length ? dot("done", done, `${done.length} done`) : null,
      icon("tray-safely", "safely-remove", "Safely Remove Hardware"),
    ].filter(Boolean);
    const chevron = own(
      div()
        .id("tray-chevron")
        .flex_none()
        .w(15)
        .h(15)
        .rounded(8)
        .border_1()
        .border_color("#ffffffa0")
        .flex()
        .items_center()
        .justify_center()
        .tooltip(this.expanded ? "Hide" : "Show hidden icons")
        .hover((s) => s.bg("#ffffff33"))
        .child(glyph(this.expanded ? "chevron-right" : "chevron-left", 9, "#ffffff"))
        .on_click((_e, cx) => {
          this.expanded = !this.expanded;
          cx.notify();
        }),
    );
    return div()
      .relative()
      .flex_none()
      .h_full()
      .child(bands(P.tray))
      .child(div().absolute().top(0).left(0).w(1).h_full().bg(P.trayEdge[0]))
      .child(div().absolute().top(0).left(1).w(1).h_full().bg(P.trayEdge[1]))
      .child(
        h_flex()
          .relative()
          .h_full()
          .items_center()
          .gap(3)
          .pl(6)
          .pr(10)
          .child(chevron)
          .when(this.expanded, (el) => el.children(hidden))
          .children(always.filter(Boolean))
          .child(div().id("tray-clock").pl(5).text_size(11).text_color("#ffffff").tooltip(longDate(this.now)).child(clock(this.now))),
      );
  }

  contextMenu(e) {
    const shown = spaces().find((s) => s.active);
    openMenu(
      [
        { label: "Toolbars", sub: [{ label: "Quick Launch", checked: true, disabled: true }, { label: "Address", disabled: true }, { label: "Links", disabled: true }] },
        { sep: true },
        { label: "Cascade Windows", disabled: true },
        { label: "Tile Windows Horizontally", disabled: true },
        { label: "Tile Windows Vertically", disabled: true },
        { label: "Show the Desktop", act: null, disabled: !(shown?.tabs ?? []).some((t) => !t.settled) },
        { sep: true },
        { label: "Task Manager", icon: "taskman", act: { open: "taskman" } },
        { sep: true },
        { label: "Lock the Taskbar", checked: true, disabled: true },
        { label: "Properties", act: { dialog: "display" } },
      ],
      e?.position ? { above: { x: e.position.x, y: e.position.y, width: 0, height: 0 } } : undefined,
    );
  }

  render(cx) {
    this.showBalloon();
    watchPlacement(this, cx); // a window dropped on another's edge goes beside it (panedrag.js)
    const P = pal();
    const space = spaces().find((s) => s.active) ?? spaces()[0];
    return div()
      .id("xp-taskbar")
      .relative()
      .size_full()
      .font_family(uiFont())
      .on_mouse_move((e) => {
        if (e?.bounds) this.bar = e.bounds;
      })
      .on_mouse_down("right", (e, cx) => {
        cx.stop_propagation();
        this.contextMenu(e);
      })
      .child(bands(P.taskbar))
      .child(
        h_flex()
          .relative()
          .size_full()
          .items_center()
          .child(this.startButton(P))
          .child(this.quickLaunch())
          .child(
            h_flex()
              .id("task-strip")
              .flex_1()
              .min_w(0)
              .h_full()
              .items_center()
              .gap(3)
              .pl(2)
              .pr(6)
              .on_mouse_move((e, cx) => this.dragMove(e, cx))
              .on_mouse_up("left", (_e, cx) => this.dropTab((space?.tabs ?? []).map((t) => t.id), cx))
              .on_hover((over, cx) => !over && this.cancelDrag(cx))
              .children(this.tasks(P, space?.tabs ?? [])),
          )
          .child(this.tray(P)),
      );
  }
}
