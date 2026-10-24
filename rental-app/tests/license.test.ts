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
  const state = {
    codes: new Map<string, { lic?: number; customer: string; name?: string; logoUrl?: string | null; max: number; revoked: boolean; devices: Set<string>; password?: string }>(),
    online: true,
    logoFetches: 0,
  };
  const sign = (payload: object) => {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    return `${Buffer.from(bytes).toString("base64url")}.${Buffer.from(ed.sign(bytes, priv)).toString("base64url")}`;
  };
  let clock = IAT;
  const fetch = (async (url: string, init?: { body: string }) => {
    if (!state.online) throw new Error("offline");
    if (!init) {
      state.logoFetches++;
      return { ok: true, headers: new Map([["content-type", "image/png"]]), arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer, url };
    }
    const b = JSON.parse(init.body);
    const c = state.codes.get(b.key);
    const json = (x: unknown) => ({ json: async () => x });
    if (!c) return json({ ok: false, error: "not_found" });
    if (c.revoked) return json({ ok: false, error: "revoked" });
    if (b.action === "release") {
      c.devices.delete(b.deviceId);
      return json({ ok: true });
    }
    if (b.action === "setPassword" || b.action === "checkPassword") {
      if (!c.devices.has(b.deviceId)) return json({ ok: false, error: "device_removed" });
      const given = b.action === "setPassword" ? b.current : b.password;
      if (c.password && given !== c.password) return json({ ok: false, error: "wrong_password" });
      if (b.action === "setPassword") {
        if (b.next && b.next.length < 4) return json({ ok: false, error: "too_short" });
        c.password = b.next || undefined;
      }
      return json({ ok: true, hasPassword: !!c.password });
    }
    if (!c.devices.has(b.deviceId) && c.password) {
      if (!b.password) return json({ ok: false, error: "password_required" });
      if (b.password !== c.password) return json({ ok: false, error: "wrong_password" });
    }
    if (!c.devices.has(b.deviceId) && c.devices.size >= c.max) return json({ ok: false, error: "full", maxDevices: c.max });
    c.devices.add(b.deviceId);
    const lic = c.lic ?? 1;
    return json({
      ok: true,
      token: sign({ v: 1, lic, customer: c.customer, name: c.name, device: b.deviceId, expiresAt: null, iat: clock, exp: clock + 14 * 86400 }),
      logoUrl: c.logoUrl ?? null,
      hasPassword: !!c.password,
      sync: { email: `tenant-${lic}@x`, password: `pw-${lic}` },
    });
  }) as unknown as typeof globalThis.fetch;
  return {
    state,
    fetch,
    publicKey: ed.etc.bytesToHex(ed.getPublicKey(priv)),
    setClock: (s: number) => (clock = s),
    clock: () => clock,
  };
}

const manager = (s: ReturnType<typeof fakeServer>, deviceId: string, db = freshDb(), onCredentials?: (c: { email: string; password: string }) => void) =>
  createLicenseManager({ db, deviceId, deviceName: "x", platform: "windows", appVersion: "1", url: "x", anonKey: "x", fetch: s.fetch, publicKey: s.publicKey, now: () => s.clock() * 1000, onCredentials });

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
    expect(await manager(s, "stranger").activate("BNYN-AAAA")).toEqual({ ok: false, message: "الكود ده متفعّل على أقصى عدد أجهزة (1) — كلّم MK-Tech لو عايز تزوّد جهاز" });
    // the owner stops the code from the licenses table
    s.state.codes.get("BNYN-AAAA")!.revoked = true;
    expect(await laptop.refresh()).toEqual({ state: "needed", message: "الكود ده اتوقف — كلّم MK-Tech" });
  });

  it("an activation copied to another device is not valid there", async () => {
    const s = fakeServer();
    s.state.codes.set("BNYN-AAAA", { customer: "شركة النور", max: 1, revoked: false, devices: new Set() });
    const db = freshDb();
    expect((await manager(s, "laptop", db).activate("BNYN-AAAA")).ok).toBe(true);
    expect(manager(s, "other-pc", db).status()).toEqual({ state: "needed", message: null });
  });
});

describe("each customer's own company and cloud space", () => {
  it("the code brings the company's name, logo and the login of its own sync space", async () => {
    const s = fakeServer();
    s.state.codes.set("BNYN-NOUR", { lic: 7, customer: "شركة النور للمقاولات", name: "النور", logoUrl: "https://x/logos/nour.png", max: 2, revoked: false, devices: new Set() });
    const logins: { email: string; password: string }[] = [];
    const m = manager(s, "laptop", freshDb(), (c) => logins.push(c));
    const r = await m.activate("BNYN-NOUR");
    expect(r.ok && r.status).toMatchObject({ state: "active", licenseId: 7, name: "النور", customer: "شركة النور للمقاولات", logo: "data:image/png;base64,iVBORw==" });
    expect(logins).toEqual([{ email: "tenant-7@x", password: "pw-7" }]);
    expect(m.credentials()).toEqual({ email: "tenant-7@x", password: "pw-7" });
    // the logo is downloaded once and kept for offline use
    await m.refresh();
    expect(s.state.logoFetches).toBe(1);
    s.state.online = false;
    expect(m.status()).toMatchObject({ logo: "data:image/png;base64,iVBORw==" });
  });

  it("the logo shipped with the app, and a letter badge when there's none", async () => {
    const s = fakeServer();
    s.state.codes.set("BNYN-OWN", { lic: 2, customer: "شركة البنيان للمعدات الثقيلة", name: "البنيان", logoUrl: "bundled:albunyan", max: 4, revoked: false, devices: new Set() });
    s.state.codes.set("BNYN-NONE", { lic: 9, customer: "مؤسسة الفجر", max: 1, revoked: false, devices: new Set() });
    expect(await manager(s, "a").activate("BNYN-OWN")).toMatchObject({ ok: true, status: { logo: "bundled", name: "البنيان" } });
    expect(await manager(s, "b").activate("BNYN-NONE")).toMatchObject({ ok: true, status: { logo: null, name: "مؤسسة الفجر" } });
    expect(s.state.logoFetches).toBe(0);
  });

  it("a device keeps one company's data: another company's code is refused on it", async () => {
    const s = fakeServer();
    s.state.codes.set("BNYN-A", { lic: 1, customer: "أ", max: 2, revoked: false, devices: new Set() });
    s.state.codes.set("BNYN-B", { lic: 2, customer: "ب", max: 2, revoked: false, devices: new Set() });
    const db = freshDb();
    expect((await manager(s, "laptop", db).activate("BNYN-A")).ok).toBe(true);
    expect(await manager(s, "laptop", db).activate("BNYN-B")).toEqual({ ok: false, message: "الجهاز ده عليه بيانات شركة تانية — الكود ده مينفعش عليه" });
    expect(manager(s, "laptop", db).status()).toMatchObject({ state: "active", customer: "أ" });
  });
});

describe("company password and signing out", () => {
  it("asks a new device for the password; devices already in keep checking in without it", async () => {
    const s = fakeServer();
    s.state.codes.set("MKTECH-NOUR", { customer: "شركة النور", max: 3, revoked: false, devices: new Set() });
    const laptop = manager(s, "laptop");
    expect((await laptop.activate("MKTECH-NOUR")).ok).toBe(true);
    expect(laptop.status()).toMatchObject({ state: "active", hasPassword: false });

    // set from the laptop: needs to be 4+ long
    expect(await laptop.setPassword("", "12")).toEqual({ ok: false, message: expect.stringContaining("٤") });
    expect(await laptop.setPassword("", "1234")).toEqual({ ok: true });
    expect(laptop.status()).toMatchObject({ hasPassword: true });
    expect((await laptop.refresh()).state).toBe("active");

    const tablet = manager(s, "tablet");
    expect(await tablet.activate("MKTECH-NOUR")).toMatchObject({ ok: false, needPassword: true });
    expect(await tablet.activate("MKTECH-NOUR", "9999")).toEqual({ ok: false, needPassword: true, message: "الباسورد غلط" });
    expect(await tablet.activate("MKTECH-NOUR", "1234")).toMatchObject({ ok: true, status: { hasPassword: true } });

    // changing it needs the current one
    expect(await tablet.setPassword("0000", "5678")).toEqual({ ok: false, message: "الباسورد الحالي غلط" });
    expect((await tablet.setPassword("1234", "5678")).ok).toBe(true);
  });

  it("the lock screen checks with the server, or — offline — with the last password typed on the device", async () => {
    const s = fakeServer();
    s.state.codes.set("MKTECH-NOUR", { customer: "شركة النور", max: 3, revoked: false, devices: new Set(["laptop"]), password: "1234" });
    const tablet = manager(s, "tablet");
    expect((await tablet.activate("MKTECH-NOUR", "1234")).ok).toBe(true);
    expect(await tablet.checkPassword("1111")).toEqual({ ok: false, message: "الباسورد غلط" });
    s.state.online = false;
    expect(await tablet.checkPassword("1234")).toEqual({ ok: true });
    expect((await tablet.checkPassword("1111")).ok).toBe(false);
    // a device that never typed it can't check it offline
    s.state.online = true;
    const other = manager(s, "phone");
    s.state.codes.get("MKTECH-NOUR")!.password = undefined;
    expect((await other.activate("MKTECH-NOUR")).ok).toBe(true);
    s.state.codes.get("MKTECH-NOUR")!.password = "1234";
    s.state.online = false;
    expect(await other.checkPassword("1234")).toEqual({ ok: false, message: expect.stringContaining("نت") });
  });

  it("signing out frees the device's place and leaves it ready for any code", async () => {
    const s = fakeServer();
    s.state.codes.set("MKTECH-A", { lic: 1, customer: "شركة أ", max: 1, revoked: false, devices: new Set() });
    s.state.codes.set("MKTECH-B", { lic: 2, customer: "شركة ب", max: 1, revoked: false, devices: new Set() });
    const db = freshDb();
    const laptop = manager(s, "laptop", db);
    expect((await laptop.activate("MKTECH-A")).ok).toBe(true);
    // the only place is taken
    expect((await manager(s, "tablet").activate("MKTECH-A")).ok).toBe(false);

    // needs internet, so the place really frees up
    s.state.online = false;
    expect((await laptop.signOut()).ok).toBe(false);
    expect(laptop.status().state).toBe("active");
    s.state.online = true;
    expect(await laptop.signOut()).toEqual({ ok: true });
    expect(laptop.status().state).toBe("needed");
    expect(laptop.credentials()).toBeNull();

    // another device takes the place; this one can enter another company's code
    expect((await manager(s, "tablet").activate("MKTECH-A")).ok).toBe(true);
    expect(await manager(s, "laptop", db).activate("MKTECH-B")).toMatchObject({ ok: true, status: { customer: "شركة ب" } });
  });
});
