import { ReactNode, useEffect, useState } from "react";
import { api, PartySheet } from "../api/client";
import { Code, ErrorBox, Money } from "./ui";
import { Labeled, Select } from "./Field";
import { PrintButtons } from "./Print";
import PartySheetView from "./PartySheetView";
import Icon from "./Icon";
import { dateLabel, monthLabel, pounds } from "../utils/format";

// Pieces shared by the party pages (أصحاب المعدات، الشركات والأفراد، ...).

export function Fact({ label, children, tone = "" }: { label: string; children: ReactNode; tone?: string }) {
  return (
    <div className="px-4 py-3 border-s border-line first:border-s-0">
      <span className="block text-xs font-semibold text-muted">{label}</span>
      <b className={`text-lg num ${tone}`}>{children}</b>
    </div>
  );
}

export function TrashButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button type="button" title={title} onClick={onClick} className="no-print text-muted hover:text-out">
      <Icon name="trash" className="w-4 h-4" />
    </button>
  );
}


export function MoneyTable({ rows, noteHeader, contracts, onDelete }: { rows: { id: number; date: string; contractId: number | null; amountPt: number; note: string | null }[]; noteHeader: string; contracts: { id: number; code: string }[]; onDelete: (id: number) => void }) {
  const code = (id: number | null) => contracts.find((c) => c.id === id)?.code;
  const total = rows.reduce((a, r) => a + r.amountPt, 0);
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>العقد</th>
            <th>{noteHeader}</th>
            <th className="n">المبلغ</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-muted py-6">
                لسه مفيش حاجة متسجلة.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{dateLabel(r.date)}</td>
              <td>{code(r.contractId) ? <Code>{code(r.contractId)}</Code> : "—"}</td>
              <td>{r.note ?? ""}</td>
              <td className="n font-bold">
                <Money pt={pounds(r.amountPt)} />
              </td>
              <td className="text-end">
                <TrashButton title="حذف" onClick={() => onDelete(r.id)} />
              </td>
            </tr>
          ))}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan={3}>الإجمالي</td>
              <td className="n">{pounds(total)}</td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** The printable sheet for one party: pick contract + month; the core only sends that party's own data. */
export function PartySheetTab({ contracts, side, partyName }: { contracts: { id: number; code: string; equipment: string; months: string[] }[]; side: "client" | "supplier"; partyName: string }) {
  const [contractId, setContractId] = useState<number | undefined>(contracts[0]?.id);
  const contract = contracts.find((c) => c.id === contractId);
  const [month, setMonth] = useState<string | undefined>(contract?.months[contract.months.length - 1]);
  const [sheet, setSheet] = useState<PartySheet | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contract) return;
    const m = month && contract.months.includes(month) ? month : contract.months[contract.months.length - 1];
    if (m !== month) setMonth(m);
    else if (m) api.partySheet(contract.id, m, side).then(setSheet, (e) => setError(e.message));
  }, [contract, month, side]);

  const who = side === "client" ? "الشركة" : "صاحب المعدة";
  if (!contracts.length) return <div className="px-4 py-8 text-center text-muted">لسه مفيش عقود.</div>;
  return (
    <div>
      <div className="no-print flex flex-wrap items-end gap-2.5 px-4 py-3 border-b border-line bg-surface-2">
        <Labeled label="العقد">
          <Select value={contractId} onChange={(e) => setContractId(Number(e.target.value))}>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.equipment}
              </option>
            ))}
          </Select>
        </Labeled>
        <Labeled label="الشهر">
          <Select value={month} onChange={(e) => setMonth(e.target.value)}>
            {[...(contract?.months ?? [])].reverse().map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </Select>
        </Labeled>
        <PrintButtons pdfName={`سركي ${partyName} ${month ? monthLabel(month) : ""}`} singlePage={false} />
        <span className="text-xs text-muted self-center">ده اللي بيتطبع ويتسلّم — فيه أسعار {who} بس، من غير الطرف التاني ولا سعره.</span>
      </div>
      {error && <ErrorBox message={error} />}
      {sheet && <PartySheetView sheet={sheet} partyLabel={who} signLabel={side === "client" ? "توقيع مندوب الشركة" : "توقيع صاحب المعدة"} />}
    </div>
  );
}
