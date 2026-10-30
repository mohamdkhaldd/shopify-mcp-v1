import { it } from "vitest";
import fs from "node:fs";
import { freshDb, egp } from "./helpers";
import { createClient, createContract, createEquipment, createExpenseCategory, createInvestor, createSupplier } from "../core/services/master";
import { applyOvertime, clearRange, fillRange } from "../core/services/sarki";
import { recordCapital, recordClientPayment, recordExpense, recordPayout, recordSupplierDeduction, recordSupplierPayment, recordTaxPayment } from "../core/services/ledger";
import { computeBooks } from "../core/services/books";
import { closeMonth } from "../core/services/close";
import { supplierStatement, clientStatement } from "../core/services/reports";

const E = (pt: number) => pt / 100;
it("3-month scenario", () => {
  const db = freshDb();
  const out: any = { steps: [], months: {}, checkpoints: [] };
  const log = (date: string, text: string) => out.steps.push({ date, text });
  const fridays: Record<string, string[]> = { "2026-08": ["07", "14", "21", "28"], "2026-09": ["04", "11", "18", "25"], "2026-10": ["02", "09", "16", "23", "30"] };
  (globalThis as any).__RENTAL_TODAY__ = "2026-11-05";

  // ---- master data ----
  const ahmed = createInvestor(db, { name: "م. أحمد سالم", phone: "0122 555 1010" });
  const khaled = createInvestor(db, { name: "أ. خالد منصور", phone: "0111 777 2020" });
  const mona = createInvestor(db, { name: "د. منى عادل", phone: "0100 333 4040" });
  const sayed = createSupplier(db, { name: "الحاج سيد عبد الله", phone: "0100 234 5678" });
  const adel = createSupplier(db, { name: "م. عادل فهمي", phone: "0112 456 7890" });
  const abuYousef = createSupplier(db, { name: "أبو يوسف للمعدات", phone: "0155 123 4567" });
  const loader = createEquipment(db, { name: "لودر كاتربيلر 950", supplierId: sayed, siteName: "كمبوند الياسمين — التجمع", supplierRatePt: egp(2500) });
  const excavator = createEquipment(db, { name: "حفار كوماتسو PC300", supplierId: sayed, siteName: "كمبوند الياسمين — التجمع", supplierRatePt: egp(3200) });
  const crane = createEquipment(db, { name: "ونش 50 طن", supplierId: adel, siteName: "برج النور — مدينة نصر", supplierRatePt: egp(4000) });
  const dozer = createEquipment(db, { name: "بلدوزر كاتربيلر D8", supplierId: abuYousef, siteName: "أرض حسام — العاشر", supplierRatePt: egp(3500) });
  const amal = createClient(db, { kind: "company", name: "شركة الأمل للمقاولات", taxId: "512-845-307" });
  const nour = createClient(db, { kind: "company", name: "شركة النور للإنشاءات", taxId: "618-220-411" });
  const hossam = createClient(db, { kind: "individual", name: "م. حسام فؤاد", phone: "0109 888 1212" });
  const transport = createExpenseCategory(db, "نقل معدات");
  const rent = createExpenseCategory(db, "إيجار مكتب");
  const salary = createExpenseCategory(db, "مرتبات");

  const c1 = createContract(db, { clientId: amal, equipmentId: loader, unit: "day", clientRatePt: egp(3000), supplierRatePt: egp(2500), startDate: "2026-08-01", endDate: "2026-10-31" });
  const c2 = createContract(db, { clientId: amal, equipmentId: excavator, unit: "day", clientRatePt: egp(4000), supplierRatePt: egp(3200), startDate: "2026-08-15", endDate: "2026-10-31" });
  const c3 = createContract(db, { clientId: nour, equipmentId: crane, unit: "day", clientRatePt: egp(5200), supplierRatePt: egp(4000), startDate: "2026-09-01", endDate: "2026-10-31" });
  const c4 = createContract(db, { clientId: hossam, equipmentId: dozer, unit: "day", clientRatePt: egp(4500), supplierRatePt: egp(3500), startDate: "2026-09-01", endDate: "2026-09-30" });

  const sheet = (c: number, month: string, from: string, to: string, offFridays: boolean) => {
    fillRange(db, c, "client", `${month}-${from}`, `${month}-${to}`, {});
    if (offFridays) for (const d of fridays[month]) if (d >= from && d <= to) clearRange(db, c, "client", `${month}-${d}`, `${month}-${d}`, "إجازة الجمعة");
  };
  const snap = (label: string, date: string) => {
    const b = computeBooks(db, date);
    out.checkpoints.push({
      label, date,
      treasury: { balance: E(b.treasury.balancePt), taxHeld: E(b.treasury.taxHeldPt), profitsDue: E(b.treasury.profitsDuePt), available: E(b.treasury.availablePt) },
      investors: b.investors.map((i: any) => ({ name: i.name, capital: E(i.capitalPt), payableNow: E(i.payableNowPt), paid: E(i.paidPt) })),
      management: { releasable: E(b.management.releasablePt), paid: E(b.management.paidPt) },
      suppliers: [sayed, adel, abuYousef].map((s) => { const st: any = supplierStatement(db, s, date, b); return { name: st.supplier?.name, fromSarki: E(st.totals.fromSarkiPt), deductions: E(st.totals.deductionsPt), paid: E(st.totals.paidPt), remaining: E(st.totals.remainingPt) }; }),
      clients: [amal, nour, hossam].map((c) => { const st: any = clientStatement(db, c, date, b); return { name: st.client?.name, invoiced: E(st.totals.invoicedPt), paid: E(st.totals.paidPt), remaining: E(st.totals.remainingPt) }; }),
    });
    return b;
  };
  const monthResult = (b: any, month: string) => {
    const m = b.months.find((x: any) => x.month === month);
    const names = ["لودر/الأمل", "حفار/الأمل", "ونش/النور", "بلدوزر/حسام"];
    out.months[month] = {
      contracts: m.contracts.map((r: any) => ({ contract: names[[c1, c2, c3, c4].indexOf(r.contractId)], clientDays: r.clientDays, supplierDays: r.supplierDays, clientBase: E(r.clientBasePt), vat: E(r.vatPt), invoice: E(r.invoiceTotalPt), supplierCost: E(r.supplierCostPt), margin: E(r.marginPt), tax5: E(r.tax5Pt), contractExpenses: E(r.expensesPt), net: E(r.netPt) })),
      generalExpenses: E(m.generalExpensesPt), monthNet: E(m.monthNetPt), carryIn: E(m.carryInPt),
      management: E(m.distribution.managementPt), investorsPool: E(m.distribution.investorsPoolPt),
      investors: m.distribution.investors.map((x: any) => ({ name: x.investorId === ahmed ? "أحمد" : x.investorId === khaled ? "خالد" : "منى", share: E(x.sharePt) })),
      remainderToManagement: E(m.distribution.remainderToManagementPt ?? 0),
      vatTotal: E(m.contracts.reduce((s: number, r: any) => s + r.vatPt, 0)), tax5Total: E(m.contracts.reduce((s: number, r: any) => s + r.tax5Pt, 0)),
    };
    return m;
  };

  // ===== July =====
  recordCapital(db, { investorId: ahmed, kind: "deposit", date: "2026-08-01", amountPt: egp(300_000) });
  recordCapital(db, { investorId: khaled, kind: "deposit", date: "2026-08-01", amountPt: egp(200_000) });
  recordExpense(db, { kind: "general", categoryId: rent, date: "2026-08-01", amountPt: egp(5000), note: "إيجار المكتب — يوليو" });
  recordExpense(db, { kind: "contract", contractId: c1, categoryId: transport, date: "2026-08-01", amountPt: egp(1500), note: "نقل اللودر للموقع" });
  sheet(c1, "2026-08", "01", "31", true);
  recordSupplierDeduction(db, { supplierId: sayed, contractId: c1, date: "2026-08-10", amountPt: egp(4000), note: "سولار اللودر دفعناه عنه" });
  recordExpense(db, { kind: "contract", contractId: c2, categoryId: transport, date: "2026-08-15", amountPt: egp(2000), note: "نقل الحفار للموقع" });
  sheet(c2, "2026-08", "15", "31", true);
  recordSupplierPayment(db, { supplierId: sayed, contractId: c1, date: "2026-08-20", amountPt: egp(30_000), note: "دفعة تحت الحساب — اللودر" });
  recordExpense(db, { kind: "general", categoryId: salary, date: "2026-08-28", amountPt: egp(6000), note: "مرتب المحاسب — يوليو" });
  let b = snap("آخر أغسطس", "2026-08-31");
  const jul = monthResult(b, "2026-08");

  // ===== August =====
  recordCapital(db, { investorId: mona, kind: "deposit", date: "2026-09-01", amountPt: egp(150_000) });
  recordExpense(db, { kind: "general", categoryId: rent, date: "2026-09-01", amountPt: egp(5000), note: "إيجار المكتب — أغسطس" });
  recordExpense(db, { kind: "contract", contractId: c3, categoryId: transport, date: "2026-09-01", amountPt: egp(2500), note: "نقل الونش للموقع" });
  recordExpense(db, { kind: "contract", contractId: c4, categoryId: transport, date: "2026-09-01", amountPt: egp(1800), note: "نقل البلدوزر للموقع" });
  closeMonth(db, "2026-08", "2026-09-02");
  log("2026-09-02", "close-july");
  const firstMonthInvoices = jul.contracts.reduce((t: number, r: any) => t + r.invoiceTotalPt, 0);
  out.firstMonthInvoices = E(firstMonthInvoices);
  recordClientPayment(db, { clientId: amal, date: "2026-09-03", amountPt: firstMonthInvoices, note: "تحويل بنكي — فواتير أغسطس" });
  recordSupplierPayment(db, { supplierId: sayed, date: "2026-09-05", amountPt: egp(60_000), note: "باقي يوليو" });
  sheet(c1, "2026-09", "01", "30", true);
  sheet(c2, "2026-09", "01", "30", true);
  applyOvertime(db, c2, "client", "2026-09", "5, 10, 12", 3000, egp(500));
  sheet(c3, "2026-09", "01", "30", false);
  clearRange(db, c3, "client", "2026-09-20", "2026-09-22", "عطل في الونش");
  sheet(c4, "2026-09", "01", "30", false);
  b = computeBooks(db, "2026-09-10");
  const pay = (inv: number) => b.investors.find((i: any) => i.investorId === inv)!.payableNowPt;
  const payA = pay(ahmed), payK = pay(khaled), payM = Math.max(0, b.management.releasablePt - b.management.paidPt);
  out.payoutsAug = { ahmed: E(payA), khaled: E(payK), management: E(payM) };
  if (payA > 0) recordPayout(db, { payee: "investor", investorId: ahmed, date: "2026-09-10", amountPt: payA, note: "أرباح يوليو" });
  if (payK > 0) recordPayout(db, { payee: "investor", investorId: khaled, date: "2026-09-10", amountPt: payK, note: "أرباح يوليو" });
  if (payM > 0) recordPayout(db, { payee: "management", date: "2026-09-10", amountPt: payM, note: "نصيب الإدارة — يوليو" });
  const julVat = jul.contracts.reduce((s: number, r: any) => s + r.vatPt, 0), julT5 = jul.contracts.reduce((s: number, r: any) => s + r.tax5Pt, 0);
  recordTaxPayment(db, { tax: "vat", periodMonth: "2026-08", date: "2026-09-15", amountPt: julVat, receiptNo: "VAT-07" });
  recordTaxPayment(db, { tax: "tax5", periodMonth: "2026-08", date: "2026-09-15", amountPt: julT5, receiptNo: "T5-07" });
  recordSupplierDeduction(db, { supplierId: adel, contractId: c3, date: "2026-09-18", amountPt: egp(6000), note: "قطع غيار الونش دفعناها عنه" });
  recordSupplierPayment(db, { supplierId: adel, contractId: c3, date: "2026-09-25", amountPt: egp(50_000), note: "دفعة تحت الحساب — الونش" });
  recordExpense(db, { kind: "general", categoryId: salary, date: "2026-09-28", amountPt: egp(6000), note: "مرتب المحاسب — أغسطس" });
  b = snap("آخر سبتمبر", "2026-09-30");
  const aug = monthResult(b, "2026-09");

  // ===== September =====
  recordCapital(db, { investorId: khaled, kind: "deposit", date: "2026-10-01", amountPt: egp(100_000), note: "زيادة رأس المال" });
  recordExpense(db, { kind: "general", categoryId: rent, date: "2026-10-01", amountPt: egp(5000), note: "إيجار المكتب — سبتمبر" });
  closeMonth(db, "2026-09", "2026-10-02");
  recordClientPayment(db, { clientId: hossam, date: "2026-10-02", amountPt: egp(110_000), note: "كاش" });
  recordClientPayment(db, { clientId: amal, date: "2026-10-04", amountPt: egp(200_000), note: "شيك" });
  recordSupplierPayment(db, { supplierId: sayed, date: "2026-10-05", amountPt: egp(120_000), note: "حساب أغسطس" });
  recordSupplierPayment(db, { supplierId: abuYousef, contractId: c4, date: "2026-10-05", amountPt: egp(70_000), note: "حساب البلدوزر" });
  recordClientPayment(db, { clientId: nour, date: "2026-10-06", amountPt: egp(150_000), note: "تحويل بنكي" });
  sheet(c1, "2026-10", "01", "31", true);
  sheet(c2, "2026-10", "01", "31", true);
  sheet(c3, "2026-10", "01", "31", false);
  b = computeBooks(db, "2026-10-10");
  const p2 = (inv: number) => b.investors.find((i: any) => i.investorId === inv)!.payableNowPt;
  const sA = p2(ahmed), sK = p2(khaled), sM = p2(mona), sMg = Math.max(0, b.management.releasablePt - b.management.paidPt);
  out.payoutsSep = { ahmed: E(sA), khaled: E(sK), mona: E(sM), management: E(sMg) };
  for (const [inv, amt] of [[ahmed, sA], [khaled, sK], [mona, sM]] as const) if (amt > 0) recordPayout(db, { payee: "investor", investorId: inv, date: "2026-10-10", amountPt: amt, note: "أرباح أغسطس" });
  if (sMg > 0) recordPayout(db, { payee: "management", date: "2026-10-10", amountPt: sMg, note: "نصيب الإدارة — أغسطس" });
  const augVat = aug.contracts.reduce((s: number, r: any) => s + r.vatPt, 0), augT5 = aug.contracts.reduce((s: number, r: any) => s + r.tax5Pt, 0);
  out.taxes = { julVat: E(julVat), julT5: E(julT5), augVat: E(augVat), augT5: E(augT5) };
  recordTaxPayment(db, { tax: "vat", periodMonth: "2026-09", date: "2026-10-15", amountPt: augVat, receiptNo: "VAT-08" });
  recordTaxPayment(db, { tax: "tax5", periodMonth: "2026-09", date: "2026-10-15", amountPt: augT5, receiptNo: "T5-08" });
  recordSupplierPayment(db, { supplierId: adel, date: "2026-10-25", amountPt: egp(80_000), note: "حساب أغسطس" });
  recordExpense(db, { kind: "general", categoryId: salary, date: "2026-10-28", amountPt: egp(6000), note: "مرتب المحاسب — سبتمبر" });
  recordClientPayment(db, { clientId: amal, date: "2026-10-28", amountPt: egp(100_000), note: "تحويل بنكي" });
  b = snap("آخر أكتوبر", "2026-10-31");
  monthResult(b, "2026-10");
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
});
