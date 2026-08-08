import { useState } from "react";
import {
  addContractor,
  addEmployee,
  addEquipment,
  addExpenseCategory,
  addPartner,
  listContractors,
  listEmployees,
  listEquipment,
  listExpenseCategories,
  listPartners,
  pushAllToCloud,
} from "../store";
import { WageType } from "../types";
import { signOut } from "../auth";

type Kind = "drivers" | "contractors" | "partners" | "equipment" | "categories";

const KINDS: { id: Kind; label: string }[] = [
  { id: "drivers", label: "السائقين" },
  { id: "contractors", label: "المقاولين" },
  { id: "partners", label: "الشركاء" },
  { id: "equipment", label: "المعدات" },
  { id: "categories", label: "أنواع المصروفات" },
];

export default function Settings() {
  const [kind, setKind] = useState<Kind>("drivers");
  const [, forceRefresh] = useState(0);
  const refresh = () => forceRefresh((n) => n + 1);
  const [syncing, setSyncing] = useState(false);

  return (
    <div>
      <div className="bg-primary text-white px-4 pt-6 pb-3">
        <div className="text-xs opacity-80 font-bold">دفتر البنيان</div>
        <div className="text-lg font-extrabold mt-0.5">الإعدادات</div>
      </div>

      <div className="p-4">
        <button
          onClick={() => {
            setSyncing(true);
            pushAllToCloud();
            setTimeout(() => setSyncing(false), 1200);
          }}
          disabled={syncing}
          className="w-full mb-4 bg-primary-light border border-primary/30 text-primary-dark rounded-xl py-2.5 text-sm font-bold disabled:opacity-60"
        >
          {syncing ? "جاري الإرسال..." : "🔄 ابعت كل البيانات للسحابة دلوقتي"}
        </button>

        <button onClick={() => signOut()} className="w-full mb-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl py-2.5 text-sm font-bold">
          تسجيل الخروج
        </button>

        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => setKind(k.id)}
              className={[
                "rounded-lg border py-2 text-center text-[11px] font-bold",
                kind === k.id ? "border-primary bg-primary-light text-primary-dark" : "border-slate-200 bg-white text-slate-500",
              ].join(" ")}
            >
              {k.label}
            </button>
          ))}
        </div>

        {kind === "drivers" && <DriversPanel onChanged={refresh} />}
        {kind === "contractors" && <ContractorsPanel onChanged={refresh} />}
        {kind === "partners" && <PartnersPanel onChanged={refresh} />}
        {kind === "equipment" && <EquipmentPanel onChanged={refresh} />}
        {kind === "categories" && <CategoriesPanel onChanged={refresh} />}
      </div>
    </div>
  );
}

function DriversPanel({ onChanged }: { onChanged: () => void }) {
  const [name, setName] = useState("");
  const [wageType, setWageType] = useState<WageType>("daily");
  const [rate, setRate] = useState("");
  const items = listEmployees();

  function save() {
    if (!name.trim() || !rate) return;
    addEmployee(name.trim(), wageType, Number(rate) || 0, false);
    setName("");
    setRate("");
    onChanged();
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl shadow-card p-4 space-y-2">
        <div className="text-sm font-extrabold text-slate-700">إضافة سائق</div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">الاسم</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم السائق" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">نوع الأجر</label>
          <select value={wageType} onChange={(e) => setWageType(e.target.value as WageType)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="daily">أجر يومي</option>
            <option value="monthly">مرتب شهري</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">السعر / المرتب</label>
          <input type="number" value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <button onClick={save} disabled={!name.trim() || !rate} className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
          إضافة السائق
        </button>
      </div>
      <div className="space-y-2">
        {items.map((i) => (
          <div key={i.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-center justify-between text-sm">
            <div>
              <div className="font-bold text-slate-700">{i.name}</div>
              <div className="text-[10.5px] text-slate-400">{i.wage_type === "daily" ? "أجر يومي" : "مرتب شهري"} — {i.rate} ج.م</div>
            </div>
            {i.addedOnMobile && <span className="text-[9.5px] font-bold bg-primary-light text-primary-dark px-2 py-0.5 rounded-full">جديد</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ContractorsPanel({ onChanged }: { onChanged: () => void }) {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("0");
  const items = listContractors();

  function save() {
    if (!name.trim()) return;
    addContractor(name.trim(), Number(balance) || 0);
    setName("");
    setBalance("0");
    onChanged();
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl shadow-card p-4 space-y-2">
        <div className="text-sm font-extrabold text-slate-700">إضافة مقاول</div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">الاسم</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المقاول" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">الرصيد الافتتاحي</label>
          <input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} inputMode="decimal" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <button onClick={save} disabled={!name.trim()} className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
          إضافة المقاول
        </button>
      </div>
      <div className="space-y-2">
        {items.map((i) => (
          <div key={i.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-center justify-between text-sm">
            <div>
              <div className="font-bold text-slate-700">{i.name}</div>
              <div className="text-[10.5px] text-slate-400">الرصيد الافتتاحي: {i.opening_balance} ج.م</div>
            </div>
            {i.addedOnMobile && <span className="text-[9.5px] font-bold bg-primary-light text-primary-dark px-2 py-0.5 rounded-full">جديد</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PartnersPanel({ onChanged }: { onChanged: () => void }) {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("0");
  const items = listPartners();

  function save() {
    if (!name.trim()) return;
    addPartner(name.trim(), Number(balance) || 0);
    setName("");
    setBalance("0");
    onChanged();
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl shadow-card p-4 space-y-2">
        <div className="text-sm font-extrabold text-slate-700">إضافة شريك</div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">الاسم</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الشريك" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">الرصيد الافتتاحي</label>
          <input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} inputMode="decimal" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <button onClick={save} disabled={!name.trim()} className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
          إضافة الشريك
        </button>
      </div>
      <div className="space-y-2">
        {items.map((i) => (
          <div key={i.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-center justify-between text-sm">
            <div>
              <div className="font-bold text-slate-700">{i.name}</div>
              <div className="text-[10.5px] text-slate-400">الرصيد الافتتاحي: {i.opening_balance} ج.م</div>
            </div>
            {i.addedOnMobile && <span className="text-[9.5px] font-bold bg-primary-light text-primary-dark px-2 py-0.5 rounded-full">جديد</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

interface ShareDraft {
  partner_id: string;
  percentage: string;
}

function EquipmentPanel({ onChanged }: { onChanged: () => void }) {
  const partners = listPartners();
  const items = listEquipment();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [shares, setShares] = useState<ShareDraft[]>([{ partner_id: "", percentage: "" }]);

  function updateShare(index: number, patch: Partial<ShareDraft>) {
    setShares((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }
  function addShareRow() {
    setShares((prev) => [...prev, { partner_id: "", percentage: "" }]);
  }
  function removeShareRow(index: number) {
    setShares((prev) => prev.filter((_, i) => i !== index));
  }
  const shareTotal = shares.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0);

  function save() {
    if (!name.trim()) return;
    const validShares = shares
      .filter((s) => s.partner_id && s.percentage)
      .map((s) => ({ partner_id: Number(s.partner_id), percentage: Number(s.percentage) || 0 }));
    addEquipment(name.trim(), Number(price) || 0, validShares);
    setName("");
    setPrice("0");
    setShares([{ partner_id: "", percentage: "" }]);
    onChanged();
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl shadow-card p-4 space-y-2">
        <div className="text-sm font-extrabold text-slate-700">إضافة معدة</div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">اسم المعدة</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="زي: بوكيت أصفر" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">سعر الشراء</label>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">نسب الشركاء</label>
          <div className="space-y-2">
            {shares.map((s, i) => (
              <div key={i} className="flex gap-1.5">
                <select value={s.partner_id} onChange={(e) => updateShare(i, { partner_id: e.target.value })} className="flex-1 rounded-xl border border-slate-200 px-2 py-2 text-xs">
                  <option value="">اختر شريك</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={s.percentage}
                  onChange={(e) => updateShare(i, { percentage: e.target.value })}
                  placeholder="%"
                  inputMode="decimal"
                  className="w-16 rounded-xl border border-slate-200 px-2 py-2 text-xs"
                />
                {shares.length > 1 && (
                  <button onClick={() => removeShareRow(i)} className="text-rose-500 px-1">
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={addShareRow} className="text-xs font-bold text-primary-dark mt-2">
            + إضافة شريك تاني
          </button>
          {shareTotal > 0 && (
            <div className={["text-[10.5px] font-bold mt-1", shareTotal === 100 ? "text-primary-dark" : "text-amber-600"].join(" ")}>
              إجمالي النسب: {shareTotal}٪{shareTotal !== 100 && " (المفروض تكون 100٪)"}
            </div>
          )}
        </div>
        <button onClick={save} disabled={!name.trim()} className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
          إضافة المعدة
        </button>
      </div>
      <div className="space-y-2">
        {items.map((i) => (
          <div key={i.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-center justify-between text-sm">
            <div className="font-bold text-slate-700">{i.name}</div>
            {i.addedOnMobile && <span className="text-[9.5px] font-bold bg-primary-light text-primary-dark px-2 py-0.5 rounded-full">جديد</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoriesPanel({ onChanged }: { onChanged: () => void }) {
  const [name, setName] = useState("");
  const [countsAsCommission, setCountsAsCommission] = useState(false);
  const items = listExpenseCategories();

  function save() {
    if (!name.trim()) return;
    addExpenseCategory(name.trim(), countsAsCommission);
    setName("");
    setCountsAsCommission(false);
    onChanged();
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl shadow-card p-4 space-y-2">
        <div className="text-sm font-extrabold text-slate-700">إضافة نوع مصروف</div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">اسم النوع</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="زي: صيانة، وقود" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={countsAsCommission} onChange={(e) => setCountsAsCommission(e.target.checked)} className="w-4 h-4 accent-primary" />
          يحسب في كوميشن حسن
        </label>
        <button onClick={save} disabled={!name.trim()} className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
          إضافة النوع
        </button>
      </div>
      <div className="space-y-2">
        {items.map((i) => (
          <div key={i.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-center justify-between text-sm">
            <div className="font-bold text-slate-700">{i.name}</div>
            <div className="flex items-center gap-1.5">
              {i.counts_as_commission && <span className="text-[9.5px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">كوميشن حسن</span>}
              {i.addedOnMobile && <span className="text-[9.5px] font-bold bg-primary-light text-primary-dark px-2 py-0.5 rounded-full">جديد</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
