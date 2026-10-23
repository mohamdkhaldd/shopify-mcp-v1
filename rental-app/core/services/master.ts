import { Db, UserError } from "../db";

export type RateKey = "vat" | "tax5" | "management_share" | "investors_share";

/** The percentage (bp) in force on `date`. */
export function rateAt(db: Db, key: RateKey, date: string): number {
  const row = db
    .prepare("SELECT value_bp FROM rate_settings WHERE key = ? AND effective_from <= ? ORDER BY effective_from DESC LIMIT 1")
    .get(key, date);
  if (!row) throw new Error(`no ${key} rate on ${date}`);
  return row.value_bp;
}

/** Management + investors shares always add up to 100%, so they change together. */
export function setRates(db: Db, effectiveFrom: string, rates: Partial<Record<RateKey, number>>) {
  const mgmt = rates.management_share;
  const inv = rates.investors_share;
  if ((mgmt == null) !== (inv == null)) throw new UserError("نسبة الإدارة ونسبة المستثمرين لازم يتغيروا مع بعض");
  if (mgmt != null && inv != null && mgmt + inv !== 10_000) throw new UserError("نسبة الإدارة + نسبة المستثمرين لازم = ١٠٠٪");
  const ins = db.prepare("INSERT INTO rate_settings (key, value_bp, effective_from) VALUES (?, ?, ?)");
  db.transaction(() => {
    for (const [k, v] of Object.entries(rates)) ins.run(k, v, effectiveFrom);
  })();
}

const id = (r: { lastInsertRowid: number | bigint }) => Number(r.lastInsertRowid);

export function createInvestor(db: Db, v: { name: string; phone?: string; notes?: string }) {
  return id(db.prepare("INSERT INTO investors (name, phone, notes) VALUES (?, ?, ?)").run(v.name.trim(), v.phone ?? null, v.notes ?? null));
}

export function createSupplier(db: Db, v: { name: string; phone?: string; notes?: string }) {
  return id(db.prepare("INSERT INTO suppliers (name, phone, notes) VALUES (?, ?, ?)").run(v.name.trim(), v.phone ?? null, v.notes ?? null));
}

/** Companies default to VAT + 5%; individuals default to neither. Both can be switched per client. */
export function createClient(
  db: Db,
  v: { kind: "company" | "individual"; name: string; phone?: string; taxId?: string; vatApplies?: boolean; tax5Applies?: boolean },
) {
  const isCompany = v.kind === "company";
  return id(
    db
      .prepare("INSERT INTO clients (kind, name, phone, tax_id, vat_applies, tax5_applies) VALUES (?, ?, ?, ?, ?, ?)")
      .run(v.kind, v.name.trim(), v.phone ?? null, v.taxId ?? null, Number(v.vatApplies ?? isCompany), Number(v.tax5Applies ?? isCompany)),
  );
}

export function setClientTaxes(db: Db, clientId: number, vatApplies: boolean, tax5Applies: boolean) {
  db.prepare("UPDATE clients SET vat_applies = ?, tax5_applies = ? WHERE id = ?").run(Number(vatApplies), Number(tax5Applies), clientId);
}

export function createEquipment(db: Db, v: { name: string; supplierId: number; siteName?: string; supplierRatePt?: number }) {
  return id(
    db
      .prepare("INSERT INTO equipment (name, supplier_id, site_name, supplier_rate_pt) VALUES (?, ?, ?, ?)")
      .run(v.name.trim(), v.supplierId, v.siteName ?? null, v.supplierRatePt ?? null),
  );
}

export interface ContractInput {
  clientId: number;
  equipmentId: number;
  unit: "day" | "month";
  clientRatePt: number;
  supplierRatePt: number;
  startDate: string;
  endDate?: string;
  siteName?: string;
  notes?: string;
}

export function createContract(db: Db, v: ContractInput) {
  const eq = db.prepare("SELECT supplier_id, site_name FROM equipment WHERE id = ? AND deleted_at IS NULL").get(v.equipmentId);
  if (!eq) throw new UserError("المعدة دي مش موجودة");
  const year = v.startDate.slice(0, 4);
  const seq = db.prepare("SELECT COUNT(*) AS n FROM contracts WHERE code LIKE ?").get(`ع-${year}-%`).n + 1;
  const code = `ع-${year}-${String(seq).padStart(3, "0")}`;
  return id(
    db
      .prepare(
        `INSERT INTO contracts (code, client_id, equipment_id, supplier_id, unit, client_rate_pt, supplier_rate_pt, site_name, start_date, end_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(code, v.clientId, v.equipmentId, eq.supplier_id, v.unit, v.clientRatePt, v.supplierRatePt, v.siteName ?? eq.site_name ?? null, v.startDate, v.endDate ?? null, v.notes ?? null),
  );
}

export function getContract(db: Db, contractId: number) {
  const c = db.prepare("SELECT * FROM contracts WHERE id = ? AND deleted_at IS NULL").get(contractId);
  if (!c) throw new UserError("العقد ده مش موجود");
  return c as {
    id: number;
    code: string;
    client_id: number;
    equipment_id: number;
    supplier_id: number;
    unit: "day" | "month";
    client_rate_pt: number;
    supplier_rate_pt: number;
    site_name: string | null;
    start_date: string;
    end_date: string | null;
    status: string;
  };
}

export function createExpenseCategory(db: Db, name: string) {
  return id(db.prepare("INSERT INTO expense_categories (name) VALUES (?)").run(name.trim()));
}

/**
 * The "عقد جديد" form in one step: the client, the equipment owner and the
 * equipment can each be an existing id or a new one typed in the same form.
 */
export interface NewContractInput {
  client: { id: number } | { kind: "company" | "individual"; name: string; taxId?: string; vatApplies?: boolean; tax5Applies?: boolean };
  equipment: { id: number } | { name: string; siteName?: string; supplier: { id: number } | { name: string; phone?: string } };
  unit: "day" | "month";
  clientRatePt: number;
  supplierRatePt: number;
  startDate: string;
  endDate?: string;
  siteName?: string;
}

export function newContract(db: Db, v: NewContractInput) {
  if (!(v.clientRatePt > 0) || !(v.supplierRatePt > 0)) throw new UserError("اكتب سعر الشركة وسعر صاحب المعدة");
  if (v.endDate && v.endDate < v.startDate) throw new UserError("تاريخ النهاية قبل تاريخ البداية");
  return db.transaction(() => {
    const clientId = "id" in v.client ? v.client.id : createClient(db, v.client);
    let equipmentId: number;
    if ("id" in v.equipment) equipmentId = v.equipment.id;
    else {
      const sup = v.equipment.supplier;
      const supplierId = "id" in sup ? sup.id : createSupplier(db, sup);
      equipmentId = createEquipment(db, { name: v.equipment.name, supplierId, siteName: v.equipment.siteName ?? v.siteName, supplierRatePt: v.supplierRatePt });
    }
    return createContract(db, {
      clientId,
      equipmentId,
      unit: v.unit,
      clientRatePt: v.clientRatePt,
      supplierRatePt: v.supplierRatePt,
      startDate: v.startDate,
      endDate: v.endDate,
      siteName: v.siteName,
    });
  })();
}

export function updateSupplier(db: Db, id: number, v: { name: string; phone?: string | null; notes?: string | null }) {
  if (!v.name.trim()) throw new UserError("اكتب اسم صاحب المعدة");
  db.prepare("UPDATE suppliers SET name = ?, phone = ?, notes = ? WHERE id = ? AND deleted_at IS NULL").run(v.name.trim(), v.phone ?? null, v.notes ?? null, id);
}

/** Name, site and the agreed day rate — what the owner's page shows for each machine. */
export function updateEquipment(db: Db, id: number, v: { name: string; siteName?: string | null; supplierRatePt?: number | null }) {
  if (!v.name.trim()) throw new UserError("اكتب اسم المعدة");
  db.prepare("UPDATE equipment SET name = ?, site_name = ?, supplier_rate_pt = ? WHERE id = ? AND deleted_at IS NULL").run(v.name.trim(), v.siteName ?? null, v.supplierRatePt ?? null, id);
}

export function updateClient(db: Db, id: number, v: { kind: "company" | "individual"; name: string; phone?: string | null; taxId?: string | null }) {
  if (!v.name.trim()) throw new UserError("اكتب اسم الشركة أو الفرد");
  db.prepare("UPDATE clients SET kind = ?, name = ?, phone = ?, tax_id = ? WHERE id = ? AND deleted_at IS NULL").run(v.kind, v.name.trim(), v.phone ?? null, v.taxId ?? null, id);
}
