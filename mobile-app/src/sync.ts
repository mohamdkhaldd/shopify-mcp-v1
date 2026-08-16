import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

const DEVICE_ID_KEY = "al-bunyan-device-id";

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function syncKeyFor(localId: number): string {
  return `${getDeviceId()}_${localId}`;
}

// --- كاش أسماء بسيط: بنسيب الجداول المرجعية (معدات/موظفين/شركاء/أنواع
// مصروفات) في الذاكرة عشان لما نستقبل صف من daily_logs/monthly_expenses/...
// (بيحمل equipment_id رقم حقيقي مش اسم) نقدر نترجمه لاسم ونبعته لـ store.ts
// اللي بيتوقع الاسم مش الرقم (نفس شكل بيانات الموبايل تمامًا). ---
const equipmentNames = new Map<number, string>();
const employeeNames = new Map<number, string>();
const partnerNames = new Map<number, string>();
const categoryNames = new Map<number, string>();
const supplierNames = new Map<number, string>();
const contractorNames = new Map<number, string>();

async function getOrCreateByName(table: string, name: string, extra: Record<string, unknown> = {}): Promise<number | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from(table)
    .upsert({ name: trimmed, ...extra }, { onConflict: "name", ignoreDuplicates: false })
    .select("id")
    .single();
  if (error || !data) {
    // فشل الـ upsert (زي مشكلة صلاحيات مؤقتة) — نجرب نقرا الصف لو موجود أصلًا
    const { data: existing } = await supabase.from(table).select("id").eq("name", trimmed).maybeSingle();
    return existing?.id ?? null;
  }
  return data.id as number;
}

async function findIdByName(table: string, name: string): Promise<number | null> {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const { data } = await supabase.from(table).select("id").eq("name", trimmed).maybeSingle();
  return data?.id ?? null;
}

// --- بعت للسحابة. الجداول المرجعية (اسمها UNIQUE) بتتعمل upsert بالاسم —
// نفس الاسم من أي جهاز بيبقى نفس الصف دايمًا. جداول القيود (مصروفات/سلف/
// حوافز/خصومات/دفعات مرتب) بتتعمل upsert بمفتاح sync_key فريد لكل جهاز
// عشان القيد ميتكررش. السركي/المقاول/سركي سوق ليهم مفتاح طبيعي
// (equipment_id + date + role) فمحتاجينش sync_key خالص. ---
// بيبعت تعديل على جدول مرجعي (اسمه UNIQUE). لو الاسم القديم موجود وغير عن
// الاسم الجديد (يعني إعادة تسمية)، بيعمل تحديث على نفس الصف بالاسم القديم
// عشان الصف يفضل واحد بس، مش يتكرر تحت الاسم الجديد. لو مفيش صف بالاسم
// القديم أصلًا (لسه ما اتبعتش قبل كده)، بيرجع لـ upsert عادي بالاسم الجديد.
async function upsertByName(table: string, newName: string, fields: Record<string, unknown>, oldName?: string) {
  const trimmed = newName.trim();
  if (oldName && oldName.trim() && oldName.trim() !== trimmed) {
    const { data, error } = await supabase.from(table).update({ name: trimmed, ...fields }).eq("name", oldName.trim()).select("id");
    if (!error && data && data.length > 0) return;
  }
  await supabase.from(table).upsert({ name: trimmed, ...fields }, { onConflict: "name" });
}

export async function pushToCloud(collectionName: string, localId: number, data: Record<string, unknown>) {
  try {
    switch (collectionName) {
      case "partners":
      case "contractors": {
        await upsertByName(collectionName, data.name as string, { opening_balance: data.opening_balance ?? 0 });
        return;
      }
      case "employees": {
        await upsertByName(
          "employees",
          data.name as string,
          { wage_type: data.wage_type, rate: data.rate, fixed_salary: data.fixed_salary },
          data.old_name as string | undefined
        );
        return;
      }
      case "expense_categories": {
        await upsertByName(
          "expense_categories",
          data.name as string,
          { counts_as_commission: data.counts_as_commission },
          data.old_name as string | undefined
        );
        return;
      }
      case "equipment": {
        await upsertByName("equipment", data.name as string, { purchase_price: data.purchase_price ?? 0 });
        const equipmentId = await findIdByName("equipment", data.name as string);
        if (!equipmentId) return;
        const shares = Array.isArray(data.shares) ? (data.shares as { partner_name: string; percentage: number }[]) : [];
        const keptPartnerIds: number[] = [];
        for (const share of shares) {
          const partnerId = await getOrCreateByName("partners", share.partner_name);
          if (!partnerId) continue;
          keptPartnerIds.push(partnerId);
          await supabase
            .from("equipment_partner_shares")
            .upsert({ equipment_id: equipmentId, partner_id: partnerId, percentage: share.percentage }, { onConflict: "equipment_id,partner_id" });
        }
        let deleteQuery = supabase.from("equipment_partner_shares").delete().eq("equipment_id", equipmentId);
        if (keptPartnerIds.length > 0) deleteQuery = deleteQuery.not("partner_id", "in", `(${keptPartnerIds.join(",")})`);
        await deleteQuery;
        return;
      }
      case "daily_logs": {
        const equipmentId = await getOrCreateByName("equipment", data.equipment_name as string);
        if (!equipmentId) return;
        await supabase.from("daily_logs").upsert(
          {
            equipment_id: equipmentId,
            date: data.date,
            role: data.role,
            shift_label: data.shift_label ?? "",
            person_name: data.person_name ?? "",
            actual_hours: data.actual_hours,
            base_hours: data.base_hours,
            day_rate: data.day_rate,
            is_day_off: data.is_day_off,
            fixed_value: data.fixed_value,
            hassan_commission: data.hassan_commission,
            note: data.note,
          },
          { onConflict: "equipment_id,date,role,shift_label" }
        );
        return;
      }
      case "monthly_expenses": {
        const equipmentId = await getOrCreateByName("equipment", data.equipment_name as string);
        if (!equipmentId) return;
        const categoryId = data.category_name ? await getOrCreateByName("expense_categories", data.category_name as string) : null;
        await supabase.from("monthly_expenses").upsert(
          {
            equipment_id: equipmentId,
            month: data.month,
            date: data.date,
            category_id: categoryId,
            amount: data.amount,
            payment_method: data.payment_method,
            note: data.note,
            sync_key: syncKeyFor(localId),
          },
          { onConflict: "sync_key" }
        );
        return;
      }
      case "payroll_entries": {
        const employeeId = await findIdByName("employees", data.employee_name as string);
        if (!employeeId) return;
        await supabase.from("payroll_entries").upsert(
          {
            employee_id: employeeId,
            kind: data.kind,
            month: data.month,
            date: data.date,
            amount: data.amount,
            payment_method: data.payment_method,
            reason: data.reason,
            sync_key: syncKeyFor(localId),
          },
          { onConflict: "sync_key" }
        );
        return;
      }
      case "salary_payments": {
        const employeeId = await findIdByName("employees", data.employee_name as string);
        if (!employeeId) return;
        await supabase.from("salary_payments").upsert(
          {
            employee_id: employeeId,
            month: data.month,
            date: data.date,
            amount: data.amount,
            payment_method: data.payment_method,
            note: data.note,
            sync_key: syncKeyFor(localId),
          },
          { onConflict: "sync_key" }
        );
        return;
      }
      case "hassan_ledger": {
        await supabase.from("hassan_ledger").upsert(
          {
            date: data.date,
            type: data.type,
            amount: data.amount,
            party_name: data.party_name,
            description: data.description,
            note: data.note,
            sync_key: syncKeyFor(localId),
          },
          { onConflict: "sync_key" }
        );
        return;
      }
      case "hassan_treasury_expenses": {
        await supabase.from("hassan_treasury_expenses").upsert(
          { date: data.date, amount: data.amount, description: data.description, sync_key: syncKeyFor(localId) },
          { onConflict: "sync_key" }
        );
        return;
      }
      case "waste_entries": {
        await supabase.from("waste_entries").upsert(
          { date: data.date, amount: data.amount, payment_method: data.payment_method, note: data.note, sync_key: syncKeyFor(localId) },
          { onConflict: "sync_key" }
        );
        return;
      }
      case "supplier_purchases": {
        const supplierId = await getOrCreateByName("suppliers", data.supplier_name as string);
        if (!supplierId) return;
        await supabase.from("supplier_purchases").upsert(
          {
            supplier_id: supplierId,
            date: data.date,
            description: data.description,
            amount: data.amount,
            note: data.note,
            sync_key: syncKeyFor(localId),
          },
          { onConflict: "sync_key" }
        );
        return;
      }
      case "supplier_payments": {
        const supplierId = await getOrCreateByName("suppliers", data.supplier_name as string);
        if (!supplierId) return;
        await supabase.from("supplier_payments").upsert(
          {
            supplier_id: supplierId,
            date: data.date,
            amount: data.amount,
            method: data.method,
            note: data.note,
            sync_key: syncKeyFor(localId),
          },
          { onConflict: "sync_key" }
        );
        return;
      }
      case "contractor_payments": {
        const contractorId = await getOrCreateByName("contractors", data.contractor_name as string);
        if (!contractorId) return;
        await supabase.from("contractor_payments").upsert(
          {
            contractor_id: contractorId,
            date: data.date,
            amount: data.amount,
            method: data.method,
            note: data.note,
            sync_key: syncKeyFor(localId),
          },
          { onConflict: "sync_key" }
        );
        return;
      }
      case "partner_payments": {
        const partnerId = await getOrCreateByName("partners", data.partner_name as string);
        if (!partnerId) return;
        await supabase.from("partner_payments").upsert(
          {
            partner_id: partnerId,
            date: data.date,
            amount: data.amount,
            method: data.method,
            note: data.note,
            sync_key: syncKeyFor(localId),
          },
          { onConflict: "sync_key" }
        );
        return;
      }
    }
  } catch {
    // مفيش نت أو حصل خطأ مؤقت — التعديل محفوظ محليًا وهيتحاول يتبعت تاني
    // المرة الجاية اللي بيانات بتتغير فيها (Supabase مالوش طابور تلقائي زي
    // Firestore، فلو محتاج ضمان تام لازم تدوس "ابعت كل البيانات" من الإعدادات).
  }
}

// بيمسح من السحابة فعليًا (مش بس محليًا) — عشان أرقام الشريك (اللي بتتحسب
// من السحابة مباشرة) تتحدث فورًا. daily_logs ليه مفتاح طبيعي
// (equipment_id+date+role) فمحتاجينش sync_key، لازم بس نمرر match. جداول
// القيود التانية بتتمسح بمفتاح sync_key بتاعها.
export async function deleteFromCloud(collectionName: string, localId: number, match?: Record<string, unknown>) {
  try {
    switch (collectionName) {
      case "daily_logs": {
        if (!match) return;
        const equipmentId = await findIdByName("equipment", match.equipment_name as string);
        if (!equipmentId) return;
        await supabase
          .from("daily_logs")
          .delete()
          .eq("equipment_id", equipmentId)
          .eq("date", match.date as string)
          .eq("role", match.role as string)
          .eq("shift_label", (match.shift_label as string) ?? "");
        return;
      }
      case "monthly_expenses":
      case "payroll_entries":
      case "salary_payments":
      case "contractor_payments":
      case "partner_payments": {
        await supabase.from(collectionName).delete().eq("sync_key", syncKeyFor(localId));
        return;
      }
    }
  } catch {
    // مفيش نت — اتمسحت محليًا بس دلوقتي، هتتمسح من السحابة تاني مرة يبقى فيه نت
  }
}

type RemoteDocHandler = (collectionName: string, docId: string, data: Record<string, unknown>) => void;

let started = false;
const channels: RealtimeChannel[] = [];

async function primeNameCaches() {
  const [{ data: eq }, { data: emp }, { data: pt }, { data: cat }, { data: sup }, { data: con }] = await Promise.all([
    supabase.from("equipment").select("id,name"),
    supabase.from("employees").select("id,name"),
    supabase.from("partners").select("id,name"),
    supabase.from("expense_categories").select("id,name"),
    supabase.from("suppliers").select("id,name"),
    supabase.from("contractors").select("id,name"),
  ]);
  for (const r of eq ?? []) equipmentNames.set(r.id, r.name);
  for (const r of emp ?? []) employeeNames.set(r.id, r.name);
  for (const r of pt ?? []) partnerNames.set(r.id, r.name);
  for (const r of cat ?? []) categoryNames.set(r.id, r.name);
  for (const r of sup ?? []) supplierNames.set(r.id, r.name);
  for (const r of con ?? []) contractorNames.set(r.id, r.name);
}

export async function startCloudSync(onRemoteChange: RemoteDocHandler) {
  if (started) return;
  started = true;
  await primeNameCaches();
  const ownDeviceId = getDeviceId();

  function subscribe(
    table: string,
    translate: (
      row: Record<string, unknown>,
      old?: Record<string, unknown>
    ) => Record<string, unknown> | null | Promise<Record<string, unknown> | null>
  ) {
    const channel = supabase
      .channel(`sync-${table}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table }, async (payload) => {
        const row = payload.new as Record<string, unknown>;
        const syncKey = typeof row.sync_key === "string" ? row.sync_key : "";
        if (syncKey.startsWith(`${ownDeviceId}_`)) return;
        const translated = await translate(row);
        if (translated) onRemoteChange(table, syncKey || String(row.id), translated);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table }, async (payload) => {
        const row = payload.new as Record<string, unknown>;
        const syncKey = typeof row.sync_key === "string" ? row.sync_key : "";
        const translated = await translate(row, payload.old as Record<string, unknown>);
        if (translated) onRemoteChange(table, syncKey || String(row.id), translated);
      })
      .subscribe();
    channels.push(channel);
  }

  // بيرجّع اسم الصف القديم لو الصف اتغيّر اسمه فعلًا (يعني عملية إعادة تسمية،
  // مش مجرد تعديل رقم زي الرصيد) — عشان mergeRemoteRecord يعرف يلاقي نفس
  // السجل محليًا بدل ما يعمل واحد جديد مكرر. لازم replica identity full على
  // الجدول ده عشان old.name يوصل أصلًا، وإلا هيبقى undefined دايمًا.
  function renameInfo(row: Record<string, unknown>, old?: Record<string, unknown>) {
    const oldName = old?.name as string | undefined;
    return oldName && oldName !== row.name ? { old_name: oldName } : {};
  }

  subscribe("partners", (row) => {
    partnerNames.set(row.id as number, row.name as string);
    return { name: row.name, opening_balance: row.opening_balance };
  });
  subscribe("contractors", (row) => {
    contractorNames.set(row.id as number, row.name as string);
    return { name: row.name, opening_balance: row.opening_balance };
  });
  subscribe("employees", (row, old) => {
    employeeNames.set(row.id as number, row.name as string);
    return { name: row.name, wage_type: row.wage_type, rate: row.rate, fixed_salary: row.fixed_salary, ...renameInfo(row, old) };
  });
  subscribe("expense_categories", (row, old) => {
    categoryNames.set(row.id as number, row.name as string);
    return { name: row.name, counts_as_commission: row.counts_as_commission, ...renameInfo(row, old) };
  });
  subscribe("equipment", async (row) => {
    equipmentNames.set(row.id as number, row.name as string);
    const { data: shareRows } = await supabase
      .from("equipment_partner_shares")
      .select("percentage, partners(name)")
      .eq("equipment_id", row.id as number);
    const shares = (shareRows ?? [])
      .map((s) => ({ partner_name: (s.partners as unknown as { name: string } | null)?.name, percentage: s.percentage }))
      .filter((s) => s.partner_name);
    return { name: row.name, purchase_price: row.purchase_price, shares };
  });
  subscribe("daily_logs", (row) => {
    const equipmentName = equipmentNames.get(row.equipment_id as number);
    if (!equipmentName) return null;
    return { ...row, equipment_name: equipmentName };
  });
  subscribe("monthly_expenses", (row) => {
    const equipmentName = equipmentNames.get(row.equipment_id as number);
    if (!equipmentName) return null;
    const categoryName = row.category_id ? categoryNames.get(row.category_id as number) ?? "" : "";
    return { ...row, equipment_name: equipmentName, category_name: categoryName };
  });
  subscribe("payroll_entries", (row) => {
    const employeeName = employeeNames.get(row.employee_id as number);
    if (!employeeName) return null;
    return { ...row, employee_name: employeeName };
  });
  subscribe("salary_payments", (row) => {
    const employeeName = employeeNames.get(row.employee_id as number);
    if (!employeeName) return null;
    return { ...row, employee_name: employeeName };
  });
  subscribe("hassan_ledger", (row) => ({ ...row }));
  subscribe("hassan_treasury_expenses", (row) => ({ ...row }));
  subscribe("waste_entries", (row) => ({ ...row }));
  subscribe("suppliers", (row) => {
    supplierNames.set(row.id as number, row.name as string);
    return { name: row.name };
  });
  subscribe("supplier_purchases", (row) => {
    const supplierNameVal = supplierNames.get(row.supplier_id as number);
    if (!supplierNameVal) return null;
    return { ...row, supplier_name: supplierNameVal };
  });
  subscribe("supplier_payments", (row) => {
    const supplierNameVal = supplierNames.get(row.supplier_id as number);
    if (!supplierNameVal) return null;
    return { ...row, supplier_name: supplierNameVal };
  });
  subscribe("contractor_payments", (row) => {
    const contractorNameVal = contractorNames.get(row.contractor_id as number);
    if (!contractorNameVal) return null;
    return { ...row, contractor_name: contractorNameVal };
  });
  subscribe("partner_payments", (row) => {
    const partnerNameVal = partnerNames.get(row.partner_id as number);
    if (!partnerNameVal) return null;
    return { ...row, partner_name: partnerNameVal };
  });
}
