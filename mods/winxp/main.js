import {View as WorkspaceTreeView} from 'gpui-kit';
import {props as workspaceTreeProps} from 'herdr';
import {WorkspaceTree,initSpaceHierarchy,primaryRows,nestedSpaceRow} from './workspace-tree.js';
// Herdr XP: a Windows XP-style layout for the Herdr app, as one mod in roles.
// The layout and overlays give each copy props { role }:
//   taskbar     start button, Quick Launch, tab buttons, notification area;
//               runs the keys' commands, the first-run boot and the balloons
//   desktop     icons over the wallpaper; keeps the wallpaper light or dark
//   window      a pane's title bar (the layout's pane header); drag it to move the window
//   panedrag    the see-through layer that follows a dragged title bar (panedrag.js)
//   panelbar    the header of the Explorer bar, docked right
//   folders, changes   its two bars: the focused folder as XP's tree, and its Git changes (repo.js)
//   start       the Start menu        menu     a popup menu (cascading)
//   dialog      Run, Log Off, Turn Off, Display Properties, About, ...
//   boot        the boot screen       welcome  the Welcome screen
//   balloon     a notification balloon above the tray
//   clippy      the Office Assistant's balloon (the desktop draws the paperclip)
//   mycomputer, bin, games   Explorer windows with the task pane (games: the Games folder)
//   taskman     Task Manager
//   mines, sol, spider, freecell   Minesweeper and the card games (cardtable.js)

import { View, div } from "gpui-kit";
import { props } from "herdr";
import Taskbar from "./taskbar.js";
import Desktop from "./desktop.js";
import PaneWindow from "./window.js";
import StartMenu from "./start.js";
import Menu from "./menu.js";
import Dialog from "./dialog.js";
import { Boot, Welcome, Balloon } from "./screens.js";
import Explorer from "./explorer.js";
import TaskMan from "./taskman.js";
import Mines from "./mines.js";
import Sol from "./sol.js";
import Spider from "./spider.js";
import FreeCell from "./freecell.js";
import PaneDrag from "./panedrag.js";
import PanelBar from "./panel.js";
import Folders from "./folders.js";
import Changes from "./changes.js";
import Clippy from "./clippy.js";

const ROLES = {
  taskbar: Taskbar, desktop: Desktop, window: PaneWindow, start: StartMenu, menu: Menu, dialog: Dialog,
  boot: Boot, welcome: Welcome, balloon: Balloon, mycomputer: Explorer, bin: Explorer, games: Explorer, taskman: TaskMan,
  mines: Mines, sol: Sol, spider: Spider, freecell: FreeCell, panedrag: PaneDrag, panelbar: PanelBar, folders: Folders, changes: Changes, clippy: Clippy,
};

class WinXP extends View {
  init(p, cx) {
    const pr = props() ?? p ?? {};
    const R = ROLES[pr.role];
    this.role = R ? new R() : null;
    this.role?.init?.(pr, cx);
  }

  render(cx) {
    if (!this.role) return div().child(`winxp: no role "${props()?.role}"`);
    return this.role.render(cx);
  }

  async close(cx) {
    await this.role?.close?.(cx);
  }
}

export default class GroupedLayout extends WinXP {
 init(p,cx){const pr={...(p??{}),...(workspaceTreeProps()??{})};if(pr.role==='workspace-tree'){this.workspaceTree=new WorkspaceTree();this.workspaceTree.init(pr,cx);}else {super.init?.(p,cx);if(['side','sidebar','desktop'].includes(pr.role))this.hierarchyReader=initSpaceHierarchy(cx);}}
 render(cx){return this.workspaceTree?this.workspaceTree.render(cx):super.render(cx);}
 async close(cx){if(this.workspaceTree)await this.workspaceTree.close?.(cx);else await super.close?.(cx);}
}
