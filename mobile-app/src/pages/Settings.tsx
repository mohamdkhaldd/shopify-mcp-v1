import { useState } from "react";
import { listContractors, listEmployees, listEquipment, listExpenseCategories, listPartners, pushAllToCloud } from "../store";
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

        {kind === "drivers" && <DriversPanel />}
        {kind === "contractors" && <ContractorsPanel />}
        {kind === "partners" && <PartnersPanel />}
        {kind === "equipment" && <EquipmentPanel />}
        {kind === "categories" && <CategoriesPanel />}
      </div>
    </div>
  );
}

function DriversPanel() {
  const items = listEmployees();
  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-6">لسه مفيش سائقين مسجلين.</div>
      ) : (
        items.map((i) => (
          <div key={i.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            <div className="font-bold text-slate-700">{i.name}</div>
            <div className="text-[10.5px] text-slate-400">
              {i.wage_type === "daily" ? "أجر يومي" : "مرتب شهري"} — {i.rate} ج.م
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ContractorsPanel() {
  const items = listContractors();
  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-6">لسه مفيش مقاولين مسجلين.</div>
      ) : (
        items.map((i) => (
          <div key={i.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            <div className="font-bold text-slate-700">{i.name}</div>
            <div className="text-[10.5px] text-slate-400 mt-0.5">الرصيد الافتتاحي: {i.opening_balance} ج.م</div>
          </div>
        ))
      )}
    </div>
  );
}

function PartnersPanel() {
  const items = listPartners();
  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-6">لسه مفيش شركاء مسجلين.</div>
      ) : (
        items.map((i) => (
          <div key={i.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            <div className="font-bold text-slate-700">{i.name}</div>
            <div className="text-[10.5px] text-slate-400 mt-0.5">الرصيد الافتتاحي: {i.opening_balance} ج.م</div>
          </div>
        ))
      )}
    </div>
  );
}

function EquipmentPanel() {
  const partners = listPartners();
  const partnerName = (id: number) => partners.find((p) => p.id === id)?.name ?? "—";
  const items = listEquipment();
  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-6">لسه مفيش معدات مسجلة.</div>
      ) : (
        items.map((i) => (
          <div key={i.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            <div className="font-bold text-slate-700">{i.name}</div>
            <div className="text-[10.5px] text-slate-400 mt-0.5">سعر الشراء: {i.purchase_price} ج.م</div>
            {i.shares.length > 0 && (
              <div className="text-[10.5px] text-slate-400 mt-1 space-y-0.5">
                {i.shares.map((s, idx) => (
                  <div key={idx}>
                    {partnerName(s.partner_id)}: {s.percentage}٪
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function CategoriesPanel() {
  const items = listExpenseCategories();
  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-6">لسه مفيش أنواع مصروفات مسجلة.</div>
      ) : (
        items.map((i) => (
          <div key={i.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-center justify-between text-sm">
            <div className="font-bold text-slate-700">{i.name}</div>
            {i.counts_as_commission && <span className="text-[9.5px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">كوميشن حسن</span>}
          </div>
        ))
      )}
    </div>
  );
}
