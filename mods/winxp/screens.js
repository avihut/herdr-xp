// Full-window screens and the tray's balloon tips:
//   boot     black boot screen: logo and the sliding blue progress blocks
//   welcome  XP's Welcome screen. Every layout is a user (the same list as
//            Start ▸ Layouts): click the current one to log back on, another
//            to switch to it (Fast User Switching)
//   balloon  a yellow notification balloon above the tray

import { props, closeOverlay, run, agents, setShared } from "herdr";
import { div, h_flex, v_flex, pal, grad, pic, uiFont, titleFont, shadowed, userName, layoutList, sfx, openDialog } from "./kit.js";

function logo(size) {
  return h_flex()
    .items_end()
    .gap(size * 0.12)
    .child(pic("flag", size * 1.4))
    .child(div().font_family(titleFont()).font_weight(700).text_size(size).text_color("#ffffff").child("Herdr"))
    .child(div().font_family(titleFont()).italic().font_weight(700).text_size(size * 0.75).text_color("#ff8c1a").child("xp"));
}

export class Boot {
  init(p, cx) {
    this.then = p?.then ?? props()?.then ?? null;
    cx.timer.after(3200, () => {
      closeOverlay(props()?.overlay);
      sfx("startup");
      if (this.then === "tour") setShared("winxp.balloon", { kind: "tour", at: Date.now() });
    });
  }

  render(_cx) {
    const block = (delay) =>
      div()
        .absolute()
        .top(2)
        .w(9)
        .h(8)
        .rounded(1)
        .overflow_hidden()
        .child(grad("#9fb4ff", "#2838c7"))
        .loop("left", { from: -30 + delay, to: 160 + delay, period: 2000 });
    return v_flex()
      .id("xp-boot")
      .size_full()
      .bg("#000000")
      .items_center()
      .justify_center()
      .gap(30)
      .font_family(uiFont())
      .child(v_flex().items_center().gap(4).child(logo(40)).child(div().text_size(13).text_color("#c8c8c8").child("Agent Edition")))
      .child(div().relative().w(150).h(14).rounded(4).border_2().border_color("#b2b2b2").overflow_hidden().child(block(0)).child(block(11)).child(block(22)))
      .child(div().absolute().bottom(20).left(24).text_size(11).text_color("#8c8c8c").child("Copyright © Herdr XP contributors"));
  }
}

const PICTURES = ["user", "flower", "chess", "rocket"];

export class Welcome {
  init(p) {
    this.mode = p?.mode ?? props()?.mode ?? "logoff";
  }

  close() {
    closeOverlay(props()?.overlay);
  }

  tile(L, i) {
    const running = agents().length;
    const sub = L.current ? (this.mode === "switch" ? `${running} program${running === 1 ? "" : "s"} running` : "Logged on") : null;
    return h_flex()
      .id(`wl-${L.name}`)
      .w(340)
      .gap(12)
      .items_center()
      .p(6)
      .rounded(8)
      .border_1()
      .border_color("#00000000")
      .hover((s) => s.bg("#ffffff1f").border_color("#ffffff66"))
      .child(div().flex_none().rounded(6).border_2().border_color(L.current ? "#ffc83c" : "#ffffffcc").overflow_hidden().child(pic(PICTURES[i % PICTURES.length], 52)))
      .child(
        v_flex()
          .gap(2)
          .child(div().font_family(titleFont()).text_size(17).child(shadowed(L.current ? `${L.title} (${userName()})` : L.title, "#ffffff", "#0a246a")))
          .when(Boolean(sub), (el) => el.child(div().text_size(11).text_color("#cfe0ff").child(sub))),
      )
      .on_click(() => {
        this.close();
        if (L.current) sfx("startup");
        else run("layout.switch", { name: L.name });
      });
  }

  render(_cx) {
    const list = layoutList();
    return v_flex()
      .id("xp-welcome")
      .size_full()
      .font_family(uiFont())
      .child(div().relative().flex_none().h(80).bg("#00309c").child(div().absolute().bottom(0).left(0).w_full().h(2).child(grad("#00309c", "#9fc0ff", 90))))
      .child(
        div()
          .relative()
          .flex_1()
          .child(grad("#6b8fe0", "#4a72d6", 135))
          .child(
            h_flex()
              .relative()
              .size_full()
              .child(v_flex().flex_1().items_end().justify_center().pr(40).gap(10).child(logo(34)).child(div().text_size(15).text_color("#ffffff").child("To begin, click your user name")))
              .child(div().flex_none().w(1).h(320).my_auto().child(grad("#ffffff00", "#ffffffcc")))
              .child(v_flex().flex_1().justify_center().pl(40).gap(10).children(list.map((L, i) => this.tile(L, i)))),
          ),
      )
      .child(
        div()
          .relative()
          .flex_none()
          .h(80)
          .bg("#00309c")
          .child(div().absolute().top(0).left(0).w_full().h(2).child(grad("#00309c", "#ff8c1a", 90)))
          .child(
            h_flex()
              .relative()
              .size_full()
              .items_center()
              .justify_between()
              .px(30)
              .child(
                h_flex()
                  .id("wl-off")
                  .gap(8)
                  .items_center()
                  .rounded(4)
                  .p(4)
                  .hover((s) => s.bg("#ffffff1f"))
                  .child(pic("power", 26))
                  .child(div().text_size(13).text_color("#ffffff").child("Turn off Herdr"))
                  .on_click(() => {
                    this.close();
                    openDialog("turnoff");
                  }),
              )
              .child(div().max_w(360).text_size(11).text_color("#cfe0ff").child("After you log on, you can add or change layouts. Just go to the Start menu and point to Layouts.")),
          ),
      );
  }
}

const BALLOONS = {
  tour: { icon: "tour", title: "Take a tour of Herdr XP", text: "To learn about the exciting new features in Herdr XP, click here.", act: () => run("app.help", {}) },
  cleanup: { icon: "cleanup", title: "Unused desktop icons", text: "There are unused icons on your desktop. Click this balloon to see and clean them up.", act: () => openDialog("cleanup") },
};

export class Balloon {
  init(p, cx) {
    this.kind = p?.kind ?? props()?.kind ?? "tour";
    sfx("balloon");
    cx.timer.after(15000, () => this.close());
  }

  close() {
    closeOverlay(props()?.overlay);
    setShared("winxp.balloonId", null);
  }

  render(_cx) {
    const P = pal();
    const b = BALLOONS[this.kind] ?? BALLOONS.tour;
    return v_flex()
      .id("xp-balloon")
      .size_full()
      .font_family(uiFont())
      .child(
        v_flex()
          .id("xp-balloon-body")
          .flex_1()
          .rounded(7)
          .border_1()
          .border_color(P.balloonBorder)
          .bg(P.balloon)
          .p(8)
          .gap(4)
          .text_color(P.faceText)
          .child(
            h_flex()
              .gap(6)
              .items_center()
              .child(pic(b.icon, 16))
              .child(div().flex_1().text_size(11).font_weight(700).child(b.title))
              .child(div().id("xp-balloon-x").px(4).rounded(2).text_size(11).hover((s) => s.bg("#00000022")).child("✕").on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(() => this.close())),
          )
          .child(div().text_size(11).child(b.text))
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_click(() => {
            this.close();
            b.act();
          }),
      )
      .child(h_flex().flex_none().h(12).justify_end().pr(30).child(pic(P.dark ? "balloon-tail-dark" : "balloon-tail", 14).mt(-1)));
  }
}
