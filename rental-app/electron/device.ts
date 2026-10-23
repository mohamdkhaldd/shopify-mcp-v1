import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { app } from "electron";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

// A stable id for this computer, so an activation can't be copied to another
// one with the data folder: Windows' MachineGuid (survives reinstalling the
// app), /etc/machine-id on Linux, a saved random id as a last resort.
function machineId(): string {
  try {
    if (process.platform === "win32") {
      const out = execFileSync("reg", ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"], { encoding: "utf8", windowsHide: true });
      const m = out.match(/MachineGuid\s+REG_SZ\s+(\S+)/);
      if (m) return m[1];
    }
    if (process.platform === "linux" && fs.existsSync("/etc/machine-id")) return fs.readFileSync("/etc/machine-id", "utf8").trim();
  } catch {
    /* fall through */
  }
  const file = path.join(app.getPath("userData"), "device-id");
  if (!fs.existsSync(file)) fs.writeFileSync(file, bytesToHex(crypto.getRandomValues(new Uint8Array(16))));
  return fs.readFileSync(file, "utf8").trim();
}

export function deviceIdentity() {
  return {
    deviceId: bytesToHex(sha256(`albunyan-rental:${machineId()}`)).slice(0, 32),
    deviceName: os.hostname(),
    platform: process.platform === "win32" ? ("windows" as const) : ("other" as const),
  };
}
