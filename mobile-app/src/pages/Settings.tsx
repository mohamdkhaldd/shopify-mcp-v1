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
  updateContractorBalance,
  updateEmployee,
  updateEquipment,
  updateExpenseCategory,
  updatePartnerBalance,
} from "../store";
import { Driver, Equipment, WageType } from "../types";
import { signOut } from "../auth";

type Kind = "drivers" | "contractors" | "partners" | "equipment" | "categories";

const KINDS: { id: Kind; label: string }[] = [
  { id: "partners", label: "الشركاء" },
  { id: "drivers", label: "السائقين" },
  { id: "equipment", label: "المعدات" },
  { id: "contractors", label: "المقاولين" },
  { id: "categories", label: "أنواع المصروفات" },
];

export default function Settings() {
  const [kind, setKind] = useState<Kind>("partners");
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

function DriverEditRow({ item, onSaved, onCancel }: { item: Driver; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState(item.name);
  const [wageType, setWageType] = useState<WageType>(item.wage_type);
  const [rate, setRate] = useState(String(item.rate));

  function save() {
    const trimmed = name.trim();
    const rateValue = Number(rate);
    if (!trimmed || !rateValue) return;
    updateEmployee(item.id, { name: trimmed, wage_type: wageType, rate: rateValue, fixed_salary: item.fixed_salary });
    onSaved();
  }

  return (
    <div className="bg-white rounded-xl border border-primary/30 px-3 py-2.5 space-y-1.5">
      <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
      <div className="flex gap-1.5">
        <select value={wageType} onChange={(e) => setWageType(e.target.value as WageType)} className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
          <option value="daily">أجر يومي</option>
          <option value="monthly">مرتب شهري</option>
        </select>
        <input type="number" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
      </div>
      <div className="flex gap-1.5">
        <button onClick={save} className="flex-1 bg-primary text-white rounded-lg py-1.5 text-xs font-bold">
          حفظ
        </button>
        <button onClick={onCancel} className="flex-1 bg-slate-100 text-slate-500 rounded-lg py-1.5 text-xs font-bold">
          إلغاء
        </button>
      </div>
    </div>
  );
}

function DriversPanel({ onChanged }: { onChanged: () => void }) {
  const [name, setName] = useState("");
  const [wageType, setWageType] = useState<WageType>("daily");
  const [rate, setRate] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
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
        {items.map((i) =>
          editingId === i.id ? (
            <DriverEditRow
              key={i.id}
              item={i}
              onSaved={() => {
                setEditingId(null);
                onChanged();
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <button
              key={i.id}
              onClick={() => setEditingId(i.id)}
              className="w-full bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-center justify-between text-sm text-start"
            >
              <div>
                <div className="font-bold text-slate-700">{i.name}</div>
                <div className="text-[10.5px] text-slate-400">
                  {i.wage_type === "daily" ? "أجر يومي" : "مرتب شهري"} — {i.rate} ج.م
                </div>
              </div>
              {i.addedOnMobile && <span className="text-[9.5px] font-bold bg-primary-light text-primary-dark px-2 py-0.5 rounded-full">جديد</span>}
            </button>
          )
        )}
      </div>
    </div>
  );
}

function ContractorsPanel({ onChanged }: { onChanged: () => void }) {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("0");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const items = listContractors();

  function save() {
    if (!name.trim()) return;
    addContractor(name.trim(), Number(balance) || 0);
    setName("");
    setBalance("0");
    onChanged();
  }

  function saveEdit(id: number) {
    updateContractorBalance(id, Number(editValue) || 0);
    setEditingId(null);
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
          <div key={i.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-700">{i.name}</div>
              {i.addedOnMobile && <span className="text-[9.5px] font-bold bg-primary-light text-primary-dark px-2 py-0.5 rounded-full">جديد</span>}
            </div>
            {editingId === i.id ? (
              <div className="flex gap-1.5 mt-1.5">
                <input
                  type="number"
                  inputMode="decimal"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                  className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                />
                <button onClick={() => saveEdit(i.id)} className="bg-primary text-white rounded-lg px-3 py-1 text-xs font-bold">
                  حفظ
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditingId(i.id);
                  setEditValue(String(i.opening_balance));
                }}
                className="text-[10.5px] text-slate-400 mt-0.5"
              >
                الرصيد الافتتاحي: {i.opening_balance} ج.م — دوس للتعديل
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PartnersPanel({ onChanged }: { onChanged: () => void }) {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("0");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const items = listPartners();

  function save() {
    if (!name.trim()) return;
    addPartner(name.trim(), Number(balance) || 0);
    setName("");
    setBalance("0");
    onChanged();
  }

  function saveEdit(id: number) {
    updatePartnerBalance(id, Number(editValue) || 0);
    setEditingId(null);
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
          <div key={i.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-700">{i.name}</div>
              {i.addedOnMobile && <span className="text-[9.5px] font-bold bg-primary-light text-primary-dark px-2 py-0.5 rounded-full">جديد</span>}
            </div>
            {editingId === i.id ? (
              <div className="flex gap-1.5 mt-1.5">
                <input
                  type="number"
                  inputMode="decimal"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                  className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                />
                <button onClick={() => saveEdit(i.id)} className="bg-primary text-white rounded-lg px-3 py-1 text-xs font-bold">
                  حفظ
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditingId(i.id);
                  setEditValue(String(i.opening_balance));
                }}
                className="text-[10.5px] text-slate-400 mt-0.5"
              >
                الرصيد الافتتاحي: {i.opening_balance} ج.م — دوس للتعديل
              </button>
            )}
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

function SharesEditor({
  partners,
  shares,
  onChange,
}: {
  partners: { id: number; name: string }[];
  shares: ShareDraft[];
  onChange: (shares: ShareDraft[]) => void;
}) {
  function updateShare(index: number, patch: Partial<ShareDraft>) {
    onChange(shares.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }
  function addShareRow() {
    onChange([...shares, { partner_id: "", percentage: "" }]);
  }
  function removeShareRow(index: number) {
    onChange(shares.filter((_, i) => i !== index));
  }
  const shareTotal = shares.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0);

  return (
    <div>
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
  );
}

function EquipmentEditRow({
  item,
  partners,
  onSaved,
  onCancel,
}: {
  item: Equipment;
  partners: { id: number; name: string }[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [price, setPrice] = useState(String(item.purchase_price));
  const [shares, setShares] = useState<ShareDraft[]>(
    item.shares.length ? item.shares.map((s) => ({ partner_id: String(s.partner_id), percentage: String(s.percentage) })) : [{ partner_id: "", percentage: "" }]
  );

  function save() {
    const validShares = shares.filter((s) => s.partner_id && s.percentage).map((s) => ({ partner_id: Number(s.partner_id), percentage: Number(s.percentage) || 0 }));
    updateEquipment(item.id, Number(price) || 0, validShares);
    onSaved();
  }

  return (
    <div className="bg-white rounded-xl border border-primary/30 px-3 py-2.5 space-y-2">
      <div className="font-bold text-slate-700 text-sm">{item.name}</div>
      <input type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="سعر الشراء" className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
      <SharesEditor partners={partners} shares={shares} onChange={setShares} />
      <div className="flex gap-1.5">
        <button onClick={save} className="flex-1 bg-primary text-white rounded-lg py-1.5 text-xs font-bold">
          حفظ
        </button>
        <button onClick={onCancel} className="flex-1 bg-slate-100 text-slate-500 rounded-lg py-1.5 text-xs font-bold">
          إلغاء
        </button>
      </div>
    </div>
  );
}

function EquipmentPanel({ onChanged }: { onChanged: () => void }) {
  const partners = listPartners();
  const items = listEquipment();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [shares, setShares] = useState<ShareDraft[]>([{ partner_id: "", percentage: "" }]);
  const [editingId, setEditingId] = useState<number | null>(null);

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
          <SharesEditor partners={partners} shares={shares} onChange={setShares} />
        </div>
        <button onClick={save} disabled={!name.trim()} className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
          إضافة المعدة
        </button>
      </div>
      <div className="space-y-2">
        {items.map((i) =>
          editingId === i.id ? (
            <EquipmentEditRow
              key={i.id}
              item={i}
              partners={partners}
              onSaved={() => {
                setEditingId(null);
                onChanged();
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <button
              key={i.id}
              onClick={() => setEditingId(i.id)}
              className="w-full bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-center justify-between text-sm text-start"
            >
              <div className="font-bold text-slate-700">{i.name}</div>
              {i.addedOnMobile && <span className="text-[9.5px] font-bold bg-primary-light text-primary-dark px-2 py-0.5 rounded-full">جديد</span>}
            </button>
          )
        )}
      </div>
    </div>
  );
}

function CategoriesPanel({ onChanged }: { onChanged: () => void }) {
  const [name, setName] = useState("");
  const [countsAsCommission, setCountsAsCommission] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCommission, setEditCommission] = useState(false);
  const items = listExpenseCategories();

  function save() {
    if (!name.trim()) return;
    addExpenseCategory(name.trim(), countsAsCommission);
    setName("");
    setCountsAsCommission(false);
    onChanged();
  }

  function saveEdit(id: number) {
    if (!editName.trim()) return;
    updateExpenseCategory(id, editName.trim(), editCommission);
    setEditingId(null);
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
        {items.map((i) =>
          editingId === i.id ? (
            <div key={i.id} className="bg-white rounded-xl border border-primary/30 px-3 py-2.5 space-y-1.5">
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={editCommission} onChange={(e) => setEditCommission(e.target.checked)} className="w-4 h-4 accent-primary" />
                يحسب في كوميشن حسن
              </label>
              <div className="flex gap-1.5">
                <button onClick={() => saveEdit(i.id)} className="flex-1 bg-primary text-white rounded-lg py-1.5 text-xs font-bold">
                  حفظ
                </button>
                <button onClick={() => setEditingId(null)} className="flex-1 bg-slate-100 text-slate-500 rounded-lg py-1.5 text-xs font-bold">
                  إلغاء
                </button>
              </div>
            </div>
          ) : (
            <button
              key={i.id}
              onClick={() => {
                setEditingId(i.id);
                setEditName(i.name);
                setEditCommission(i.counts_as_commission);
              }}
              className="w-full bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-center justify-between text-sm text-start"
            >
              <div className="font-bold text-slate-700">{i.name}</div>
              <div className="flex items-center gap-1.5">
                {i.counts_as_commission && <span className="text-[9.5px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">كوميشن حسن</span>}
                {i.addedOnMobile && <span className="text-[9.5px] font-bold bg-primary-light text-primary-dark px-2 py-0.5 rounded-full">جديد</span>}
              </div>
            </button>
          )
        )}
      </div>
    </div>
  );
}
