# Herdr XP

A Windows XP-style layout for the [Herdr](https://herdr.dev) desktop app: Luna-blue windows around every terminal, console-black terminals, a green start button, the two-column Start menu, Minesweeper, Solitaire and Spider Solitaire, and the Welcome screen.

![Herdr XP](preview.png)

## What's in it

- **Windows.** Every pane is an XP window. Minimize puts its tab away on the taskbar, Maximize zooms the pane, Close closes it. Right-click a title bar for the window menu.
- **Terminals** look like XP's Command Prompt: black, light gray text, the 16 console colors and a bitmap font. They stay that way in light and dark.
- **Taskbar.** The start button, Quick Launch (Show Desktop, Command Prompt, your agents), and a button for each tab of the shown space. When more than five tabs are open, a program's tabs share one button with a count. The notification area shows agents waiting for you, has the chevron that shows hidden icons, and the clock. Right-click the taskbar for its menu.
- **Start menu.** Pinned and often-used programs on the left, with All Programs ▸ Accessories ▸ Games and System Tools. On the right: My Spaces ▸, My Recent Tabs ▸, My Computer, Control Panel, Layouts ▸ (switch to another Herdr layout), Display Properties, Help and Support, Search and Run. At the bottom: Log Off and Turn Off Computer.
- **Desktop.** My Computer, Recycle Bin, each space as a folder (click to show it), Command Prompt and the games. Right-click an icon or the desktop for its menu.
- **Windows of their own.**
  - My Computer, which lists your spaces as drives next to XP's blue task pane.
  - The Recycle Bin.
  - Task Manager. End Task asks first, and an agent that needs you shows as "Not Responding".
  - Minesweeper (Beginner, Intermediate, Expert).
  - Solitaire (Klondike, draw one).
  - Spider Solitaire (one, two or four suits).
- **Dialogs.**
  - Run starts a command in a new tab.
  - Log Off and Switch User go to the Welcome screen, where each of your layouts is a user: click one to switch to it.
  - Turn Off Computer offers Stand By, which minimizes; Turn Off, which quits Herdr while herdr-core keeps your terminals running; and Restart, which shows the boot screen.
  - Display Properties picks light, dark, or following your system.
  - About, and the Desktop Cleanup Wizard.
- **Quirks.** A boot screen the first time it shows, balloon tips from the tray ("Take a tour", the cleanup nag), and startup and shutdown chimes.
- **Light and dark.** The layout follows your system's appearance. Light is Luna with a daytime wallpaper. Dark keeps Luna's blue bars and turns menus, dialogs and Explorer dark, with a night wallpaper.

## Install

You need the Herdr desktop app (tested with 0.1.13) and Python 3.

```sh
git clone https://github.com/avihut/herdr-xp
cd herdr-xp
python3 scripts/install.py
```

With [mise](https://mise.jdx.dev), `mise run install` does the same and then checks the mod.

The script copies `layouts/winxp.json`, the two themes and `mods/winxp` into `~/.config/herdr-app` (or `$HERDR_APP_HOME`). If you have a `keys.json`, it adds Ctrl+Esc to open the Start menu there, unless you already use that key. Herdr treats an edited `keys.json` as yours and stops adding its new default shortcuts to it. The script backs the file up first.

Then switch to it with ⌘⇧L, or run:

```sh
herdr-app do layout.switch '{"name":"winxp"}'
```

Run the install again to update.

## Uninstall

```sh
python3 scripts/install.py --uninstall
```

This removes the layout, the themes, the mod and its key.

## Good to know

- **Fonts.** The UI uses Tahoma and Trebuchet MS when they're installed (macOS has both), and falls back to Verdana or DejaVu Sans otherwise. Terminals use PxPlus IBM VGA 8x16, which ships with Herdr's own Windows 98 layout.
- **Display Properties** changes Herdr's appearance setting (`appearance` in `settings.json`), which applies to every layout.
- **Art and sound.** All art and sounds are original: drawn as SVG and synthesized for this layout. No Microsoft assets are included.
- **Reference values.** Colors and sizes follow [XP.css](https://github.com/botoxparty/XP.css) and [winXP](https://github.com/ShizukuIchi/winXP), both MIT.

## License

[MIT](LICENSE)
