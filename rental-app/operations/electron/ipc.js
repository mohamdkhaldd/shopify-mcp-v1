const { wrapIpc, setFeeDb } = require("./fees");
const ipcMain = wrapIpc(require("electron").ipcMain);
const { registerExtraHandlers } = require("./extras");
const makeShared = require("./shared");
const { pushToCloud } = require("./sync");

// كل قنوات برنامج التشغيل: كل قسم في ملف لوحده جوه handlers/،
// والحسابات المشتركة في calc.js و shared.js.
const SECTIONS = [
  require("./handlers/partners"),
  require("./handlers/employees"),
  require("./handlers/contractors"),
  require("./handlers/expenseCategories"),
  require("./handlers/equipment"),
  require("./handlers/dailyLogs"),
  require("./handlers/monthlyExpenses"),
  require("./handlers/equipmentProfit"),
  require("./handlers/payrollExtras"),
  require("./handlers/payroll"),
  require("./handlers/hassanCommission"),
  require("./handlers/hassanTreasury"),
  require("./handlers/hassanWorkers"),
  require("./handlers/hassanLedger"),
  require("./handlers/contractorPayments"),
  require("./handlers/partnerPayments"),
  require("./handlers/treasury"),
  require("./handlers/payables"),
  require("./handlers/suppliers"),
  require("./handlers/reports"),
  require("./handlers/dashboard"),
  require("./handlers/cashLedger"),
  require("./handlers/system"),
];

function registerIpcHandlers(db) {
  setFeeDb(db);
  // pushToCloud: المزامنة بتتبعت من هنا (على التابلت ملف sync بيتبدل بنسخة المتصفح)
  const shared = { ...makeShared(db), pushToCloud };
  for (const register of SECTIONS) register(db, ipcMain, shared);
  registerExtraHandlers(db, { payrollSummary: shared.payrollSummary, partnersSummary: shared.partnersSummary });
}

module.exports = { registerIpcHandlers };
