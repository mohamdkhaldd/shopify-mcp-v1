// المعدات ونسب الشركاء فيها
module.exports = function register(db, ipcMain, shared) {
  const { equipmentAllTimeProfit, pushToCloud } = shared;

  // --- Equipment (+ partner shares) ---
  // كل معدة بتحمل سعر شرائها، وبنحسب لها "رجعت كام في الميه من سعرها" من
  // صافي ربحها من أول ما بدأت (equipmentAllTimeProfit) — زي جدول الإكسيل
  // القديم اللي كان بيوضح إيه اللي اتشرا بكام وإيه اللي رجّع فلوسه.
  const getEquipmentWithShares = () => {
    const rows = db.prepare("SELECT * FROM equipment ORDER BY name").all();
    const shareStmt = db.prepare(
      "SELECT partner_id, percentage FROM equipment_partner_shares WHERE equipment_id = ?"
    );
    return rows.map((row) => {
      const allTimeProfit = equipmentAllTimeProfit(row.id);
      const roiPercent = row.purchase_price > 0 ? (allTimeProfit / row.purchase_price) * 100 : null;
      return { ...row, shares: shareStmt.all(row.id), allTimeProfit, roiPercent };
    });
  };

  ipcMain.handle("equipment:list", () => getEquipmentWithShares());

  ipcMain.handle("equipment:create", (_e, { name, purchase_price, shares }) => {
    const insertEquipment = db.prepare("INSERT INTO equipment (name, purchase_price) VALUES (?, ?)");
    const insertShare = db.prepare(
      "INSERT INTO equipment_partner_shares (equipment_id, partner_id, percentage) VALUES (?, ?, ?)"
    );
    const tx = db.transaction(() => {
      const info = insertEquipment.run(name.trim(), purchase_price ?? 0);
      const equipmentId = info.lastInsertRowid;
      for (const share of shares ?? []) {
        insertShare.run(equipmentId, share.partner_id, share.percentage);
      }
      return equipmentId;
    });
    const equipmentId = tx();
    const created = getEquipmentWithShares().find((e) => e.id === equipmentId);
    const partnerNameStmt = db.prepare("SELECT name FROM partners WHERE id = ?");
    pushToCloud("equipment", equipmentId, {
      name: created.name,
      purchase_price: created.purchase_price,
      shares: created.shares.map((s) => ({ partner_name: partnerNameStmt.get(s.partner_id)?.name ?? "", percentage: s.percentage })),
    });
    return created;
  });

  // بيسمح بتعديل سعر الشراء ونسب الشركاء من غير ما تحذف المعدة وتضيفها تاني
  // — شريك بيخرج وشريك جديد بيدخل مكانه، أو الباقيين بيشتروا حصته، من غير ما
  // يضيع تاريخ المعدة (السركي والمصروفات وكل حاجة بتفضل مربوطة بيها).
  ipcMain.handle("equipment:update", (_e, { id, purchase_price, shares }) => {
    const updateEquipment = db.prepare("UPDATE equipment SET purchase_price = ? WHERE id = ?");
    const deleteShares = db.prepare("DELETE FROM equipment_partner_shares WHERE equipment_id = ?");
    const insertShare = db.prepare(
      "INSERT INTO equipment_partner_shares (equipment_id, partner_id, percentage) VALUES (?, ?, ?)"
    );
    const tx = db.transaction(() => {
      updateEquipment.run(purchase_price ?? 0, id);
      deleteShares.run(id);
      for (const share of shares ?? []) {
        insertShare.run(id, share.partner_id, share.percentage);
      }
    });
    tx();
    const equipmentRow = db.prepare("SELECT * FROM equipment WHERE id = ?").get(id);
    const shareNames = (shares ?? []).map((s) => ({
      partner_name: db.prepare("SELECT name FROM partners WHERE id = ?").get(s.partner_id)?.name,
      percentage: s.percentage,
    }));
    pushToCloud("equipment", id, { name: equipmentRow.name, purchase_price: equipmentRow.purchase_price, shares: shareNames });
    return getEquipmentWithShares().find((e) => e.id === id);
  });

  ipcMain.handle("equipment:delete", (_e, { id }) => {
    db.prepare("DELETE FROM equipment WHERE id = ?").run(id);
    return { ok: true };
  });
};
