const { computeDayValue } = require("../calc");

// السركي اليومي والورديات
module.exports = function register(db, ipcMain, shared) {
  const { pushToCloud } = shared;

  // --- Daily logs (السركي / المقاول / سركي سوق — same table, different role) ---
  ipcMain.handle("dailyLogs:list", (_e, { equipment_id, month, role, shift_label }) => {
    const rows = db
      .prepare(
        "SELECT * FROM daily_logs WHERE equipment_id = ? AND role = ? AND shift_label = ? AND date LIKE ? ORDER BY date"
      )
      .all(equipment_id, role, shift_label ?? "", `${month}%`);
    return rows.map((row) => ({ ...row, day_value: computeDayValue(row) }));
  });

  const OTHER_HOURS_ROLE = { driver: "contractor", contractor: "driver" };

  const UPSERT_DAILY_LOG_SQL = `INSERT INTO daily_logs (equipment_id, date, role, shift_label, person_name, actual_hours, base_hours, day_rate, is_paid_leave, is_day_off, fixed_value, hassan_commission, note, site_name, overtime_rate)
       VALUES (@equipment_id, @date, @role, @shift_label, @person_name, @actual_hours, @base_hours, @day_rate, @is_paid_leave, @is_day_off, @fixed_value, @hassan_commission, @note, @site_name, @overtime_rate)
       ON CONFLICT(equipment_id, date, role, shift_label) DO UPDATE SET
         person_name = excluded.person_name,
         actual_hours = excluded.actual_hours,
         base_hours = excluded.base_hours,
         day_rate = excluded.day_rate,
         is_paid_leave = excluded.is_paid_leave,
         is_day_off = excluded.is_day_off,
         fixed_value = excluded.fixed_value,
         hassan_commission = excluded.hassan_commission,
         note = excluded.note,
         site_name = excluded.site_name,
         overtime_rate = excluded.overtime_rate`;

  function findDailyLog(db, equipmentId, date, role, shiftLabel) {
    return db
      .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND date = ? AND role = ? AND shift_label = ?")
      .get(equipmentId, date, role, shiftLabel ?? "");
  }

  // شيت المقاول هو المصدر الوحيد للأيام: الساعات/الأساسية/البيان/الموقع/علامة
  // "مشتغلش" بتتكتب فيه وبتتنسخ لشيت السركي لنفس المعدة واليوم والشيفت — مش
  // العكس. اسم السواق وسعر اليوم في السركي بيفضلوا زي ما هما، إلا في يوم
  // "مشتغلش": السعر بيتمسح، وعلامة "مدفوعة" (بتتحدد من شيت السركي نفسه)
  // بتبدأ مش مدفوعة واسم السواق بيتمسح — ولو اليوم كان متعلّم مشتغلش من قبل،
  // اختيار "مدفوعة" والسواق اللي في السركي بيفضلوا زي ما هما.
  // إجازة السائق الشهري المدفوعة في يوم شغل عادي (خاصة بمرتبه) مبتتلمسش.
  function mirrorContractorToDriver(db, contractorLog) {
    const shiftLabel = contractorLog.shift_label ?? "";
    const existing = findDailyLog(db, contractorLog.equipment_id, contractorLog.date, "driver", shiftLabel);
    const isDayOff = !!contractorLog.is_day_off;
    const isPaidDayOff = isDayOff && !!existing?.is_day_off && !!existing?.is_paid_leave;
    db.prepare(UPSERT_DAILY_LOG_SQL).run({
      equipment_id: contractorLog.equipment_id,
      date: contractorLog.date,
      role: "driver",
      shift_label: shiftLabel,
      person_name: isDayOff && !isPaidDayOff ? "" : existing?.person_name ?? "",
      actual_hours: contractorLog.actual_hours ?? null,
      base_hours: contractorLog.base_hours ?? null,
      day_rate: isDayOff ? null : existing?.day_rate ?? null,
      // خارج أيام "مشتغلش" العلامة دي معناها إجازة شهرية مدفوعة للسواق نفسه —
      // بتفضل زي ما هي، إلا لو كانت جاية من يوم "مشتغلش" مدفوع اتشال.
      is_paid_leave: isDayOff ? (isPaidDayOff ? 1 : 0) : existing?.is_day_off ? 0 : existing?.is_paid_leave ?? 0,
      is_day_off: isDayOff ? 1 : 0,
      fixed_value: existing?.fixed_value ?? null,
      hassan_commission: existing?.hassan_commission ?? null,
      note: contractorLog.note ?? null,
      site_name: contractorLog.site_name ?? null,
      overtime_rate: isDayOff ? null : existing?.overtime_rate ?? null,
    });
  }

  // One row per equipment/date/role/shift_label — matches the spreadsheet's
  // "one line per day of the month" layout, so saving a day's cells
  // overwrites that day's row instead of appending a new one.
  ipcMain.handle("dailyLogs:upsert", (_e, log) => {
    const shiftLabel = log.shift_label ?? "";
    const params = {
      equipment_id: log.equipment_id,
      date: log.date,
      role: log.role,
      shift_label: shiftLabel,
      person_name: log.person_name ?? "",
      actual_hours: log.actual_hours ?? null,
      base_hours: log.base_hours ?? null,
      day_rate: log.day_rate ?? null,
      is_paid_leave: log.is_paid_leave ? 1 : 0,
      is_day_off: log.is_day_off ? 1 : 0,
      fixed_value: log.fixed_value ?? null,
      hassan_commission: log.hassan_commission ?? null,
      note: log.note ?? null,
      site_name: log.site_name?.trim() || null,
      overtime_rate: log.overtime_rate ?? null,
    };
    // صف السركي مبيقدرش يغيّر الحاجات المشتركة مع المقاول — لو فيه صف مقاول
    // لنفس اليوم، الساعات/البيان/الموقع/علامة "مشتغلش" بتتاخد منه هو.
    if (log.role === "driver") {
      const master = findDailyLog(db, log.equipment_id, log.date, "contractor", shiftLabel);
      if (master) {
        params.actual_hours = master.actual_hours;
        params.base_hours = master.base_hours;
        params.note = master.note;
        params.site_name = master.site_name;
        params.is_day_off = master.is_day_off ? 1 : 0;
      }
    }
    // "مدفوعة" معناها بس في شيت السركي (مين السواق اللي هياخد اليوم).
    if (log.role === "contractor") params.is_paid_leave = 0;
    if (params.is_day_off) {
      params.day_rate = null;
      params.overtime_rate = null;
      params.actual_hours = null;
      params.base_hours = null;
      if (!params.is_paid_leave) params.person_name = "";
    }
    db.prepare(UPSERT_DAILY_LOG_SQL).run(params);
    if (log.role === "contractor") mirrorContractorToDriver(db, params);
    const row = findDailyLog(db, log.equipment_id, log.date, log.role, shiftLabel);
    const equipmentName = db.prepare("SELECT name FROM equipment WHERE id = ?").get(log.equipment_id)?.name;
    if (equipmentName) {
      pushToCloud("daily_logs", row.id, { ...row, equipment_name: equipmentName });
      if (log.role === "contractor") {
        const counterpart = findDailyLog(db, log.equipment_id, log.date, "driver", shiftLabel);
        if (counterpart) pushToCloud("daily_logs", counterpart.id, { ...counterpart, equipment_name: equipmentName });
      }
    }
    return { ...row, day_value: computeDayValue(row) };
  });

  ipcMain.handle("dailyLogs:delete", (_e, { id }) => {
    const log = db.prepare("SELECT * FROM daily_logs WHERE id = ?").get(id);
    db.prepare("DELETE FROM daily_logs WHERE id = ?").run(id);
    // يوم اتمسح من شيت المقاول (المصدر) بيتمسح من السركي بردو، بشرط يبقوا في
    // نفس الشيفت. مسح يوم من السركي مبيلمسش المقاول.
    if (log && log.role === "contractor") {
      db.prepare("DELETE FROM daily_logs WHERE equipment_id = ? AND date = ? AND role = 'driver' AND shift_label = ?").run(
        log.equipment_id,
        log.date,
        log.shift_label ?? ""
      );
    }
    return { ok: true };
  });

  // أيام اتسجلت في شيت واحد بس (مقاول متكتب فيه الاسم والسعر والسركي فاضي،
  // أو العكس) — بتتعلّم في صفحة المعدات بالأحمر عشان متتنسيش. أيام "مشتغلش"
  // مش داخلة. بيرجع لكل معدة: الشهور اللي فيها نقص وعدد الأيام في كل شهر.
  ipcMain.handle("equipment:sheetMismatches", () => {
    const filled = (alias) =>
      `${alias}.is_day_off = 0 AND ${alias}.person_name != '' AND COALESCE(${alias}.day_rate, 0) > 0`;
    const rows = db
      .prepare(
        `SELECT a.equipment_id, substr(a.date, 1, 7) AS month, a.date
         FROM daily_logs a
         LEFT JOIN daily_logs b ON b.equipment_id = a.equipment_id AND b.date = a.date
           AND b.shift_label = a.shift_label AND b.role = CASE a.role WHEN 'contractor' THEN 'driver' ELSE 'contractor' END
         WHERE a.role IN ('contractor', 'driver') AND ${filled("a")}
           AND (b.id IS NULL OR NOT (${filled("b")}))`
      )
      .all();
    const byEquipment = new Map();
    for (const r of rows) {
      if (!byEquipment.has(r.equipment_id)) byEquipment.set(r.equipment_id, new Map());
      const months = byEquipment.get(r.equipment_id);
      if (!months.has(r.month)) months.set(r.month, new Set());
      months.get(r.month).add(r.date);
    }
    return [...byEquipment.entries()].map(([equipment_id, months]) => ({
      equipment_id,
      months: [...months.entries()].sort().map(([month, dates]) => ({ month, days: dates.size })),
    }));
  });

  // --- Equipment shifts (وردية إضافية زي "وردية 2" لمعدة اشتغلت بأكتر من
  // شيفت في نفس اليوم) — الشيفت الأساسي (shift_label = '') ضمني ومالوش سطر
  // هنا، دي بس للشيفتات الإضافية اللي المستخدم بيسميها بنفسه. ---
  ipcMain.handle("equipmentShifts:list", (_e, { equipment_id }) =>
    db.prepare("SELECT * FROM equipment_shifts WHERE equipment_id = ? ORDER BY id").all(equipment_id)
  );
  ipcMain.handle("equipmentShifts:create", (_e, { equipment_id, label }) => {
    const trimmed = (label ?? "").trim();
    if (!trimmed) throw new Error("لازم اسم للشيفت");
    const info = db
      .prepare("INSERT INTO equipment_shifts (equipment_id, label, created_at) VALUES (?, ?, ?)")
      .run(equipment_id, trimmed, new Date().toISOString());
    const created = { id: info.lastInsertRowid, equipment_id, label: trimmed };
    const equipmentName = db.prepare("SELECT name FROM equipment WHERE id = ?").get(equipment_id)?.name;
    if (equipmentName) pushToCloud("equipment_shifts", created.id, { ...created, equipment_name: equipmentName });
    return created;
  });

  // معدة جديدة غالبًا هتشتغل بنفس ساعات ودوام معدة قديمة (نفس مواعيد الورديات
  // والأوفر تايم) — بننسخ الساعات/الأساسية/الأوفر تايم/علامة "مشتغلش"/البيان
  // بس من شيت المقاول بتاع المعدة المصدر لنفس الشهر، وبيتزامنوا لشيت السركي
  // تلقائيًا زي أي تعديل عادي. الاسم وسعر اليوم (في السركي والمقاول) بيفضلوا
  // زي ما هما عند المعدة الهدف من غير ما نلمسهم — لازم يتحددوا يدويًا بعد
  // النسخ لأن السواق/المقاول وسعره مختلفين عن المعدة التانية.
  ipcMain.handle(
    "dailyLogs:copyFromEquipment",
    (_e, { target_equipment_id, source_equipment_id, month, source_shift_label, target_shift_label }) => {
      const sourceShift = source_shift_label ?? "";
      const targetShift = target_shift_label ?? "";
      const sourceLogs = db
        .prepare("SELECT * FROM daily_logs WHERE equipment_id = ? AND role = 'contractor' AND shift_label = ? AND date LIKE ?")
        .all(source_equipment_id, sourceShift, `${month}%`);
      const copy = db.transaction((logs) => {
        for (const src of logs) {
          const existing = findDailyLog(db, target_equipment_id, src.date, "contractor", targetShift);
          const params = {
            equipment_id: target_equipment_id,
            date: src.date,
            role: "contractor",
            shift_label: targetShift,
            person_name: src.is_day_off ? "" : existing?.person_name ?? "",
            actual_hours: src.actual_hours,
            base_hours: src.base_hours,
            day_rate: src.is_day_off ? null : existing?.day_rate ?? null,
            is_paid_leave: 0,
            is_day_off: src.is_day_off ? 1 : 0,
            fixed_value: existing?.fixed_value ?? null,
            hassan_commission: existing?.hassan_commission ?? null,
            note: src.note,
            site_name: existing?.site_name ?? null,
            overtime_rate: src.is_day_off ? null : existing?.overtime_rate ?? null,
          };
          db.prepare(UPSERT_DAILY_LOG_SQL).run(params);
          mirrorContractorToDriver(db, params);
        }
      });
      copy(sourceLogs);
      return { count: sourceLogs.length };
    }
  );
};
