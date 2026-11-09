// What Claude reads off a paper sarki photo (the "sarki-read" server function).
// Shared by both programs' review screens; nothing here is saved by itself —
// the user checks the days, types the prices, then saves.

export interface ReadDay {
  day: number;
  worked: boolean;
  hours: number | null;
  overtime: number | null;
  site: string | null;
  note: string | null;
  unclear: boolean;
}
export interface ReadSheet {
  month: string | null;
  equipment: string | null;
  person: string | null;
  site: string | null;
  days: ReadDay[];
  warnings: string[];
}
export type ReadResult = { ok: true; sheet: ReadSheet } | { ok: false; message: string };
export interface ReadRequest {
  /** base64 (no data: prefix) */
  image: string;
  mediaType: string;
  /** the month open in the program, YYYY-MM */
  month?: string;
  hint?: string;
}

export const READ_ERRORS: Record<string, string> = {
  license: "الجهاز ده مش متفعّل على كود شغال",
  limit: "خلصت قرايات النهارده (٦٠ صورة في اليوم) — جرّب بكرة",
  not_configured: "قراية الصور لسه مش متفعّلة — كلّم MK-Tech",
  too_big: "الصورة كبيرة قوي — صوّرها تاني",
  no_image: "مفيش صورة",
  refused: "مقدرش يقرا الصورة دي",
  too_long: "الورقة فيها كلام كتير قوي — صوّر جزء جزء",
  unreadable: "مقدرش يقرا الورقة — صوّرها تاني بإضاءة أحسن",
  busy: "الخدمة مشغولة دلوقتي — جرّب كمان شوية",
  ai_error: "حصلت مشكلة في القراية — جرّب تاني",
  server: "حصلت مشكلة في السيرفر — جرّب تاني",
};

/** Clean what came back: whole days 1..31 in this month, one row per day, in order. */
export function cleanSheet(raw: unknown, daysInMonth = 31): ReadSheet {
  const s = (raw ?? {}) as Partial<ReadSheet>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 48 ? Math.round(v * 100) / 100 : null);
  const t = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null);
  const byDay = new Map<number, ReadDay>();
  for (const d of Array.isArray(s.days) ? s.days : []) {
    const day = Math.trunc(Number(d?.day));
    if (!(day >= 1 && day <= daysInMonth)) continue;
    byDay.set(day, { day, worked: d.worked !== false, hours: n(d.hours), overtime: n(d.overtime), site: t(d.site), note: t(d.note), unclear: !!d.unclear });
  }
  return {
    month: typeof s.month === "string" && /^\d{4}-\d{2}$/.test(s.month) ? s.month : null,
    equipment: t(s.equipment),
    person: t(s.person),
    site: t(s.site),
    days: [...byDay.values()].sort((a, b) => a.day - b.day),
    warnings: Array.isArray(s.warnings) ? s.warnings.filter((w) => typeof w === "string").slice(0, 20) : [],
  };
}

/** A photo from the file picker, smaller (long side ≤ 2000px) and as JPEG, ready to send. */
export async function photoForReading(file: Blob): Promise<{ image: string; mediaType: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => no(new Error("الصورة دي مش مقروءة"));
      i.src = url;
    });
    const scale = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return { image: c.toDataURL("image/jpeg", 0.85).split(",")[1], mediaType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}
