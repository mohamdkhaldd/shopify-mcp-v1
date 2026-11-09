import { ChangeEvent, useEffect, useRef, useState } from "react";
import { paperSheetsApi } from "../../api/client";
import { PaperSheet } from "../../api/types";
import { compressImageFile, rotateImage } from "../../utils/image";
import ReadToSheet from "./ReadToSheet";

// السركي الورقي اللي بيتاخد من الشركة: صورة (أو أكتر) لكل شهر، بتتعرض
// وتتطبع على قد ورقة A4.
export default function PaperSheets({ equipmentId, month }: { equipmentId: number; month: string }) {
  const [sheets, setSheets] = useState<PaperSheet[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  // صورة السركي اللي Claude بيقراها دلوقتي (عشان تتسجل في شيت المقاول)
  const [reading, setReading] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const refresh = () => paperSheetsApi.list(equipmentId, month).then(setSheets);
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentId, month]);

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setError("");
    try {
      for (const f of files) {
        const image = await compressImageFile(f);
        await paperSheetsApi.create({ equipment_id: equipmentId, month, image, note: null });
      }
      await refresh();
    } catch (err) {
      if ((err as Error)?.name !== "CancelledError") setError(String((err as Error)?.message ?? err));
    } finally {
      setBusy(false);
    }
  }

  async function rotate(s: PaperSheet, clockwise: boolean) {
    setBusy(true);
    try {
      await paperSheetsApi.replace(s.id, await rotateImage(s.image, clockwise));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: PaperSheet) {
    if (!window.confirm("تمسح صورة السركي دي؟")) return;
    await paperSheetsApi.remove(s.id);
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="no-print bg-white rounded-card shadow-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-800">السركي الورقي من الشركة</h2>
          <p className="text-xs text-slate-400 mt-1">صوّر الورقة أو ارفع صورتها — بتتعرض وتتطبع على قد ورقة A4، وبتدخل في ملف الشريك.</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={upload} />
          <button
            onClick={() => input.current?.click()}
            disabled={busy}
            className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
          >
            {busy ? "جاري الحفظ..." : "📷 ارفع صورة السركي"}
          </button>
        </div>
      </div>
      {error && <div className="no-print rounded-xl bg-rose-50 text-rose-700 px-4 py-2.5 text-sm font-semibold">{error}</div>}
      {done && <div className="no-print rounded-xl bg-emerald-50 text-emerald-700 px-4 py-2.5 text-sm font-semibold">{done}</div>}
      {reading && (
        <ReadToSheet
          key={reading.slice(-40)}
          equipmentId={equipmentId}
          month={month}
          image={reading}
          onClose={(saved) => {
            setReading(null);
            if (saved) setDone(`اتسجل ${saved} يوم في شيت المقاول من صورة السركي`);
          }}
        />
      )}

      {sheets.length === 0 ? (
        <div className="no-print bg-white rounded-card shadow-card p-8 text-center text-sm text-slate-400">لسه مفيش صورة للسركي الورقي الشهر ده.</div>
      ) : (
        sheets.map((s) => (
          <div key={s.id} className="paper-sheet">
            <div className="no-print flex items-center justify-end gap-3 mb-2 text-xs font-semibold">
              <button
                onClick={() => (setDone(""), setReading(s.image))}
                className="text-primary hover:text-primary-dark"
                disabled={busy || !!reading}
                title="البرنامج يقرا الأيام والساعات والأوفر من الصورة، وانت تراجع وتكتب السعر"
              >
                🤖 اقرا وسجّل في شيت المقاول
              </button>
              <button onClick={() => rotate(s, false)} className="text-slate-500 hover:text-primary" disabled={busy}>
                ↺ لف شمال
              </button>
              <button onClick={() => rotate(s, true)} className="text-slate-500 hover:text-primary" disabled={busy}>
                ↻ لف يمين
              </button>
              <button onClick={() => remove(s)} className="text-rose-500 hover:text-rose-700">
                مسح
              </button>
            </div>
            <div className="paper-sheet-page mx-auto bg-white shadow-card rounded-lg overflow-hidden flex items-center justify-center" style={{ aspectRatio: "210 / 297", maxWidth: 760 }}>
              <img src={s.image} alt="السركي الورقي" className="w-full h-full object-contain" />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
