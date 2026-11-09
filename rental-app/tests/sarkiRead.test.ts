import { describe, expect, it } from "vitest";
import { freshDb } from "./helpers";
import { cleanSheet } from "../core/ai/sarkiRead";
import { createLicenseManager } from "../core/license/manager";

describe("what Claude read off a paper sarki", () => {
  it("keeps one row per real day of the month, in order, with sane numbers", () => {
    const s = cleanSheet(
      {
        month: "2026-02",
        equipment: " لودر ٩٥٠ ",
        days: [
          { day: 3, worked: true, hours: 10, overtime: null, site: "الموقع", note: null, unclear: false },
          { day: 1, worked: false, hours: null, overtime: null, site: null, note: "جمعة", unclear: false },
          { day: 30, worked: true, hours: 8, overtime: 2, site: null, note: null, unclear: true },
          { day: 3, worked: true, hours: 9, overtime: null, site: null, note: null, unclear: false },
          { day: 0, worked: true, hours: 8 },
          { day: 5, worked: true, hours: 900 },
        ],
        warnings: ["يوم ٣٠ مش واضح", 5],
      },
      28,
    );
    expect(s.equipment).toBe("لودر ٩٥٠");
    expect(s.days.map((d) => d.day)).toEqual([1, 3, 5]);
    expect(s.days[1]).toMatchObject({ hours: 9 });
    expect(s.days[2].hours).toBeNull();
    expect(s.warnings).toEqual(["يوم ٣٠ مش واضح"]);
    expect(cleanSheet(null).days).toEqual([]);
  });

  it("the app sends the photo with its code and device, and nothing is saved", async () => {
    const db = freshDb();
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('license_key', 'MKTECH-AAAA-BBBB-CCCC')").run();
    const sent: { url: string; body: Record<string, unknown> }[] = [];
    const fetch = (async (url: string, init: { body: string }) => {
      sent.push({ url, body: JSON.parse(init.body) });
      return { json: async () => ({ ok: true, sheet: { days: [{ day: 2, worked: true, hours: 8, overtime: 1, site: null, note: null, unclear: false }], warnings: [] } }) };
    }) as unknown as typeof globalThis.fetch;
    const m = createLicenseManager({ db, deviceId: "dev-1", deviceName: "x", platform: "web", appVersion: "1", url: "https://x.supabase.co/functions/v1/license", anonKey: "k", fetch });
    const r = await m.readSarki({ image: "abc", mediaType: "image/jpeg", month: "2026-03" });
    expect(r).toMatchObject({ ok: true, sheet: { days: [{ day: 2, hours: 8, overtime: 1 }] } });
    expect(sent[0].url).toBe("https://x.supabase.co/functions/v1/sarki-read");
    expect(sent[0].body).toMatchObject({ key: "MKTECH-AAAA-BBBB-CCCC", deviceId: "dev-1", image: "abc", month: "2026-03" });
    const err = createLicenseManager({ db, deviceId: "dev-1", deviceName: "x", platform: "web", appVersion: "1", url: "u/license", anonKey: "k", fetch: (async () => ({ json: async () => ({ ok: false, error: "limit" }) })) as unknown as typeof globalThis.fetch });
    expect(await err.readSarki({ image: "a", mediaType: "image/jpeg" })).toMatchObject({ ok: false, message: expect.stringContaining("٦٠") });
  });
});
