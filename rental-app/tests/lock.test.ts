import { describe, expect, it } from "vitest";
import { freshDb } from "./helpers";
import { createLock } from "../core/shell/lock";

// MK-Tech's optional password on a device: set and changed by the customer,
// asked when the app opens and after "خروج", reset with the activation code.

describe("the device password", () => {
  it("is off until set, then checked, changed with the old one, and removed", () => {
    const lock = createLock({ db: freshDb(), savedKey: () => "MKTECH-EEEB-UX3X-83HZ" });
    expect(lock.hasPassword()).toBe(false);
    expect(lock.setPassword("", "12")).toEqual({ ok: false, message: expect.stringContaining("٤") });
    expect(lock.setPassword("", "1234")).toEqual({ ok: true });
    expect(lock.hasPassword()).toBe(true);
    expect(lock.check("1234")).toBe(true);
    expect(lock.check("4321")).toBe(false);
    // changing or removing it needs the current one
    expect(lock.setPassword("0000", "5678").ok).toBe(false);
    expect(lock.setPassword("1234", "5678").ok).toBe(true);
    expect(lock.check("5678")).toBe(true);
    expect(lock.setPassword("5678", "").ok).toBe(true);
    expect(lock.hasPassword()).toBe(false);
  });

  it("is reset with this device's activation code, however it is typed", () => {
    const lock = createLock({ db: freshDb(), savedKey: () => "MKTECH-EEEB-UX3X-83HZ" });
    lock.setPassword("", "1234");
    expect(lock.resetWithCode("MKTECH-XXXX-XXXX-XXXX")).toBe(false);
    expect(lock.hasPassword()).toBe(true);
    expect(lock.resetWithCode(" mktech eeeb ux3x 83hz ")).toBe(true);
    expect(lock.hasPassword()).toBe(false);
  });

  it("lets the program the chooser opened start without asking again — once, and only soon after", () => {
    let t = 1_000_000;
    const lock = createLock({ db: freshDb(), savedKey: () => null, now: () => t });
    const pass = lock.issuePass();
    expect(lock.takePass("wrong")).toBe(false);
    // a wrong try uses it up
    expect(lock.takePass(pass)).toBe(false);
    const again = lock.issuePass();
    expect(lock.takePass(again)).toBe(true);
    expect(lock.takePass(again)).toBe(false);
    const late = lock.issuePass();
    t += 3 * 60 * 1000;
    expect(lock.takePass(late)).toBe(false);
  });
});
