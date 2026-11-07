// Herdr Task Manager: Applications (every pane, with XP's statuses: an agent
// that needs you is "Not Responding"), End Task (asks first), Switch To,
// New Task (Run). The status bar's CPU Usage is the share of agents working.

import { props, closeOverlay, panes, agents, spaces, run } from "herdr";
import { div, h_flex, v_flex, pal, pic, frame, menuBar, button, programIcon, paneTitle, openDialog, own } from "./kit.js";

export default class TaskMan {
  init() {
    this.sel = null;
  }

  dismiss() {
    closeOverlay(props()?.overlay);
  }

  render(_cx) {
    const P = pal();
    const ps = panes().filter((p) => p.terminal);
    const sel = ps.find((p) => p.pane === this.sel) ?? null;
    const all = agents();
    const cpu = all.length ? Math.round((100 * all.filter((a) => a.status === "working").length) / all.length) : 0;
    const status = (p) => (p.status === "blocked" ? "Not Responding" : "Running");
    const rows = ps.map((p) =>
      own(
        h_flex()
          .id(`tm-${p.pane}`)
          .h(20)
          .px(4)
          .gap(6)
          .items_center()
          .text_size(11)
          .when(this.sel === p.pane, (el) => el.bg(P.menuHover).text_color("#ffffff"))
          .child(programIcon(p.program, 16))
          .child(div().flex_1().min_w(0).truncate().child(paneTitle(p)))
          .child(div().w(100).flex_none().child(status(p)))
          .on_click((e, cx) => {
            this.sel = p.pane;
            if (e?.click_count >= 2) run("pane.focus", { pane: p.pane });
            cx.notify();
          }),
      ),
    );
    const tabs = ["Applications", "Processes", "Performance", "Networking", "Users"];
    return frame(P, {
      id: "xp-taskman",
      title: "Herdr Task Manager",
      icon: pic("taskman", 16),
      caps: [["ctl-min", () => this.dismiss()], ["ctl-max", () => {}], ["ctl-close", () => this.dismiss()]],
      body: v_flex()
        .size_full()
        .child(
          menuBar(P, "tm", [
            ["File", [{ label: "New Task (Run...)", act: { dialog: "run" } }, { sep: true }, { label: "Exit Task Manager", act: null }]],
            ["Options", [{ label: "Always On Top", checked: true, disabled: true }]],
            ["View", [{ label: "Refresh Now", act: null }]],
            ["Shut Down", [{ label: "Stand By", act: { run: ["window.minimize", {}] } }, { label: "Turn Off", act: { dialog: "turnoff" } }, { label: "Log Off", act: { dialog: "logoff" } }]],
            ["Help", [{ label: "About Herdr XP", act: { dialog: "about" } }]],
          ]),
        )
        .child(
          v_flex()
            .flex_1()
            .min_h(0)
            .p(6)
            .child(h_flex().flex_none().children(tabs.map((t, i) => div().px(6).py(2).text_size(11).rounded_tl(3).rounded_tr(3).border_1().border_color(i === 0 ? "#ffc83c" : P.popupBorder).bg(i === 0 ? P.field : P.face).text_color(i === 0 ? P.faceText : P.faceDim).child(t))))
            .child(
              v_flex()
                .flex_1()
                .min_h(0)
                .p(8)
                .gap(8)
                .bg(P.field)
                .border_1()
                .border_color(P.popupBorder)
                .child(
                  v_flex()
                    .flex_1()
                    .min_h(0)
                    .border_1()
                    .border_color(P.fieldBorder)
                    .bg(P.list)
                    .child(h_flex().flex_none().h(20).px(4).gap(6).items_center().bg(P.face).text_size(11).child(div().w(16)).child(div().flex_1().child("Task")).child(div().w(100).child("Status")))
                    .child(v_flex().flex_1().min_h(0).overflow_hidden().children(rows)),
                )
                .child(
                  h_flex()
                    .flex_none()
                    .justify_end()
                    .gap(6)
                    .child(button(P, "tm-end", "End Task", () =>
                      openDialog("confirm", { title: "End Program", icon: "warning", text: `End '${paneTitle(sel)}'? Its program stops and its pane closes.`, act: { run: ["terminal.kill", { terminal: sel?.terminal }] } }),
                    { disabled: !sel }))
                    .child(button(P, "tm-switch", "Switch To", () => sel && run("pane.focus", { pane: sel.pane }), { disabled: !sel }))
                    .child(button(P, "tm-new", "New Task...", () => openDialog("run"))),
                ),
            ),
        )
        .child(h_flex().flex_none().h(20).px(6).gap(20).items_center().bg(P.face).border_t_1().border_color(P.popupBorder).text_size(11).child(`Processes: ${ps.length}`).child(`CPU Usage: ${cpu}%`).child(`Spaces: ${spaces().length}`)),
    });
  }
}
