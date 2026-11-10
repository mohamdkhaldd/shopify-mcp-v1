import { useState } from "react";
import { api, ManagementView } from "../../api/client";
import { Button, Code, ErrorBox, Note, Panel } from "../../components/ui";
import { TextInput } from "../../components/Field";
import Modal from "../../components/Modal";
import { monthLabel, percentFromBp, pounds } from "../../utils/format";

// شركاء الإدارة في كل عقد: مين، ونسبة كل واحد — وآخر الشهر كل واحد له كام
// من كل عقد، وله كام توتال.

type Contract = ManagementView["contracts"][number];

/** "33.33" / "٣٣٫٣٣" → 3333 bp */
function percentToBp(text: string): number {
  const t = text.trim().replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace("٫", ".").replace("%", "");
  const n = Number(t);
  if (!t || !Number.isFinite(n) || n <= 0 || n > 100) throw new Error("النسبة لازم تبقى رقم من ١ لـ ١٠٠");
  return Math.round(n * 100);
}

function ManagersEditor({ contract, names, onClose, onSaved }: { contract: Contract; names: string[]; onClose: () => void; onSaved: () => void }) {
  const [rows, setRows] = useState<{ name: string; percent: string }[]>(
    contract.managers.length ? contract.managers.map((m) => ({ name: m.name, percent: String(m.shareBp / 100) })) : [{ name: "", percent: "100" }],
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (i: number, patch: Partial<{ name: string; percent: string }>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  // تقسيم بالتساوي: ٣ أشخاص = ٣٣٫٣٣ + ٣٣٫٣٣ + ٣٣٫٣٤
  function equal() {
    const n = rows.length;
    const base = Math.floor(10_000 / n);
    setRows((r) => r.map((x, i) => ({ ...x, percent: String((i === n - 1 ? 10_000 - base * (n - 1) : base) / 100) })));
  }

  const totalBp = rows.reduce((s, r) => {
    try {
      return s + percentToBp(r.percent);
    } catch {
      return s;
    }
  }, 0);

  async function save() {
    setError(null);
    setBusy(true);
    try {
      const managers = rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), shareBp: percentToBp(r.percent) }));
      await api.setContractManagers({ contractId: contract.id, managers });
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`شركاء الإدارة — العقد ${contract.code} · ${contract.equipment}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>إلغاء</Button>
          <Button primary onClick={save} disabled={busy}>
            حفظ
          </Button>
        </>
      }
    >
      <div className="grid gap-2.5">
        <datalist id="manager-names">
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <TextInput list="manager-names" placeholder="الاسم" value={r.name} onChange={(e) => set(i, { name: e.target.value })} className="flex-1" />
            <TextInput inputMode="decimal" value={r.percent} onChange={(e) => set(i, { percent: e.target.value })} className="w-20 text-end" aria-label="النسبة" />
            <span className="text-muted">٪</span>
            <button className="text-out font-bold px-2" title="شيل" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setRows((r) => [...r, { name: "", percent: "" }])}>+ شريك</Button>
          {rows.length > 1 && <Button onClick={equal}>قسّم بالتساوي</Button>}
          <span className={`ms-auto font-bold ${totalBp === 10_000 ? "text-in" : "text-out"}`}>المجموع {percentFromBp(totalBp)}</span>
        </div>
        <div className="text-sm text-muted">نفس الاسم في كذا عقد = نفس الشخص، وبيتجمعله في الآخر. لو شلت كل الأسماء، العقد يبقى من غير شركاء إدارة.</div>
        {error && <ErrorBox message={error} />}
      </div>
    </Modal>
  );
}

export default function ManagersPanels({ v, onSaved }: { v: ManagementView; onSaved: () => void }) {
  const [editing, setEditing] = useState<Contract | null>(null);
  const r = v.managers;
  const shareOf = new Map(r.contracts.map((c) => [c.contractId, c]));
  const names = r.people.map((p) => p.name);
  const visible = v.contracts.filter((c) => c.active || shareOf.has(c.id) || c.managers.length);

  return (
    <>
      <Panel title="شركاء الإدارة في كل عقد" hint={monthLabel(v.month)}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>العقد</th>
                <th>المعدة</th>
                <th>شركاء الإدارة</th>
                <th className="n">نصيب الإدارة من العقد</th>
                <th className="no-print" />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-6">
                    مفيش عقود.
                  </td>
                </tr>
              )}
              {visible.map((c) => {
                const s = shareOf.get(c.id);
                return (
                  <tr key={c.id}>
                    <td>
                      <Code>{c.code}</Code>
                    </td>
                    <td>{c.equipment}</td>
                    <td>
                      {c.managers.length === 0 ? (
                        <span className="text-muted">— محددتش —</span>
                      ) : (
                        c.managers.map((m) => {
                          const amount = s?.managers.find((x) => x.name === m.name)?.amountPt;
                          return (
                            <div key={m.name}>
                              {m.name} <span className="text-muted">({percentFromBp(m.shareBp)})</span>
                              {amount ? <span className="num font-semibold"> {pounds(amount)}</span> : null}
                            </div>
                          );
                        })
                      )}
                    </td>
                    <td className="n font-bold">{s ? pounds(s.managementPt) : "—"}</td>
                    <td className="no-print text-end">
                      <Button onClick={() => setEditing(c)}>{c.managers.length ? "تعديل" : "حدد الشركاء"}</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Note>
          نصيب الإدارة في الشهر بيتوزع على العقود على قد صافي ربح كل عقد، ونصيب كل عقد بيتقسم على شركاءه بنسبهم.
          {r.unassignedPt > 0 && <> عقود من غير شركاء إدارة نصيبها {pounds(r.unassignedPt)} — لسه متوزعش على حد.</>}
        </Note>
      </Panel>

      <Panel title="كل شريك إدارة له كام" hint={monthLabel(v.month)}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>من كل عقد ({monthLabel(v.month)})</th>
                <th className="n">توتال الشهر</th>
                <th className="n">له من الأول</th>
                <th className="n">صرف من جيبه</th>
                <th className="n">اتصرفله</th>
                <th className="n">الباقي له</th>
              </tr>
            </thead>
            <tbody>
              {r.people.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-6">
                    لسه محددتش شركاء إدارة لأي عقد — دوس "حدد الشركاء" جنب العقد.
                  </td>
                </tr>
              )}
              {r.people.map((p) => (
                <tr key={p.name}>
                  <td className="font-bold">{p.name}</td>
                  <td>
                    {p.byContract.length === 0 ? (
                      <span className="text-muted">—</span>
                    ) : (
                      p.byContract.map((b) => (
                        <div key={b.contractId}>
                          <Code>{b.code}</Code> <span className="num">{pounds(b.amountPt)}</span>
                        </div>
                      ))
                    )}
                  </td>
                  <td className="n font-extrabold text-in">{pounds(p.monthPt)}</td>
                  <td className="n">{pounds(p.accruedPt)}</td>
                  <td className="n">{p.pocketPt ? pounds(p.pocketPt) : "—"}</td>
                  <td className="n">{pounds(p.paidPt)}</td>
                  <td className={`n font-bold ${p.balancePt > 0 ? "text-in" : ""}`}>{pounds(p.balancePt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>الباقي له = نصيبه + اللي صرفه من جيبه − اللي اتصرفله. «صرف من جيبه» = مصروف اتسجل «مين دفع: فلان من جيبه». «اتصرفله» = اللي اتسجل باسمه في "صرف من نصيب الإدارة" تحت (ومنها ترجّعله فلوسه).</Note>
      </Panel>

      {editing && <ManagersEditor contract={editing} names={names} onClose={() => setEditing(null)} onSaved={onSaved} />}
    </>
  );
}
