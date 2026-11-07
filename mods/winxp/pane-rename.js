// Copy into the host layout's own mod folder. It has no imports from the optional mod.
import { shared, readTextFile, appHome, openOverlay } from "herdr";

export function renamedPane(p) {
  if (!p?.pane) return null;
  const key = `pane-rename.v1:${JSON.stringify([p.pane, p.terminal ?? null, p.mod ?? null])}`;
  const name = shared(key);
  return typeof name === "string" && name ? name : null;
}

// Call once as the native menu opens; never call in render or on a polling timer.
export async function paneRenameAvailable() {
  try {
    const text = await readTextFile(`${appHome()}/mods/pane-rename/mod.json`);
    return JSON.parse(text ?? "null")?.pane_rename_api === 1;
  } catch {
    return false;
  }
}

// Call only from a menu whose availability check succeeded. Capture the clicked ID.
export function openPaneRename(pane) {
  if (typeof pane !== "string" || !pane) return;
  return openOverlay({ mod: "pane-rename", kind: "dialog", frame: "none", width: 460, props: { pane } });
}
