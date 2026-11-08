// The focused pane's folder and its Git changes, for the Folders and Changes bars. Layout-neutral
// (no drawing), so another layout's mod can copy this file as it is.
//   where()                       { cwd, on, key }: the focused pane's folder (on: its machine)
//   listFolder(path, on)          [{ name, dir }], folders first, without .git
//   gitMarks(cwd, on)             { root, marks: { "<abs path>": "A" | "M" | "D" | "U" } } (root: null outside Git)
//   readChanges(cwd, on)          { root, hasHead, files: [{ path, status, fresh, add, del, binary }], limited }
//   fileDiff(state, file)         the diff's lines (hunks from "@@"), or one line saying why there are none
//   diffRows(lines)               [{ kind: "@" | "+" | "-" | " " | "", number, text }]
//   commitAll(root, on, message)  git add -A, then git commit -m message

import { spaces, panes, focused, exec, readTextFile } from "herdr";
import { readdir } from "fs/promises";

/** Reads write nothing under .git (no index lock or refresh, no fsmonitor cookie), so a folder
 *  watch doesn't see them and start the next refresh. */
const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "diff.autoRefreshIndex=false", "-c", "diff.ignoreSubmodules=all"];
// Every read also leaves submodules alone (Git would run inside them, under their own config) and
// runs no external diff or text conversion (both can name a command in the repository's config).
const STATUS = ["status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all", "--ignore-submodules=all"];
const SAFE_DIFF = ["--no-ext-diff", "--no-textconv", "--ignore-submodules=all"];
export const PER_FOLDER = 500;
const MAX_FILES = 1000;
const MAX_LINES = 1500;

export function where() {
  const space = spaces().find((s) => s.active);
  const f = focused();
  const pane = f?.pane ? panes().find((p) => p.pane === f.pane) : null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  const cwd = pane?.cwd || f?.cwd || space?.folder || null;
  return { cwd, on, key: JSON.stringify([cwd, on]) };
}

const byKind = (a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });

export async function listFolder(path, on) {
  let out;
  if (!on) {
    const entries = await readdir(path, { withFileTypes: true });
    out = entries.map((e) => ({ name: e.name, dir: e.isDirectory() }));
  } else {
    // Another machine: list with its shell. "d" or "f", a NUL, the name, a NUL.
    const script = 'for p in "$1"/* "$1"/.[!.]* "$1"/..?*; do [ -e "$p" ] || [ -L "$p" ] || continue; if [ -d "$p" ]; then printf "d\\0%s\\0" "${p##*/}"; else printf "f\\0%s\\0" "${p##*/}"; fi; done';
    const r = await exec("sh", ["-c", script, "list", path], { on });
    if (r.code !== 0) throw new Error(r.stderr || "Cannot list this folder");
    const parts = r.stdout.split("\0");
    out = [];
    for (let i = 0; i + 1 < parts.length; i += 2) out.push({ name: parts[i + 1], dir: parts[i] === "d" });
  }
  return out.filter((e) => e.name && e.name !== ".git").sort(byKind);
}

async function gitRoot(cwd, on) {
  const r = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on }).catch(() => null);
  return r?.code === 0 ? r.stdout.trim() : null;
}

/** git status and diff run a repository's filter commands (clean, process) on files whose stat
 *  info changed. A repository whose own config defines filters (an unpacked archive with its .git,
 *  say) could run anything that way, so the bars don't read it on their own. Filters from your
 *  global or system config (Git LFS) are yours and fine. Reading config runs nothing. */
export const UNTRUSTED = "This repository sets its own Git filters, so it isn't read automatically.";
async function ownFilters(root, on) {
  const r = await exec("git", ["config", "--show-scope", "--get-regexp", "^filter\\."], { cwd: root, on }).catch(() => null);
  if (r?.code === 1 && !r.stderr.trim()) return false; // no filters anywhere
  if (r?.code !== 0) return true; // couldn't tell: don't read it
  return r.stdout.split("\n").some((l) => /^(local|worktree|command)\s/.test(l));
}

const statusOf = (xy) => (xy.includes("U") || xy === "AA" || xy === "DD" ? "U" : xy.includes("D") ? "D" : xy === "??" || xy.includes("A") ? "A" : "M");

export async function gitMarks(cwd, on) {
  const root = await gitRoot(cwd, on);
  const marks = {};
  if (!root || (await ownFilters(root, on))) return { root, marks };
  const r = await exec("git", [...READ, ...STATUS], { cwd: root, on }).catch(() => null);
  if (r?.code === 0) for (const e of r.stdout.split("\0").filter(Boolean).slice(0, 5000)) marks[`${root}/${e.slice(3)}`] = statusOf(e.slice(0, 2));
  return { root, marks };
}

export async function readChanges(cwd, on) {
  const root = await gitRoot(cwd, on);
  if (!root) return { root: null, files: [], error: "Not a Git repository" };
  if (await ownFilters(root, on)) return { root: null, files: [], error: UNTRUSTED };
  const git = (args) => exec("git", [...READ, ...args], { cwd: root, on });
  const status = await git(STATUS);
  if (status.code !== 0) throw new Error(status.stderr);
  const hasHead = (await git(["rev-parse", "--verify", "HEAD"])).code === 0;
  const stats = {};
  const counts = hasHead ? [await git(["diff", "HEAD", ...SAFE_DIFF, "--numstat", "-z", "--no-renames"])] : [await git(["diff", "--cached", ...SAFE_DIFF, "--numstat", "-z", "--no-renames"]), await git(["diff", ...SAFE_DIFF, "--numstat", "-z", "--no-renames"])];
  for (const r of counts) {
    if (r.code !== 0) throw new Error(r.stderr);
    for (const entry of r.stdout.split("\0")) {
      const [a, d, ...rest] = entry.split("\t");
      if (!rest.length) continue;
      const path = rest.join("\t");
      const was = stats[path] ?? { add: 0, del: 0 };
      stats[path] = { add: was.add + (Number(a) || 0), del: was.del + (Number(d) || 0), binary: a === "-" };
    }
  }
  const entries = status.stdout.split("\0").filter(Boolean);
  const files = entries.slice(0, MAX_FILES).map((e) => {
    const xy = e.slice(0, 2);
    const path = e.slice(3);
    return { path, status: statusOf(xy), fresh: xy === "??", ...(stats[path] ?? { add: 0, del: 0 }) };
  });
  return { root, on, hasHead, files, limited: entries.length > MAX_FILES };
}

const countLines = (text) => (text ? text.split("\n").length - Number(text.endsWith("\n")) : 0);

export async function fileDiff(state, file) {
  const { root, on, hasHead } = state;
  let lines;
  if (file.fresh || (!hasHead && file.status === "A")) {
    const text = await readTextFile(`${root}/${file.path}`, { on }).catch(() => null);
    if (text === null) return ["Cannot show this file (binary, too large or unreadable)"];
    if (text.includes("\0")) return ["Binary file: no text to compare"];
    file.add = countLines(text);
    lines = [`@@ -0,0 +1,${file.add} @@`, ...text.slice(0, 400000).replace(/\n$/, "").split("\n").map((l) => `+${l}`)];
  } else {
    const r = await exec("git", [...READ, "diff", ...(hasHead ? ["HEAD"] : []), ...SAFE_DIFF, "--no-color", "--", file.path], { cwd: root, on });
    if (r.code !== 0) throw new Error(r.stderr);
    const all = r.stdout.replace(/\n$/, "").split("\n");
    const first = all.findIndex((l) => l.startsWith("@@"));
    lines = first < 0 ? [file.binary ? "Binary file changed" : "No text changes"] : all.slice(first);
  }
  return lines.slice(0, MAX_LINES).map((l) => (l.length > 4000 ? `${l.slice(0, 4000)}… (line cut)` : l));
}

export function diffRows(lines) {
  let old = 0;
  let next = 0;
  return lines.map((line) => {
    const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(line);
    if (m) {
      old = +m[1];
      next = +m[2];
      return { kind: "@", text: line };
    }
    const kind = line[0];
    if (kind === "-") return { kind, number: old++, text: line.slice(1) || " " };
    if (kind === "+") return { kind, number: next++, text: line.slice(1) || " " };
    if (kind === " ") {
      old++;
      return { kind, number: next++, text: line.slice(1) || " " };
    }
    return { kind: "", text: line };
  });
}

export async function commitAll(root, on, message) {
  for (const args of [["add", "-A"], ["commit", "-m", message]]) {
    const r = await exec("git", args, { cwd: root, on });
    if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim());
  }
}
