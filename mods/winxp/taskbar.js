// The taskbar: the start button, Quick Launch (Show Desktop, a new Command
// Prompt, your agents), a button per tab of the shown space (XP groups them
// by program when they don't fit), and the notification area (the hide-
// inactive-icons chevron, agents by status, network, volume, the clock).
// It also runs what keys send (`winxp.start` and the rest), the first-run
// boot screen, and XP's balloon tips.

import { spaces, panes, agents, run, shared, setShared, nextCommand, knownAgents, openOverlay, closeOverlay, settings } from "herdr";
import { div, h_flex, pal, bands, grad, pic, glyph, programIcon, shadowed, own, uiFont, paneTitle, statusColor, openMenu, openDialog, openWindow } from "./kit.js";
import { MENU_W, MENU_H } from "./start.js";
import { watchPlacement } from "./panedrag.js";
import { watchBattery, batteryTip, batteryReport } from "./battery.js";
import { watchNetwork, networkTip, networkReport, networkName, networkIcon } from "./network.js";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const clock = (d) => `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "AM" : "PM"}`;
const longDate = (d) => `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
const zoom = () => Number(settings()?.zoom) || 1;

const COMMANDS = {
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
    const item = (id, icon, tip, act) =>
      own(div().id(id).flex_none().w(24).h(24).rounded(3).flex().items_center().justify_center().tooltip(tip).hover((s) => s.bg("#ffffff33")).child(icon).on_click(() => act()));
    const shown = spaces().find((s) => s.active);
    const items = [
      item("ql-desktop", pic("show-desktop", 18), "Show Desktop", () => (shown?.tabs ?? []).filter((t) => !t.settled).forEach((t) => run("tab.settle", { id: t.id }))),
      item("ql-cmd", pic("cmd", 18), "Command Prompt", () => run("tab.new", {})),
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
    return own(
      div()
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
        .on_mouse_down("left", (e, cx) => {
          cx.stop_propagation();
          o.onDown?.(e);
        })
        .on_click(() => o.onClick?.()),
    );
  }

  tasks(P, tabs) {
    const info = tabs.map((t) => {
      const p = lead(t.id);
      return { t, p, key: p?.program && !p.program.shell ? p.program.key : "shell", name: p?.program && !p.program.shell ? p.program.name : "Command Prompt" };
    });
    const tabButton = ({ t, p }) => {
      const pressed = t.active && !t.settled;
      return this.taskButton(P, t.id, {
        label: t.named ? t.name : paneTitle(p) || `Tab ${t.index}`,
        icon: programIcon(p?.program, 15, "#ffffff"),
        pressed,
        flash: t.status === "blocked",
        badge: t.status === "working" || t.status === "done" ? t.status : null,
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
      const status = list.some(({ t }) => t.status === "blocked") ? "blocked" : list.some(({ t }) => t.status === "working") ? "working" : null;
      out.push(
        this.taskButton(P, `g-${key}`, {
          label: `${list.length} ${list[0].name}`,
          icon: programIcon(list[0].p?.program, 15, "#ffffff"),
          pressed: active,
          flash: status === "blocked",
          badge: status === "working" ? "working" : null,
          group: true,
          onDown: (e) => {
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
          .child(h_flex().flex_1().min_w(0).h_full().items_center().gap(3).pl(2).pr(6).children(this.tasks(P, space?.tabs ?? [])))
          .child(this.tray(P)),
      );
  }
}
