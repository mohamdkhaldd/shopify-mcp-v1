import { FormEvent, useEffect, useState } from "react";
import Icon from "../components/Icon";
import { ask } from "../components/Dialogs";
import { Certificate, certificatesApi, equipmentApi } from "../api/client";
import Modal from "../components/Modal";
import PrintButton from "../components/PrintButton";
import { PrintHeader } from "../components/PrintSignoff";
import { compressImageFile } from "../utils/image";
import { daysUntil, dueText } from "./Obligations";

export const CERT_KINDS = [
  { value: "calibration", label: "شهادة معايرة" },
  { value: "battery", label: "ضمان بطارية" },
  { value: "other", label: "ورقة تانية (ترخيص، تأمين…)" },
] as const;
const kindLabel = (v: string) => CERT_KINDS.find((k) => k.value === v)?.label ?? "ورقة";
const cls = "rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white w-full";

// شهادات المعايرة وضمان البطاريات: صورة الورقة + تاريخ البداية والانتهاء،
// والرئيسية بتنبّه قبل ما تخلص بـ ٥ أيام.
export default function Certificates() {
  const [list, setList] = useState<Certificate[]>([]);
  const [equipment, setEquipment] = useState<{ id: number; name: string }[]>([]);
  const [edit, setEdit] = useState<Partial<Certificate> | null>(null);
  const [view, setView] = useState<string | null>(null);
  const refresh = () => certificatesApi.list().then(setList);
  useEffect(() => {
    refresh();
    equipmentApi.list().then(setEquipment);
  }, []);

  return (
    <div className="space-y-6">
      <PrintHeader title="شهادات المعايرة والضمانات" />
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">شهادات المعايرة والضمانات</h1>
          <p className="text-sm text-slate-500 mt-1">صوّر الورقة واكتب تاريخ البداية والانتهاء — الرئيسية هتنبهك قبل ما تخلص بـ ٥ أيام.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setEdit({ kind: "calibration" })} className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-bold hover:bg-primary-dark">
            + شهادة / ضمان
          </button>
          <PrintButton />
        </div>
      </div>

      {list.length === 0 ? (
        <div className="bg-white rounded-card shadow-card p-8 text-center text-slate-400">لسه مفيش شهادات.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((c) => {
            const d = daysUntil(c.end_date);
            const tone = d < 0 ? "bg-rose-50 text-rose-700" : d <= 5 ? "bg-amber-50 text-amber-700" : "bg-primary-light text-primary-dark";
            return (
              <div key={c.id} className="bg-white rounded-card shadow-card overflow-hidden flex flex-col">
                {c.image ? (
                  <button onClick={() => setView(c.image)} className="h-40 bg-slate-100">
                    <img src={c.image} alt="" className="w-full h-full object-cover" />
                  </button>
                ) : (
                  <div className="h-24 bg-slate-50 flex items-center justify-center text-slate-300"><Icon name="doc" className="w-8 h-8" /></div>
                )}
                <div className="p-4 space-y-1 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <b className="text-slate-800">{kindLabel(c.kind)}</b>
                    <span className={`text-xs font-bold rounded-lg px-2 py-1 ${tone}`}>{d < 0 ? `خلصت من ${-d} يوم` : `تخلص ${dueText(d)}`}</span>
                  </div>
                  <div className="text-sm text-slate-600">
                    {c.equipment_name ? `معدة ${c.equipment_name}` : "عامة"}
                    {c.title && ` — ${c.title}`}
                  </div>
                  <div className="text-xs text-slate-400">
                    {c.start_date ? `من ${c.start_date} ` : ""}لحد {c.end_date}
                  </div>
                  {c.note && <div className="text-xs text-slate-500">{c.note}</div>}
                </div>
                <div className="no-print flex gap-3 px-4 pb-3">
                  <button onClick={() => setEdit(c)} className="text-xs font-bold text-slate-500 hover:text-primary-dark">
                    <Icon name="edit" className="w-3.5 h-3.5" /> تعديل
                  </button>
                  <button
                    onClick={async () => {
                      if (!(await ask("تمسح الشهادة دي؟"))) return;
                      await certificatesApi.remove(c.id);
                      refresh();
                    }}
                    className="text-xs font-bold text-rose-500"
                  >
                    <Icon name="trash" className="w-3.5 h-3.5" /> مسح
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {edit && <EditDialog cert={edit} equipment={equipment} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); refresh(); }} />}
      {view && (
        <Modal title="الصورة" onClose={() => setView(null)}>
          <img src={view} alt="" className="w-full rounded-lg" />
        </Modal>
      )}
    </div>
  );
}

function EditDialog({ cert, equipment, onClose, onSaved }: { cert: Partial<Certificate>; equipment: { id: number; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [c, setC] = useState<Partial<Certificate>>(cert);
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await certificatesApi.save({ ...c, image: image ?? undefined } as Certificate);
      onSaved();
    } catch (err) {
      setError((err as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    }
  }
  return (
    <Modal title={c.id ? "تعديل" : "شهادة / ضمان جديد"} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-slate-600">
          النوع
          <select value={c.kind ?? "calibration"} onChange={(e) => setC({ ...c, kind: e.target.value })} className={cls}>
            {CERT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-600">
          المعدة
          <select value={c.equipment_id ?? ""} onChange={(e) => setC({ ...c, equipment_id: e.target.value ? Number(e.target.value) : null })} className={cls}>
            <option value="">عامة (مش على معدة)</option>
            {equipment.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-600 sm:col-span-2">
          البيان
          <input value={c.title ?? ""} onChange={(e) => setC({ ...c, title: e.target.value })} placeholder="زي: معايرة الميزان، بطارية فارتا" className={cls} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-600">
          تاريخ البداية
          <input type="date" value={c.start_date ?? ""} onChange={(e) => setC({ ...c, start_date: e.target.value })} className={cls} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-600">
          تاريخ الانتهاء
          <input type="date" value={c.end_date ?? ""} onChange={(e) => setC({ ...c, end_date: e.target.value })} className={cls} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-600 sm:col-span-2">
          صورة الورقة
          <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImage(await compressImageFile(f)); }} className="text-sm" />
          {(image || c.image) && <img src={image ?? c.image ?? ""} alt="" className="mt-1 h-28 rounded-lg object-cover" />}
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-600 sm:col-span-2">
          ملاحظة
          <input value={c.note ?? ""} onChange={(e) => setC({ ...c, note: e.target.value })} placeholder="اختياري" className={cls} />
        </label>
        {error && <div className="sm:col-span-2 text-sm text-rose-600 font-semibold">{error}</div>}
        <div className="sm:col-span-2 flex gap-2">
          <button type="submit" disabled={!c.end_date} className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50">
            حفظ
          </button>
          <button type="button" onClick={onClose} className="bg-slate-100 text-slate-600 rounded-lg px-4 py-2 text-sm font-bold">
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
