import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";

// An activation is a token signed by the "license" cloud function (see
// cloud/functions/license). Only the public key lives in the app: it can check
// a token but never make one, so editing the saved token breaks it.
ed.etc.sha512Sync = (...m: Uint8Array[]) => sha512(ed.etc.concatBytes(...m));

export const LICENSE_PUBLIC_KEY = "aea509b039cbe7a416fe107ebf40acfab7eaa519e0308a15e025165fbbe23208";

export interface LicensePayload {
  v: 1;
  lic: number;
  customer: string;
  device: string;
  /** last day of the subscription (yyyy-mm-dd), null = open-ended */
  expiresAt: string | null;
  iat: number;
  /** seconds; the app must check in with the server before this (14 days, or the subscription's end) */
  exp: number;
}

export type TokenCheck = { ok: true; payload: LicensePayload } | { ok: false; reason: "bad" | "device" | "expired"; payload?: LicensePayload };

function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function checkToken(token: string, deviceId: string, nowSec: number, publicKey = LICENSE_PUBLIC_KEY): TokenCheck {
  const [body, sig] = token.split(".");
  if (!body || !sig) return { ok: false, reason: "bad" };
  let payload: LicensePayload;
  try {
    const bytes = fromB64url(body);
    if (!ed.verify(fromB64url(sig), bytes, publicKey)) return { ok: false, reason: "bad" };
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return { ok: false, reason: "bad" };
  }
  if (payload.device !== deviceId) return { ok: false, reason: "device", payload };
  if (nowSec >= payload.exp) return { ok: false, reason: "expired", payload };
  return { ok: true, payload };
}
