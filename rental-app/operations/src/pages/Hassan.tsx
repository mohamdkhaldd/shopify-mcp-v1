import { useState } from "react";
import FundsTab from "./hassan/FundsTab";
import InstallmentsTab from "./hassan/InstallmentsTab";
import MonthPicker from "../components/equipment/MonthPicker";
import PrintButton from "../components/PrintButton";
import { PrintHeader, PrintSignoff } from "../components/PrintSignoff";
import Icon from "../components/Icon";
import { currentMonthKey, monthLabel } from "../utils/months";
import { person } from "../person";
import CommissionTab from "./hassan/CommissionTab";
import TreasuryTab from "./hassan/TreasuryTab";
import ExpensesTab from "./hassan/ExpensesTab";
import LedgerTab from "./hassan/LedgerTab";
import WorkersTab from "./hassan/WorkersTab";

export default function Hassan() {
  const [month, setMonth] = useState(currentMonthKey());
  const [tab, setTab] = useState<"commission" | "treasury" | "funds" | "expenses" | "installments" | "workers" | "ledger">("commission");
  const printTitle =
    tab === "ledger"
      ? `حساب ${person()} الشخصي`
      : tab === "treasury"
        ? `خزنة ${person()}`
        : tab === "installments"
          ? `أقساط ${person()}`
        : tab === "funds"
          ? "الخزن (المكنيكي والسكن)"
        : tab === "expenses"
          ? `مصاريف التشغيل — ${person()}`
        : tab === "workers"
          ? `مرتبات عمال ${person()}`
          : `كوميشن ${person()}`;

  return (
    <div className="space-y-6">
      <PrintHeader title={printTitle} subtitle={`${monthLabel(month)} ${month.slice(0, 4)}`} />

      <div className="no-print flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{person()}</h1>
          <p className="text-sm text-slate-500 mt-1">كوميشن {person()} على تأجير المعدات، منفصل عن حسابه الشخصي.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PrintButton />
          <MonthPicker month={month} onChange={setMonth} />
        </div>
      </div>

      <div className="no-print flex flex-wrap gap-2">
        <button
          onClick={() => setTab("commission")}
          className={[
            "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
            tab === "commission" ? "bg-primary text-white shadow-sm" : "bg-white text-slate-600 hover:bg-primary-light hover:text-primary-dark shadow-card",
          ].join(" ")}
        >
          <Icon name="reports" className="w-4 h-4" />
          الكوميشن
        </button>
        <button
          onClick={() => setTab("treasury")}
          className={[
            "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
            tab === "treasury" ? "bg-primary text-white shadow-sm" : "bg-white text-slate-600 hover:bg-primary-light hover:text-primary-dark shadow-card",
          ].join(" ")}
        >
          <Icon name="treasury" className="w-4 h-4" />
          الكوميشن اللي في الخزنة
        </button>
        <button
          onClick={() => setTab("funds")}
          className={[
            "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
            tab === "funds" ? "bg-primary text-white shadow-sm" : "bg-white text-slate-600 hover:bg-primary-light hover:text-primary-dark shadow-card",
          ].join(" ")}
        >
          <Icon name="custody" className="w-4 h-4" />
          خزنة المكنيكي والسكن
        </button>
        <button
          onClick={() => setTab("expenses")}
          className={[
            "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
            tab === "expenses" ? "bg-primary text-white shadow-sm" : "bg-white text-slate-600 hover:bg-primary-light hover:text-primary-dark shadow-card",
          ].join(" ")}
        >
          <Icon name="flow" className="w-4 h-4" />
          مصاريف التشغيل
        </button>
        <button
          onClick={() => setTab("installments")}
          className={[
            "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
            tab === "installments" ? "bg-primary text-white shadow-sm" : "bg-white text-slate-600 hover:bg-primary-light hover:text-primary-dark shadow-card",
          ].join(" ")}
        >
          <Icon name="calendar" className="w-4 h-4" />
          الأقساط
        </button>
        <button
          onClick={() => setTab("workers")}
          className={[
            "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
            tab === "workers" ? "bg-primary text-white shadow-sm" : "bg-white text-slate-600 hover:bg-primary-light hover:text-primary-dark shadow-card",
          ].join(" ")}
        >
          <Icon name="salaries" className="w-4 h-4" />
          مرتبات العمال
        </button>
        <button
          onClick={() => setTab("ledger")}
          className={[
            "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
            tab === "ledger" ? "bg-primary text-white shadow-sm" : "bg-white text-slate-600 hover:bg-primary-light hover:text-primary-dark shadow-card",
          ].join(" ")}
        >
          <Icon name="hassan" className="w-4 h-4" />
          الحساب الشخصي
        </button>
      </div>

      {tab === "commission" && <CommissionTab month={month} />}
      {tab === "treasury" && <TreasuryTab month={month} />}
      {tab === "funds" && <FundsTab month={month} />}
      {tab === "installments" && <InstallmentsTab />}
      {tab === "expenses" && <ExpensesTab month={month} />}
      {tab === "workers" && <WorkersTab month={month} />}
      {tab === "ledger" && <LedgerTab month={month} />}

      <PrintSignoff />
    </div>
  );
}
