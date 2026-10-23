import { describe, expect, it } from "vitest";
import * as ed from "@noble/ed25519";
import { freshDb } from "./helpers";
import { checkToken } from "../core/license/token";
import { createLicenseManager } from "../core/license/manager";

// a real answer from the deployed "license" function (test code, device dev-A)
const SERVER_TOKEN =
  "eyJ2IjoxLCJsaWMiOjEsImN1c3RvbWVyIjoi2KrYrNix2KjYqSDYp9mE2YbYuNin2YUiLCJkZXZpY2UiOiJkZXYtQSIsImV4cGlyZXNBdCI6bnVsbCwiaWF0IjoxNzkyNzYxMTM4LCJleHAiOjE3OTM5NzA3Mzh9.oc6wtaPybM8SusfwctMS6GC3khUZ1payD_B9mGiOatN7fC0qOXwB9bmyprq89hULTRSasvD1R0meJ_o1hotpAw";
const IAT = 1792761138;
const EXP = 1793970738;

describe("activation token", () => {
  it("accepts the server's signature, for this device, until it runs out", () => {
    const ok = checkToken(SERVER_TOKEN, "dev-A", IAT + 60);
    expect(ok).toMatchObject({ ok: true, payload: { customer: "تجربة النظام", device: "dev-A", expiresAt: null } });
    expect(checkToken(SERVER_TOKEN, "dev-B", IAT + 60)).toMatchObject({ ok: false, reason: "device" });
    expect(checkToken(SERVER_TOKEN, "dev-A", EXP)).toMatchObject({ ok: false, reason: "expired" });
  });

  it("rejects an edited token", () => {
    const [body, sig] = SERVER_TOKEN.split(".");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    const forged = Buffer.from(JSON.stringify({ ...payload, device: "dev-B", exp: EXP + 10 ** 8 })).toString("base64url");
    expect(checkToken(`${forged}.${sig}`, "dev-B", IAT)).toMatchObject({ ok: false, reason: "bad" });
    expect(checkToken("rubbish", "dev-A", IAT)).toMatchObject({ ok: false, reason: "bad" });
  });
});

// A fake "license" function with its own key pair and the same rules.
function fakeServer() {
  const priv = ed.utils.randomPrivateKey();
  const state = { codes: new Map<string, { customer: string; max: number; revoked: boolean; devices: Set<string> }>(), online: true };
  const sign = (payload: object) => {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    return `${Buffer.from(bytes).toString("base64url")}.${Buffer.from(ed.sign(bytes, priv)).toString("base64url")}`;
  };
  let clock = IAT;
  const fetch = (async (_url: string, init: { body: string }) => {
    if (!state.online) throw new Error("offline");
    const b = JSON.parse(init.body);
    const c = state.codes.get(b.key);
    const json = (x: unknown) => ({ json: async () => x });
    if (!c) return json({ ok: false, error: "not_found" });
    if (c.revoked) return json({ ok: false, error: "revoked" });
    if (!c.devices.has(b.deviceId) && c.devices.size >= c.max) return json({ ok: false, error: "full", maxDevices: c.max });
    c.devices.add(b.deviceId);
    return json({ ok: true, token: sign({ v: 1, lic: 1, customer: c.customer, device: b.deviceId, expiresAt: null, iat: clock, exp: clock + 14 * 86400 }) });
  }) as unknown as typeof globalThis.fetch;
  return {
    state,
    fetch,
    publicKey: ed.etc.bytesToHex(ed.getPublicKey(priv)),
    setClock: (s: number) => (clock = s),
    clock: () => clock,
  };
}

const manager = (s: ReturnType<typeof fakeServer>, deviceId: string, db = freshDb()) =>
  createLicenseManager({ db, deviceId, deviceName: "x", platform: "windows", appVersion: "1", url: "x", anonKey: "x", fetch: s.fetch, publicKey: s.publicKey, now: () => s.clock() * 1000 });

describe("activation in the app", () => {
  it("locked until a valid code; then works offline until the token runs out", async () => {
    const s = fakeServer();
    s.state.codes.set("BNYN-AAAA", { customer: "شركة النور", max: 2, revoked: false, devices: new Set() });
    const db = freshDb();
    const m = manager(s, "laptop", db);
    expect(m.status()).toEqual({ state: "needed", message: null });
    expect(await m.activate("BNYN-ZZZZ")).toEqual({ ok: false, message: "الكود ده مش صحيح — راجعه تاني" });
    const r = await m.activate("BNYN-AAAA");
    expect(r.ok && r.status).toMatchObject({ state: "active", customer: "شركة النور" });

    // no internet for 10 days: still works; after 14 it asks to check in
    s.state.online = false;
    s.setClock(IAT + 10 * 86400);
    expect((await m.refresh()).state).toBe("active");
    s.setClock(IAT + 15 * 86400);
    expect(await m.refresh()).toEqual({ state: "needed", message: "لازم البرنامج يتصل بالنت مرة عشان يتأكد من الاشتراك" });
    // back online: the saved code renews it by itself
    s.state.online = true;
    expect((await m.refresh()).state).toBe("active");
    // the same saved state on the same device after a restart
    expect(manager(s, "laptop", db).status().state).toBe("active");
  });

  it("a code works on its number of devices only, and stopping it locks at the next check", async () => {
    const s = fakeServer();
    s.state.codes.set("BNYN-AAAA", { customer: "شركة النور", max: 1, revoked: false, devices: new Set() });
    const laptop = manager(s, "laptop");
    expect((await laptop.activate("BNYN-AAAA")).ok).toBe(true);
    // sent the link + code to someone else
    expect(await manager(s, "stranger").activate("BNYN-AAAA")).toEqual({ ok: false, message: "الكود ده متفعّل على أقصى عدد أجهزة (1) — كلّم البنيان لو عايز تزوّد جهاز" });
    // the owner stops the code from the licenses table
    s.state.codes.get("BNYN-AAAA")!.revoked = true;
    expect(await laptop.refresh()).toEqual({ state: "needed", message: "الكود ده اتوقف — كلّم البنيان" });
  });

  it("an activation copied to another device is not valid there", async () => {
    const s = fakeServer();
    s.state.codes.set("BNYN-AAAA", { customer: "شركة النور", max: 1, revoked: false, devices: new Set() });
    const db = freshDb();
    expect((await manager(s, "laptop", db).activate("BNYN-AAAA")).ok).toBe(true);
    expect(manager(s, "other-pc", db).status()).toEqual({ state: "needed", message: null });
  });
});
