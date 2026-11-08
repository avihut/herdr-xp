import {primaryForest} from './workspace-tree.js';
// Explorer windows with XP's blue task pane:
//   mycomputer  your spaces as drives (click one to show it), other machines
//   bin         the Recycle Bin (empty: Herdr closes things for good)
//   games       the Games folder: the games as tiles (one click starts one)

import { props, closeOverlay, spaces, machines, run } from "herdr";
import { div, h_flex, v_flex, pal, bands, grad, pic, frame, menuBar, uiFont, tildePath, own, openWindow } from "./kit.js";

const TITLE = { mycomputer: "My Computer", bin: "Recycle Bin", games: "Games" };
const ICON = { mycomputer: "computer", bin: "bin", games: "games" };

/** What the Games folder holds: role (the window it opens), name, and a line about it. */
export const GAMES = [
  ["freecell", "FreeCell", "32,000 numbered deals"],
  ["mines", "Minesweeper", "Find the mines"],
  ["sol", "Solitaire", "Draw One or Draw Three"],
  ["spider", "Spider Solitaire", "One, two or four suits"],
];

export default class Explorer {
  init(p) {
    this.role = p?.role ?? props()?.role;
    this.sel = null;
    this.folder=p?.space??props()?.space??null;
    this.history=this.folder?[null,this.folder]:[null];this.historyIndex=this.history.length-1;
  }

  locate(id,nodes=primaryForest(),trail=[]) {
    for(const n of nodes){if(n.id===id)return {node:n,trail:[...trail,n]};const found=this.locate(id,n.children,[...trail,n]);if(found)return found;}return null;
  }
  navigate(id,cx,record=true) {
    this.folder=id;this.sel=null;
    if(record){this.history=this.history.slice(0,this.historyIndex+1);this.history.push(id);this.historyIndex++;}
    if(id)run("space.select",{id});cx.notify();
  }
  back(cx,delta) {const at=this.historyIndex+delta;if(at<0||at>=this.history.length)return;this.historyIndex=at;this.navigate(this.history[at],cx,false);}
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
                  .on_click((_e,cx) => act?.(cx)),
              ),
            ),
          ),
      );
  }

  toolbar(P, where) {
    const tool = (icon, label, dis = true, action=null) =>
      h_flex()
        .gap(4)
        .px(4)
        .h(28)
        .items_center()
        .rounded(3)
        .opacity(dis ? 0.5 : 1)
        .on_mouse_down("left",(_e,cx)=>cx.stop_propagation())
        .on_click((_e,cx)=>{if(!dis&&action)action(cx);})
        .child(pic(icon, 22))
        .when(Boolean(label), (el) => el.child(div().text_size(11).child(label)));
    return v_flex()
      .flex_none()
      .bg(P.face)
      .child(h_flex().h(34).px(4).gap(2).items_center().child(tool("back", "Back",this.historyIndex===0,cx=>this.back(cx,-1))).child(tool("forward",null,this.historyIndex>=this.history.length-1,cx=>this.back(cx,1))).child(tool("up",null,!this.folder,cx=>{const path=this.locate(this.folder)?.trail??[];this.navigate(path.at(-2)?.id??null,cx);})).child(div().w(1).h(24).mx(4).bg(P.popupBorder)).child(tool("search", "Search", false)).child(tool("folders", "Folders")))
      .child(
        h_flex()
          .h(24)
          .px(6)
          .gap(6)
          .items_center()
          .border_t_1()
          .border_color(P.popupBorder)
          .child(div().text_size(11).text_color(P.faceDim).child("Address"))
          .child(h_flex().flex_1().h(19).bg(P.field).border_1().border_color(P.fieldBorder).px(3).gap(4).items_center().child(pic(ICON[this.role] ?? "computer", 14)).child(div().text_size(11).child(where)))
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
        .child(pic(s.children.length ? "folder" : s.machine ? "netdrive" : "drive", 32))
        .child(
          v_flex()
            .min_w(0)
            .child(div().truncate().text_size(11).child(s.name))
            .child(div().truncate().text_size(10).opacity(0.7).child(`${s.tabs.length} tab${s.tabs.length===1?"":"s"}${s.children.length?" · "+s.children.length+" child spaces":""} · ${s.machine??"This computer"}`)),
        )
        .on_click((e, cx) => {
          this.sel = s.id;
          if(s.children.length)this.navigate(s.id,cx);else run("space.select",{id:s.id});
          cx.notify();
        }),
    );
  }

  game(P, [role, name, about]) {
    const on = this.sel === role;
    return h_flex()
      .id(`game-${role}`)
      .w(220)
      .gap(8)
      .p(4)
      .items_center()
      .rounded(2)
      .when(on, (el) => el.bg(P.menuHover).text_color("#ffffff"))
      .child(pic(role, 32))
      .child(v_flex().min_w(0).child(div().truncate().text_size(11).child(name)).child(div().truncate().text_size(10).opacity(0.7).child(about)))
      .on_mouse_down("left", (_e, cx) => {
        cx.stop_propagation();
        this.sel = role;
        cx.notify();
      })
      .on_click(() => openWindow(role));
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
    const games = this.role === "games";
    const location=this.folder?this.locate(this.folder):null;
    const title = location?.node.name ?? TITLE[this.role] ?? "My Computer";
    const sp = location ? location.node.children : primaryForest();
    const address=["My Computer",...(location?.trail??[]).map(s=>s.name)].join(" › ");
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
              : games
                ? this.box(P, "Game Tasks", [["games", "Play a random game", () => openWindow(GAMES[Math.floor(Math.random() * GAMES.length)][0])]])
                : location ? this.box(P,"Space Tasks",[["cmd","Open this workspace",()=>run("space.select",{id:location.node.id})],["folder","Parent folder",cx=>{const parent=location.trail.at(-2)?.id??null;this.navigate(parent,cx);}],["cmd","New tab in this workspace",()=>run("tab.new",{space:location.node.id})]]) : this.box(P, "System Tasks", [["info", "View system information", () => run("app.settings", {})], ["control", "Change a setting", () => run("app.settings", {})], ["folder-new", "Add a new space", () => run("space.new", {})]]),
          )
          .child(this.box(P, "Other Places", [bin || games ? ["computer", "My Computer", () => openWindow("mycomputer")] : ["documents", "My Documents", null], ["network", "My Network Places", null], ["control", "Control Panel", () => run("app.settings", {})]])),
      );
    const content = bin
      ? v_flex().flex_1().min_w(0).h_full().p(16).bg(P.list).child(div().text_size(11).text_color(P.faceDim).child("This folder is empty."))
      : games
        ? v_flex().flex_1().min_w(0).h_full().p(14).gap(16).bg(P.list).overflow_hidden().child(this.group(P, "Games", GAMES.map((g) => this.game(P, g))))
        : v_flex()
          .flex_1()
          .min_w(0)
          .h_full()
          .p(14)
          .gap(16)
          .bg(P.list)
          .overflow_y_scrollbar()
          .child(this.group(P, location ? "Child Spaces" : "Spaces Stored on This Computer", local.map((s) => this.drive(P, s))))
          .when(remote.length > 0, (el) => el.child(this.group(P, "Network Spaces", remote.map((s) => this.drive(P, s)))))
          .when(others.length > 0, (el) => el.child(this.group(P, "Other Machines", others.map((m) => h_flex().w(220).gap(8).p(4).items_center().child(pic("network", 32)).child(div().text_size(11).child(`${m.name} (${m.layout})`))))));
    const count = bin ? 0 : games ? GAMES.length : sp.length;
    return frame(P, {
      id: `xp-${this.role}`,
      title,
      icon: pic(ICON[this.role] ?? "computer", 16),
      caps: [["ctl-min", () => this.dismiss()], ["ctl-max", () => {}], ["ctl-close", () => this.dismiss()]],
      body: v_flex()
        .size_full()
        .child(menuBar(P, "ex", [["File", [{ label: "Close", act: null }]], ["Edit", [{ label: "Select All", disabled: true }]], ["View", [{ label: "Tiles", radio: true }, { label: "Icons", disabled: true }]], ["Favorites", [{ label: "(Empty)", disabled: true }]], ["Tools", [{ label: "Folder Options...", act: { run: ["app.settings", {}] } }]], ["Help", [{ label: "About Herdr XP", act: { dialog: "about" } }]]]))
        .child(this.toolbar(P,bin||games?title:address))
        .child(div().flex().flex_row().flex_1().min_h(0).overflow_hidden().child(pane).child(content))
        .child(h_flex().flex_none().h(20).px(6).items_center().bg(P.face).border_t_1().border_color(P.popupBorder).text_size(11).child(`${count} object${count === 1 ? "" : "s"}`)),
    });
  }
}
