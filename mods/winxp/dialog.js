// Dialogs (props { kind, ... }), each in an XP window:
//   run      Run: a command, started in a new tab (Browse... picks its folder)
//   logoff   Log Off: Switch User or Log Off, both to the Welcome screen
//   turnoff  Turn off computer: Stand By (minimize), Turn Off (quit Herdr;
//            herdr-core keeps the terminals), Restart (the boot screen)
//   confirm  a question with Yes/No: { title, text, icon, act }
//   display  Display Properties: the Windows XP theme, light or dark
//   about    About Herdr XP
//   cleanup  the Desktop Cleanup Wizard

import { props, closeOverlay, run, pickFolder, updates, spaces, agents, settings, shared, appHome, readTextFile, writeTextFile } from "herdr";
import { InputState, Input } from "gpui-base";
import { div, h_flex, v_flex, pal, bands, grad, pic, frame, button, uiFont, titleFont, userName, shadowed, perform, openDialog, sfx, own } from "./kit.js";

function words(cmd) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(cmd))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

const TITLES = { message: "Herdr", run: "Run", logoff: "Log Off Herdr", turnoff: "Turn off computer", display: "Display Properties", about: "About Herdr XP", cleanup: "Desktop Cleanup Wizard" };

export default class Dialog {
  init(p, cx) {
    this.kind = p?.kind ?? props()?.kind;
    this.appearance = "auto"; // the settings.json `appearance`: auto (follow macOS), light, dark
    if (this.kind === "display") {
      cx.spawn(async (cx) => {
        try {
          const text = await readTextFile(`${appHome()}/settings.json`);
          const a = text ? JSON.parse(text).appearance : null;
          this.appearance = a === "light" || a === "dark" ? a : "auto";
        } catch {}
        cx.notify();
      });
    }
    this.page = 0;
    if (this.kind === "run") {
      this.input = InputState.new({ placeholder: "", value: shared("winxp.lastRun") ?? "" });
      this.input.on("submit", () => this.runIt());
      cx.timer.after(60, () => this.input?.focus());
    }
    if (this.kind === "confirm" || this.kind === "turnoff" || this.kind === "logoff") sfx("ding");
  }

  dismiss() {
    closeOverlay(props()?.overlay);
  }

  runIt() {
    const cmd = (this.input?.value() ?? "").trim();
    if (!cmd) return;
    this.dismiss();
    run("tab.new", { name: words(cmd)[0], argv: words(cmd) });
  }

  // ---- bodies

  runBody(P) {
    return v_flex()
      .size_full()
      .p(10)
      .gap(10)
      .child(h_flex().gap(12).items_start().child(pic("run", 32)).child(div().flex_1().text_size(11).child("Type the name of a program, and Herdr will start it for you in a new tab.")))
      .child(
        h_flex()
          .gap(8)
          .items_center()
          .child(div().w(36).text_size(11).child("Open:"))
          .child(own(div().flex_1().h(21).bg(P.field).border_1().border_color(P.fieldBorder).px(3).flex().items_center().text_size(12).text_color(P.faceText).child(Input.new(this.input).w_full()))),
      )
      .child(div().flex_1())
      .child(
        h_flex()
          .justify_end()
          .gap(6)
          .child(button(P, "run-ok", "OK", () => this.runIt(), { isDefault: true }))
          .child(button(P, "run-cancel", "Cancel", () => this.dismiss()))
          .child(
            button(P, "run-browse", "Browse...", (_e, cx) =>
              cx.spawn(async () => {
                const folder = await pickFolder({ prompt: "Open" });
                if (folder) {
                  this.dismiss();
                  run("tab.new", { folder });
                }
              }),
            ),
          ),
      );
  }

  /** The dark blue XP sheet behind Log Off and Turn Off: banner, gradient body, buttons, Cancel. */
  sheet(P, title, buttons) {
    const round = ([id, label, iconName, tip, act]) =>
      v_flex()
        .id(`sh-${id}`)
        .items_center()
        .gap(6)
        .tooltip(tip)
        .child(div().id(`sh-${id}~b`).rounded(6).hover((s) => s.opacity(0.85)).child(pic(iconName, 34)))
        .child(div().text_size(11).text_color("#ffffff").child(label))
        .on_click(() => {
          this.dismiss();
          act();
        });
    return v_flex()
      .id("xp-sheet")
      .size_full()
      .font_family(uiFont())
      .rounded(6)
      .overflow_hidden()
      .border_1()
      .border_color("#0a246a")
      .child(
        div()
          .relative()
          .flex_none()
          .h(44)
          .bg("#00309c")
          .child(h_flex().relative().size_full().items_center().justify_between().px(12).child(div().font_family(titleFont()).text_size(15).child(shadowed(title, "#ffffff", "#001c5c"))).child(pic("flag", 26)))
          .child(div().absolute().bottom(0).left(0).w_full().h(2).child(grad("#00309c", "#ffffff", 90))),
      )
      .child(div().relative().flex_1().child(grad("#5a7edc", "#3a5cc7")).child(h_flex().relative().size_full().items_center().justify_around().px(20).children(buttons.map(round))))
      .child(
        div()
          .relative()
          .flex_none()
          .h(42)
          .bg("#00309c")
          .child(h_flex().relative().size_full().items_center().justify_end().px(12).child(button({ ...P, faceText: "#000000", button: ["#ffffff", "#ece9d8", "#d6d0c5"], buttonBorder: "#003c74" }, "sh-cancel", "Cancel", () => this.dismiss(), { w: 66 }))),
      );
  }

  logoffBody(P) {
    return this.sheet(P, "Log Off Herdr", [
      ["switch", "Switch User", "users", "Pick another layout on the Welcome screen", () => openDialog("welcome", { mode: "switch" })],
      ["logoff", "Log Off", "logoff", "Go to the Welcome screen", () => {
        sfx("logoff");
        openDialog("welcome", { mode: "logoff" });
      }],
    ]);
  }

  turnoffBody(P) {
    return this.sheet(P, "Turn off computer", [
      ["standby", "Stand By", "standby", "Minimize the window", () => run("window.minimize", {})],
      ["turnoff", "Turn Off", "power", "Quit Herdr; herdr-core keeps your terminals running", () => {
        sfx("shutdown");
        run("app.quit", {});
      }],
      ["restart", "Restart", "restart", "Show the boot screen again", () => openDialog("boot")],
    ]);
  }

  confirmBody(P) {
    const p = props() ?? {};
    return v_flex()
      .size_full()
      .p(12)
      .gap(12)
      .child(h_flex().gap(12).items_start().child(pic(p.icon ?? "question", 32)).child(div().flex_1().text_size(11).child(String(p.text ?? ""))))
      .child(div().flex_1())
      .child(
        h_flex()
          .justify_center()
          .gap(8)
          .child(button(P, "cf-yes", "Yes", () => {
            this.dismiss();
            perform(p.act);
          }, { isDefault: true }))
          .child(button(P, "cf-no", "No", () => this.dismiss())),
      );
  }

  /** Writes Herdr's `appearance` (settings.json): every layout follows it, this one too. */
  applyAppearance(cx) {
    const want = this.appearance;
    cx.spawn(async () => {
      const path = `${appHome()}/settings.json`;
      try {
        const text = await readTextFile(path);
        const doc = text ? JSON.parse(text) : {};
        if (want === "auto") delete doc.appearance;
        else doc.appearance = want;
        await writeTextFile(path, JSON.stringify(doc, null, 2) + "\n", text ?? null);
      } catch (e) {
        console.log(`winxp: appearance: ${e}`);
      }
    });
  }

  displayBody(P) {
    const opt = (key, label) =>
      own(
        h_flex()
          .id(`th-${key}`)
          .px(4)
          .h(18)
          .items_center()
          .text_size(11)
          .when(this.appearance === key, (el) => el.bg(P.menuHover).text_color("#ffffff"))
          .child(label)
          .on_click((_e, cx) => {
            this.appearance = key;
            cx.notify();
          }),
      );
    const tabs = ["Themes", "Desktop", "Screen Saver", "Appearance", "Settings"];
    const dark = this.appearance === "dark" || (this.appearance === "auto" && P.dark);
    const preview = dark ? "wallpaper-night" : "wallpaper-day";
    return v_flex()
      .size_full()
      .p(8)
      .child(
        h_flex()
          .flex_none()
          .children(
            tabs.map((t, i) =>
              div()
                .px(8)
                .py(3)
                .text_size(11)
                .rounded_tl(3)
                .rounded_tr(3)
                .border_1()
                .border_color(i === 0 ? "#ffc83c" : P.popupBorder)
                .bg(i === 0 ? P.field : P.face)
                .text_color(i === 0 ? P.faceText : P.faceDim)
                .child(t),
            ),
          ),
      )
      .child(
        v_flex()
          .flex_1()
          .min_h(0)
          .p(10)
          .gap(8)
          .bg(P.field)
          .border_1()
          .border_color(P.popupBorder)
          .child(div().text_size(11).child("A theme is a background plus a set of colors to help you personalize your computer with one click."))
          .child(div().text_size(11).child("Theme:"))
          .child(
            v_flex()
              .border_1()
              .border_color(P.fieldBorder)
              .bg(P.field)
              .child(opt("auto", "Windows XP (follow macOS)"))
              .child(opt("light", "Windows XP"))
              .child(opt("dark", "Windows XP (Dark)")),
          )
          .child(div().text_size(11).child("Sample:"))
          .child(
            div()
              .relative()
              .flex_1()
              .min_h(0)
              .rounded(3)
              .overflow_hidden()
              .border_1()
              .border_color(P.fieldBorder)
              .child(pic(preview, 0).absolute().top(0).left(0).size_full())
              .child(
                v_flex()
                  .absolute()
                  .top(18)
                  .left(30)
                  .w(200)
                  .h(90)
                  .rounded_tl(6)
                  .rounded_tr(6)
                  .overflow_hidden()
                  .bg(P.frame)
                  .child(div().relative().flex_none().h(18).child(bands(P.title)).child(div().relative().pl(6).pt(2).text_size(10).font_weight(700).text_color("#ffffff").child("Active Window")))
                  .child(div().flex_1().mx(2).mb(2).bg("#000000").p(4).font_family("PxPlus IBM VGA 8x16").text_size(10).text_color("#c0c0c0").child("C:\\> _")),
              ),
          )
          .child(div().text_size(10).text_color(P.faceDim).child("Applies to every Herdr layout (Herdr's appearance setting).")),
      )
      .child(
        h_flex()
          .flex_none()
          .justify_end()
          .gap(6)
          .pt(8)
          .child(button(P, "dp-ok", "OK", (_e, cx) => {
            this.applyAppearance(cx);
            this.dismiss();
          }, { isDefault: true }))
          .child(button(P, "dp-cancel", "Cancel", () => this.dismiss()))
          .child(button(P, "dp-apply", "Apply", (_e, cx) => this.applyAppearance(cx))),
      );
  }

  messageBody(P) {
    const p = props() ?? {};
    return v_flex()
      .size_full()
      .p(12)
      .gap(10)
      .child(h_flex().gap(12).items_start().child(pic(p.icon ?? "info", 32)).child(v_flex().flex_1().gap(2).text_size(11).children(String(p.text ?? "").split("\n").map((l) => div().child(l)))))
      .child(div().flex_1())
      .child(h_flex().justify_center().child(button(P, "msg-ok", "OK", () => this.dismiss(), { isDefault: true })));
  }

  aboutBody(P) {
    const u = (() => {
      try {
        return updates();
      } catch {
        return null;
      }
    })();
    return v_flex()
      .size_full()
      .child(
        div()
          .relative()
          .flex_none()
          .h(78)
          .child(grad("#0a246a", "#3a6ea5", 90))
          .child(
            h_flex()
              .relative()
              .size_full()
              .items_center()
              .gap(10)
              .px(16)
              .child(pic("flag", 44))
              .child(h_flex().items_end().gap(4).child(div().font_family(titleFont()).font_weight(700).text_size(28).text_color("#ffffff").child("Herdr")).child(div().font_family(titleFont()).italic().font_weight(700).text_size(22).text_color("#ff8c1a").child("xp"))),
          ),
      )
      .child(div().flex_none().h(4).child(grad("#e5862d", "#ffd27a", 90)))
      .child(
        v_flex()
          .flex_1()
          .p(14)
          .gap(6)
          .text_size(11)
          .child(div().child("Herdr XP"))
          .child(div().child(`Herdr ${u?.app?.version ?? ""} · herdr-core ${u?.core?.version ?? ""} (xpsp3_agents.2600)`))
          .child(div().child("A Windows XP-style layout for the Herdr app. Original art and code, MIT license."))
          .child(div().pt(8).child(`This layout is licensed to:`))
          .child(div().pl(12).font_weight(700).child(userName()))
          .child(div().pt(8).child(`Spaces available to Herdr: ${spaces().length}    Agents running: ${agents().length}`)),
      )
      .child(h_flex().flex_none().justify_end().p(10).child(button(P, "ab-ok", "OK", () => this.dismiss(), { isDefault: true })));
  }

  cleanupBody(P) {
    const pages = [
      ["Welcome to the Desktop Cleanup Wizard", "This wizard helps you clean up your desktop by moving unused shortcuts to a desktop folder called Unused Desktop Shortcuts.\n\nShortcuts are considered unused if they have not been used in the last 60 days."],
      ["Completing the Desktop Cleanup Wizard", `Every icon on your desktop is in use: your ${spaces().length} space${spaces().length === 1 ? " is" : "s are"} busy herding agents.\n\nNo shortcuts were moved. To close this wizard, click Finish.`],
    ];
    const [head, text] = pages[this.page];
    return v_flex()
      .size_full()
      .child(
        h_flex()
          .flex_1()
          .min_h(0)
          .child(div().relative().flex_none().w(140).h_full().child(grad("#3a6ea5", "#7ab3e7")).child(v_flex().relative().size_full().items_center().justify_center().gap(8).child(pic("cleanup", 64))))
          .child(v_flex().flex_1().p(16).gap(12).bg(P.field).child(div().font_family(titleFont()).font_weight(700).text_size(16).child(head)).child(div().text_size(11).child(text))),
      )
      .child(div().flex_none().h(1).bg(P.popupBorder))
      .child(
        h_flex()
          .flex_none()
          .justify_end()
          .gap(6)
          .p(10)
          .child(button(P, "cw-back", "< Back", () => {}, { disabled: this.page === 0 }))
          .child(
            this.page === 0
              ? button(P, "cw-next", "Next >", (_e, cx) => {
                  this.page = 1;
                  cx.notify();
                }, { isDefault: true })
              : button(P, "cw-finish", "Finish", () => this.dismiss(), { isDefault: true }),
          )
          .child(button(P, "cw-cancel", "Cancel", () => this.dismiss(), { disabled: this.page === 1 })),
      );
  }

  render(_cx) {
    const P = pal();
    const k = this.kind;
    if (k === "logoff") return this.logoffBody(P);
    if (k === "turnoff") return this.turnoffBody(P);
    const p = props() ?? {};
    const body = k === "message" ? this.messageBody(P) : k === "run" ? this.runBody(P) : k === "confirm" ? this.confirmBody(P) : k === "display" ? this.displayBody(P) : k === "about" ? this.aboutBody(P) : k === "cleanup" ? this.cleanupBody(P) : div().child(`winxp: no dialog "${k}"`);
    return frame(P, {
      id: `xp-dlg-${k}`,
      title: k === "confirm" || k === "message" ? (p.title ?? "Herdr") : TITLES[k] ?? "Herdr",
      icon: pic(k === "run" ? "run" : k === "display" ? "display-props" : k === "cleanup" ? "cleanup" : k === "about" ? "info" : "flag", 16),
      caps: [["ctl-help", () => run("app.help", {})], ["ctl-close", () => this.dismiss()]],
      body,
    });
  }
}
