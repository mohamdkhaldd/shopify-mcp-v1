import { Db, UserError } from "../db";
import { portion, Piasters } from "../calc/money";
import type { Books, MonthResult } from "./books";

// شركاء الإدارة: كل عقد ليه شركاء إدارة بنسب (مجموعها ١٠٠٪). نصيب الإدارة في
// الشهر بيتوزع على العقود على قد صافي كل عقد كسبان، ونصيب كل عقد بيتقسم على
// شركاءه بنسبهم. الشخص بيتعرف باسمه — نفس الاسم في كذا عقد = نفس الشخص.

/** ملاحظة الصرف اللي بيرجّع للشريك فلوس صرفها من جيبه */
export const REFUND_NOTE = "رد فلوس الهالك";

export interface ManagerShare {
  name: string;
  shareBp: number;
}

export function contractManagers(db: Db): Map<number, ManagerShare[]> {
  const rows = db
    .prepare("SELECT contract_id, name, share_bp FROM contract_managers WHERE deleted_at IS NULL ORDER BY id")
    .all() as { contract_id: number; name: string; share_bp: number }[];
  const out = new Map<number, ManagerShare[]>();
  for (const r of rows) {
    const list = out.get(r.contract_id) ?? [];
    list.push({ name: r.name, shareBp: r.share_bp });
    out.set(r.contract_id, list);
  }
  return out;
}

/** بيبدّل شركاء الإدارة بتوع العقد كلهم مرة واحدة (قائمة فاضية = من غير شركاء). */
export function setContractManagers(db: Db, contractId: number, list: ManagerShare[]) {
  const clean = list.map((m) => ({ name: m.name.trim(), shareBp: Math.round(m.shareBp) })).filter((m) => m.name);
  if (clean.some((m) => !(m.shareBp > 0))) throw new UserError("كل شريك لازم تكون نسبته أكبر من صفر");
  const names = new Set(clean.map((m) => m.name));
  if (names.size !== clean.length) throw new UserError("فيه اسم متكرر في نفس العقد");
  const total = clean.reduce((s, m) => s + m.shareBp, 0);
  if (clean.length && total !== 10_000) throw new UserError(`مجموع النسب لازم يبقى ١٠٠٪ (دلوقتي ${(total / 100).toLocaleString("ar-EG")}٪)`);
  const c = db.prepare("SELECT id FROM contracts WHERE id = ? AND deleted_at IS NULL").get(contractId);
  if (!c) throw new UserError("العقد ده مش موجود");
  db.transaction(() => {
    db.prepare("UPDATE contract_managers SET deleted_at = datetime('now'), delete_reason = 'اتغيروا' WHERE contract_id = ? AND deleted_at IS NULL").run(contractId);
    const ins = db.prepare("INSERT INTO contract_managers (contract_id, name, share_bp) VALUES (?, ?, ?)");
    for (const m of clean) ins.run(contractId, m.name, m.shareBp);
  })();
}

/** يقسم مبلغ على أوزان، والكسور (القروش) للأكبر وزنًا — المجموع بيطلع مظبوط. */
function split(amount: Piasters, weights: number[]): Piasters[] {
  const total = weights.reduce((s, w) => s + w, 0);
  if (amount <= 0 || total <= 0) return weights.map(() => 0);
  const parts = weights.map((w) => portion(amount, w, total));
  const rest = amount - parts.reduce((s, p) => s + p, 0);
  if (rest) parts[weights.indexOf(Math.max(...weights))] += rest;
  return parts;
}

export interface ContractManagement {
  contractId: number;
  code: string;
  netPt: Piasters;
  managementPt: Piasters;
  managers: { name: string; shareBp: number; amountPt: Piasters }[];
}

/** نصيب الإدارة من كل عقد في الشهر ده، ونصيب كل شريك منه. */
export function monthManagement(m: MonthResult, managers: Map<number, ManagerShare[]>): ContractManagement[] {
  const parts = split(m.distribution.managementPt, m.contracts.map((r) => Math.max(0, r.netPt)));
  return m.contracts.map((r, i) => {
    const list = managers.get(r.contractId) ?? [];
    const shares = split(parts[i], list.map((x) => x.shareBp));
    return {
      contractId: r.contractId,
      code: r.code,
      netPt: r.netPt,
      managementPt: parts[i],
      managers: list.map((x, j) => ({ name: x.name, shareBp: x.shareBp, amountPt: shares[j] })),
    };
  });
}

export function managersReport(db: Db, books: Books, month: string) {
  const managers = contractManagers(db);
  const payouts = db
    .prepare(
      `SELECT p.manager_name, p.amount_pt, p.note FROM profit_payouts p
       WHERE p.payee_kind = 'management' AND p.manager_name IS NOT NULL AND p.deleted_at IS NULL AND p.reversal_of IS NULL
         AND NOT EXISTS (SELECT 1 FROM profit_payouts r WHERE r.reversal_of = p.id AND r.deleted_at IS NULL)`,
    )
    .all() as { manager_name: string; amount_pt: number; note: string | null }[];

  // مصاريف دفعها الشريك من جيبه (مش من الخزنة) — الشركة عليها له المبلغ ده
  const pocket = db
    .prepare(
      `SELECT e.paid_by, e.amount_pt, e.date FROM expenses e
       WHERE e.paid_by IS NOT NULL AND e.deleted_at IS NULL AND e.reversal_of IS NULL
         AND NOT EXISTS (SELECT 1 FROM expenses r WHERE r.reversal_of = e.id AND r.deleted_at IS NULL)`,
    )
    .all() as { paid_by: string; amount_pt: number; date: string }[];

  const people = new Map<string, { name: string; monthPt: number; byContract: { contractId: number; code: string; amountPt: number }[]; accruedPt: number; paidPt: number; pocketPt: number; pocketMonthPt: number; refundedPt: number }>();
  const person = (name: string) => {
    if (!people.has(name)) people.set(name, { name, monthPt: 0, byContract: [], accruedPt: 0, paidPt: 0, pocketPt: 0, pocketMonthPt: 0, refundedPt: 0 });
    return people.get(name)!;
  };
  for (const list of managers.values()) for (const x of list) person(x.name);

  let contracts: ContractManagement[] = [];
  let unassignedPt = 0;
  for (const m of books.months) {
    const rows = monthManagement(m, managers);
    for (const r of rows) for (const x of r.managers) person(x.name).accruedPt += x.amountPt;
    if (m.month !== month) continue;
    contracts = rows;
    for (const r of rows) {
      if (!r.managers.length) unassignedPt += r.managementPt;
      for (const x of r.managers) {
        const p = person(x.name);
        p.monthPt += x.amountPt;
        p.byContract.push({ contractId: r.contractId, code: r.code, amountPt: x.amountPt });
      }
    }
  }
  for (const p of payouts) {
    const x = person(p.manager_name);
    x.paidPt += p.amount_pt;
    // "رد فلوس…" = فلوس صرفها من جيبه في الهالك ورجعتله (من صفحة الهالك)
    if (p.note?.startsWith(REFUND_NOTE)) x.refundedPt += p.amount_pt;
  }
  for (const e of pocket) {
    const p = person(e.paid_by);
    p.pocketPt += e.amount_pt;
    if (e.date.startsWith(month)) p.pocketMonthPt += e.amount_pt;
  }

  return {
    contracts,
    unassignedPt,
    people: [...people.values()]
      // ليه: نصيبه + اللي صرفه من جيبه − اللي خده
      .map((p) => ({ ...p, balancePt: p.accruedPt + p.pocketPt - p.paidPt, pocketLeftPt: Math.max(0, p.pocketPt - p.refundedPt) }))
      .sort((a, b) => b.monthPt - a.monthPt || a.name.localeCompare(b.name)),
  };
}
