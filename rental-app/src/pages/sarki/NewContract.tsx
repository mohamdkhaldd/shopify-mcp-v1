import { useEffect, useState } from "react";
import { api, ContractOptions, NewContractInput } from "../../api/client";
import Modal from "../../components/Modal";
import { Labeled, Select, TextInput } from "../../components/Field";
import { Button, ErrorBox } from "../../components/ui";
import { moneyToPt, ptToInput } from "../../utils/input";
import { today } from "../../../core/db";

const NEW = "new";

/** "عقد جديد" — pick or type the company, the equipment and its owner, then the two rates. */
export default function NewContract({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [opts, setOpts] = useState<ContractOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [clientSel, setClientSel] = useState<string>(NEW);
  const [clientName, setClientName] = useState("");
  const [clientKind, setClientKind] = useState<"company" | "individual">("company");
  const [vat, setVat] = useState(true);
  const [tax5, setTax5] = useState(true);
  const [taxId, setTaxId] = useState("");

  const [eqSel, setEqSel] = useState<string>(NEW);
  const [eqName, setEqName] = useState("");
  const [supSel, setSupSel] = useState<string>(NEW);
  const [supName, setSupName] = useState("");
  const [supPhone, setSupPhone] = useState("");

  const [unit, setUnit] = useState<"day" | "month">("day");
  const [clientRate, setClientRate] = useState("");
  const [supplierRate, setSupplierRate] = useState("");
  const [site, setSite] = useState("");
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState("");

  useEffect(() => {
    api.contractOptions().then((o) => {
      setOpts(o);
      if (o.clients.length) setClientSel(String(o.clients[0].id));
      if (o.equipment.length) setEqSel(String(o.equipment[0].id));
      if (o.suppliers.length) setSupSel(String(o.suppliers[0].id));
    }, (e) => setError(e.message));
  }, []);

  // picking a piece of equipment fills its owner's agreed rate and its site
  useEffect(() => {
    const e = opts?.equipment.find((x) => String(x.id) === eqSel);
    if (!e) return;
    if (e.supplier_rate_pt) setSupplierRate(ptToInput(e.supplier_rate_pt));
    if (e.site_name) setSite(e.site_name);
  }, [eqSel, opts]);

  const kindChanged = (k: "company" | "individual") => {
    setClientKind(k);
    setVat(k === "company");
    setTax5(k === "company");
  };

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const cr = moneyToPt(clientRate);
      const sr = moneyToPt(supplierRate);
      if (!cr || !sr) throw new Error("اكتب سعر الشركة وسعر صاحب المعدة");
      const input: NewContractInput = {
        client: clientSel === NEW ? { kind: clientKind, name: clientName.trim(), taxId: taxId.trim() || undefined, vatApplies: vat, tax5Applies: tax5 } : { id: Number(clientSel) },
        equipment:
          eqSel === NEW
            ? { name: eqName.trim(), siteName: site.trim() || undefined, supplier: supSel === NEW ? { name: supName.trim(), phone: supPhone.trim() || undefined } : { id: Number(supSel) } }
            : { id: Number(eqSel) },
        unit,
        clientRatePt: cr,
        supplierRatePt: sr,
        startDate: start,
        endDate: end || undefined,
        siteName: site.trim() || undefined,
      };
      if (clientSel === NEW && !clientName.trim()) throw new Error("اكتب اسم الشركة أو الفرد");
      if (eqSel === NEW && !eqName.trim()) throw new Error("اكتب اسم المعدة");
      if (eqSel === NEW && supSel === NEW && !supName.trim()) throw new Error("اكتب اسم صاحب المعدة");
      onCreated(await api.newContract(input));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const per = unit === "day" ? "في اليوم" : "في الشهر";

  return (
    <Modal
      title="عقد جديد"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>إلغاء</Button>
          <Button primary onClick={save} disabled={busy || !opts}>
            حفظ العقد
          </Button>
        </>
      }
    >
      {!opts ? (
        error ? <ErrorBox message={error} /> : null
      ) : (
        <div className="grid gap-4">
          <fieldset className="grid gap-2 border border-line rounded-card p-3">
            <legend className="px-1 text-xs font-bold text-muted">الشركة / الفرد (العميل)</legend>
            <Select value={clientSel} onChange={(e) => setClientSel(e.target.value)} aria-label="العميل">
              {opts.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.kind === "individual" ? "(فرد)" : ""}
                </option>
              ))}
              <option value={NEW}>+ عميل جديد</option>
            </Select>
            {clientSel === NEW && (
              <div className="flex flex-wrap gap-2.5 items-end">
                <Labeled label="الاسم">
                  <TextInput value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-56" />
                </Labeled>
                <Labeled label="النوع">
                  <Select value={clientKind} onChange={(e) => kindChanged(e.target.value as "company" | "individual")}>
                    <option value="company">شركة</option>
                    <option value="individual">فرد</option>
                  </Select>
                </Labeled>
                <Labeled label="الرقم الضريبي (اختياري)">
                  <TextInput value={taxId} onChange={(e) => setTaxId(e.target.value)} className="w-36" />
                </Labeled>
                <label className="flex items-center gap-1.5 text-sm font-semibold">
                  <input type="checkbox" checked={vat} onChange={(e) => setVat(e.target.checked)} /> عليه ١٤٪
                </label>
                <label className="flex items-center gap-1.5 text-sm font-semibold">
                  <input type="checkbox" checked={tax5} onChange={(e) => setTax5(e.target.checked)} /> عليه ٥٪
                </label>
              </div>
            )}
          </fieldset>

          <fieldset className="grid gap-2 border border-line rounded-card p-3">
            <legend className="px-1 text-xs font-bold text-muted">المعدة وصاحبها</legend>
            <Select value={eqSel} onChange={(e) => setEqSel(e.target.value)} aria-label="المعدة">
              {opts.equipment.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} — {e.supplier}
                </option>
              ))}
              <option value={NEW}>+ معدة جديدة</option>
            </Select>
            {eqSel === NEW && (
              <div className="flex flex-wrap gap-2.5 items-end">
                <Labeled label="اسم المعدة">
                  <TextInput value={eqName} onChange={(e) => setEqName(e.target.value)} className="w-52" />
                </Labeled>
                <Labeled label="صاحب المعدة">
                  <Select value={supSel} onChange={(e) => setSupSel(e.target.value)}>
                    {opts.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                    <option value={NEW}>+ صاحب معدة جديد</option>
                  </Select>
                </Labeled>
                {supSel === NEW && (
                  <>
                    <Labeled label="اسمه">
                      <TextInput value={supName} onChange={(e) => setSupName(e.target.value)} className="w-44" />
                    </Labeled>
                    <Labeled label="تليفونه (اختياري)">
                      <TextInput value={supPhone} onChange={(e) => setSupPhone(e.target.value)} className="w-32" />
                    </Labeled>
                  </>
                )}
              </div>
            )}
          </fieldset>

          <fieldset className="flex flex-wrap gap-2.5 items-end border border-line rounded-card p-3">
            <legend className="px-1 text-xs font-bold text-muted">الاتفاق</legend>
            <Labeled label="المحاسبة">
              <Select value={unit} onChange={(e) => setUnit(e.target.value as "day" | "month")}>
                <option value="day">باليوم</option>
                <option value="month">بالشهر</option>
              </Select>
            </Labeled>
            <Labeled label={`سعر الشركة ${per}`}>
              <TextInput value={clientRate} onChange={(e) => setClientRate(e.target.value)} inputMode="decimal" />
            </Labeled>
            <Labeled label={`سعر صاحب المعدة ${per}`}>
              <TextInput value={supplierRate} onChange={(e) => setSupplierRate(e.target.value)} inputMode="decimal" />
            </Labeled>
            <Labeled label="الموقع">
              <TextInput value={site} onChange={(e) => setSite(e.target.value)} className="w-48" />
            </Labeled>
            <Labeled label="من">
              <TextInput type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-36" />
            </Labeled>
            <Labeled label="لحد (اختياري)">
              <TextInput type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-36" />
            </Labeled>
          </fieldset>
          {error && <ErrorBox message={error} />}
        </div>
      )}
    </Modal>
  );
}
