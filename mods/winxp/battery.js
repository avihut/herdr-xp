// The computer's battery, for the tray's power icon: `pmset -g batt` (macOS)
// every 30 seconds. On a computer without a battery (or without pmset) it is
// null and the tray shows no power icon. Layout-neutral: the tray draws it.
//   watchBattery(this, cx) in the taskbar's init; then this.battery is
//   null | { pct, ac, state, mins }  (state: charging, discharging, charged, ...)

import { exec } from "herdr";

/** Reads pmset's report: "Now drawing from 'AC Power'" and "-InternalBattery-0 (id=…)	87%; charging; 0:41 remaining present: true". */
export function parseBattery(text) {
  const m = /InternalBattery[^\n]*?(\d+)%;\s*([^;\n]+);\s*([^\n]*)/.exec(text ?? "");
  if (!m) return null;
  const rem = /(\d+):(\d+) remaining/.exec(m[3]);
  const mins = rem ? Number(rem[1]) * 60 + Number(rem[2]) : null;
  return { pct: Math.max(0, Math.min(100, Number(m[1]))), ac: /'AC Power'/.test(text), state: m[2].trim(), mins: mins || null };
}

/** The tray tooltip, in Windows' words. */
export function batteryTip(b) {
  if (!b) return "";
  if (b.ac) {
    if (b.state === "charging" || b.state === "finishing charge") return b.mins ? `Charging (${b.pct}%): ${hm(b.mins)} until full` : `Charging (${b.pct}%)`;
    return b.pct >= 100 || b.state === "charged" ? "Fully charged (100%)" : `On AC power (${b.pct}%)`;
  }
  return b.mins ? `${hm(b.mins)} (${b.pct}%) remaining` : `${b.pct}% remaining`;
}

/** Power Meter's lines: power source and charge. */
export function batteryReport(b) {
  if (!b) return "This computer has no battery.";
  return `Power source: ${b.ac ? "AC power" : "Batteries"}\nTotal battery power remaining: ${b.pct}%\n${batteryTip(b)}`;
}

function hm(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h} hr ${m} min` : `${m} min`;
}

/** Keeps view.battery current (re-rendering when it changes). */
export function watchBattery(view, cx) {
  view.battery ??= null;
  const read = async (cx) => {
    let b = null;
    try {
      const r = await exec("pmset", ["-g", "batt"]);
      b = r.code === 0 ? parseBattery(r.stdout) : null;
    } catch {}
    if (JSON.stringify(b) !== JSON.stringify(view.battery)) {
      view.battery = b;
      cx.notify();
    }
  };
  cx.spawn(read);
  cx.timer.every(30000, (cx) => cx.spawn(read));
}
