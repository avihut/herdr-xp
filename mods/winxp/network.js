// The computer's network, for the tray's connection icon: which connection
// carries the traffic now (macOS), read every 10 seconds.
//   scutil --nwi              the active interfaces, the primary first
//   networksetup -listallhardwareports   what each is (Wi-Fi, a LAN adapter); read once
//   ifconfig <device>         an Ethernet link's speed ("1000baseT")
// watchNetwork(this, cx) in the taskbar's init; then this.network is
//   { kind: "ethernet" | "wifi" | "other" | "none", device, port, speed }
// ("other": only a VPN tunnel or an interface we can't name; null until the first read).

import { exec } from "herdr";

// Tunnels, bridges and Apple's peer-to-peer links aren't the connection itself.
const VIRTUAL = /^(utun|ipsec|ppp|bridge|awdl|llw|lo|gif|stf|anpi|ap|vmenet|vnic)\d*$/;
let ports = null; // device -> hardware port name

async function hardwarePorts() {
  const out = {};
  try {
    const r = await exec("networksetup", ["-listallhardwareports"]);
    for (const m of r.stdout.matchAll(/Hardware Port: ([^\n]+)\nDevice: (\S+)/g)) out[m[2]] = m[1].trim();
  } catch {}
  return out;
}

function speedOf(ifconfig) {
  const m = /media:[^\n]*\((\d+(?:\.\d+)?)(G?)base/i.exec(ifconfig ?? "");
  if (!m) return null;
  const mbps = Number(m[1]) * (m[2] ? 1000 : 1);
  return mbps >= 1000 ? `${(mbps / 1000).toFixed(1)} Gbps` : `${mbps.toFixed(1)} Mbps`;
}

export async function readNetwork() {
  const r = await exec("scutil", ["--nwi"]);
  const m = /Network interfaces:\s*([^\n]*)/.exec(r.stdout);
  const list = m ? m[1].trim().split(/\s+/).filter(Boolean) : [];
  if (!list.length) return { kind: "none" };
  const device = list.find((d) => !VIRTUAL.test(d));
  if (!device) return { kind: "other", device: list[0] };
  if (!ports || !ports[device]) ports = await hardwarePorts();
  const port = ports[device] ?? device;
  if (/wi-?fi|airport|wlan|wireless/i.test(port)) return { kind: "wifi", device, port };
  let speed = null;
  try {
    speed = speedOf((await exec("ifconfig", [device])).stdout);
  } catch {}
  return { kind: "ethernet", device, port, speed };
}

/** XP's names for it: the connection, and the tooltip's lines. */
export function networkName(n) {
  if (n?.kind === "wifi") return "Wireless Network Connection";
  if (n?.kind === "ethernet") return "Local Area Connection";
  return "Network Connection";
}

export function networkTip(n) {
  if (!n) return "";
  if (n.kind === "none") return "Not connected\nNo network connection is available.";
  if (n.kind === "wifi") return `${networkName(n)}\nStatus: Connected`;
  if (n.kind === "ethernet") return `${networkName(n)}${n.speed ? `\nSpeed: ${n.speed}` : ""}\nStatus: Connected`;
  return `${networkName(n)} (${n.device})\nStatus: Connected`;
}

export function networkReport(n) {
  if (!n || n.kind === "none") return "Status: Not connected\n\nNo network connection is available. Check that the cable is plugged in or that Wi-Fi is turned on.";
  const lines = ["Status: Connected"];
  if (n.speed) lines.push(`Speed: ${n.speed}`);
  if (n.port) lines.push(`Connect using: ${n.port}`);
  if (n.device) lines.push(`Device: ${n.device}`);
  return lines.join("\n");
}

/** The tray picture: img/net-lan, net-wifi or net-off. */
export function networkIcon(n) {
  return n?.kind === "none" ? "net-off" : n?.kind === "wifi" ? "net-wifi" : "net-lan";
}

/** Keeps view.network current (re-rendering when it changes). */
export function watchNetwork(view, cx) {
  view.network ??= null;
  const read = async (cx) => {
    let n = null;
    try {
      n = await readNetwork();
    } catch {
      n = view.network; // a failed read keeps what we knew
    }
    if (JSON.stringify(n) !== JSON.stringify(view.network)) {
      view.network = n;
      cx.notify();
    }
  };
  cx.spawn(read);
  cx.timer.every(10000, (cx) => cx.spawn(read));
}
