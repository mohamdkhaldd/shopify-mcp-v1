// منقول من البرنامج القديم (accounting-app/electron/syncEngine.js) زي ما هو،
// مع تعديلين لبرنامج التشغيل جوه MK-Tech: كل عميل بيدخل بحساب مساحته اللي
// جاي مع كود التفعيل (ensureLogin)، وجلسة الدخول ليها اسم مختلف عن التأجير.
// محرك المزامنة بين الأجهزة (اللاب والتابلت) عن طريق Supabase.
//
// الفكرة: كل جدول في القاعدة بياخد عمود gid (رقم عالمي ثابت للصف على كل
// الأجهزة)، وتريجرات SQLite بتسجل أي إضافة/تعديل/مسح في sync_outbox تلقائيًا
// — من غير ما نلمس كود الشاشات أو الحسابات خالص. المحرك بيبعت الصفوف دي
// لجدول واحد في السحابة (sync_rows) وبيستقبل تعديلات الأجهزة التانية
// لحظيًا (realtime) ويطبقها. الأرقام المحلية (id) بتختلف من جهاز للتاني،
// فالروابط بين الجداول (equipment_id مثلًا) بتتبعت بالـ gid وبتترجم عند كل جهاز.
//
// الملف ده مشترك بين اللاب (better-sqlite3 جوه Electron) والتابلت (sql.js
// جوه التطبيق) — مفيش فيه أي حاجة خاصة بـ Node أو بالمتصفح.

const LOCAL_ONLY = new Set(["sync_state", "sync_outbox", "sync_deferred", "sync_rowtime", "activity_log"]);

// روابط مش متعرفة كـ FOREIGN KEY في القاعدة بس لازم تتترجم بالـ gid.
const EXTRA_FKS = {
  hassan_worker_entries: { treasury_expense_id: "hassan_treasury_expenses" },
};

const NOW_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

function ts(value) {
  const t = Date.parse(value ?? "");
  return Number.isNaN(t) ? 0 : t;
}

function createSyncEngine({
  db,
  createClient,
  supabaseUrl,
  supabaseKey,
  email,
  clientOptions = {},
  defaultDeviceName = "جهاز",
  onRemoteChanges = () => {},
  logger = console,
}) {
  let tables = [];
  const cols = {};
  const fks = {};
  const uniques = {};
  const hasIdPk = {};

  let sb = null;
  let online = false;
  let needsLogin = false;
  let lastError = null;
  let lastSyncAt = null;
  let pushing = false;
  let pulling = false;
  let pullAgain = false;
  let timers = [];
  let refetchTables = [];

  const getState = (key, fallback = null) => {
    const row = db.prepare("SELECT value FROM sync_state WHERE key = ?").get(key);
    return row ? row.value : fallback;
  };
  const setState = (key, value) =>
    db
      .prepare("INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(key, value == null ? null : String(value));
  const newGid = () => db.prepare("SELECT lower(hex(randomblob(16))) AS g").get().g;

  function introspect() {
    tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((r) => r.name)
      .filter((name) => !LOCAL_ONLY.has(name) && !name.includes("migrate_old"));
    for (const t of tables) {
      const info = db.prepare(`PRAGMA table_info(${t})`).all();
      cols[t] = info.map((c) => c.name);
      const pk = info.filter((c) => c.pk);
      hasIdPk[t] = pk.length === 1 && pk[0].name === "id";
      fks[t] = {};
      for (const fk of db.prepare(`PRAGMA foreign_key_list(${t})`).all()) fks[t][fk.from] = fk.table;
      Object.assign(fks[t], EXTRA_FKS[t] ?? {});
      uniques[t] = db
        .prepare(`PRAGMA index_list(${t})`)
        .all()
        .filter((i) => i.unique)
        .map((i) => db.prepare(`PRAGMA index_info(${i.name})`).all().map((c) => c.name))
        .filter((list) => list.length && !list.includes("gid") && !list.includes("sync_key"));
    }
  }

  // الجداول مرتبة بحيث "الأب" ييجي قبل "الابن" (المعدة قبل السركي بتاعها).
  function topoTables() {
    const done = new Set();
    const out = [];
    const visit = (t, depth = 0) => {
      if (done.has(t) || depth > 50) return;
      for (const parent of Object.values(fks[t] ?? {})) if (parent !== t) visit(parent, depth + 1);
      done.add(t);
      out.push(t);
    };
    tables.forEach((t) => visit(t));
    return out.filter((t) => tables.includes(t));
  }

  function setup() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_state (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS sync_outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tbl TEXT NOT NULL,
        rid INTEGER,
        gid TEXT,
        op TEXT NOT NULL,
        at TEXT NOT NULL,
        extra TEXT
      );
      CREATE TABLE IF NOT EXISTS sync_rowtime (tbl TEXT NOT NULL, rid INTEGER NOT NULL, at TEXT NOT NULL, PRIMARY KEY (tbl, rid));
      CREATE TABLE IF NOT EXISTS sync_deferred (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL, tries INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY,
        tbl TEXT,
        gid TEXT,
        op TEXT,
        data TEXT,
        device_id TEXT,
        device_name TEXT,
        at TEXT
      );
    `);
    if (!db.prepare("SELECT name FROM pragma_table_info('activity_log')").all().some((c) => c.name === "undone")) {
      db.exec("ALTER TABLE activity_log ADD COLUMN undone INTEGER NOT NULL DEFAULT 0");
    }
    if (!getState("device_id")) setState("device_id", newGid());
    if (getState("device_name") == null) setState("device_name", defaultDeviceName);
    setState("applying", "0");

    introspect();
    const firstRun = getState("gid_ready") !== "1";

    for (const t of tables) {
      if (!cols[t].includes("gid")) {
        db.exec(`ALTER TABLE ${t} ADD COLUMN gid TEXT`);
        cols[t].push("gid");
      }
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_${t}_gid ON ${t}(gid)`);
      db.exec(`UPDATE ${t} SET gid = lower(hex(randomblob(16))) WHERE gid IS NULL`);
      const guard = "WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'";
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS sync_ai_${t} AFTER INSERT ON ${t} ${guard} BEGIN
          UPDATE ${t} SET gid = lower(hex(randomblob(16))) WHERE rowid = NEW.rowid AND gid IS NULL;
          INSERT INTO sync_outbox (tbl, rid, op, at) VALUES ('${t}', NEW.rowid, 'insert', ${NOW_SQL});
        END;
      `);
      // تريجر المسح بيحفظ نسخة من الصف قبل ما يتمسح (عشان سجل التعديلات
      // يقول "مسح مصروف كذا" مش "مسح" وبس، وعشان "تراجع" يرجّعه)، وتريجر
      // التعديل بيحفظ شكل الصف قبل التعديل (عشان "تراجع" يرجّع القيم القديمة).
      // الاتنين بيتعملوا من جديد كل تشغيل عشان يشملوا أي عمود اتضاف بعد كده.
      const snapshotCols = cols[t].filter((c) => c !== "gid" && c !== "receipt_image");
      const snapshot = `json_object(${snapshotCols.map((c) => `'${c}', OLD.${c}`).join(", ")})`;
      db.exec(`
        DROP TRIGGER IF EXISTS sync_au_${t};
        CREATE TRIGGER sync_au_${t} AFTER UPDATE ON ${t} ${guard} BEGIN
          INSERT INTO sync_outbox (tbl, rid, op, at, extra) VALUES ('${t}', NEW.rowid, 'update', ${NOW_SQL}, ${snapshot});
        END;
        DROP TRIGGER IF EXISTS sync_ad_${t};
        CREATE TRIGGER sync_ad_${t} AFTER DELETE ON ${t} ${guard} BEGIN
          INSERT INTO sync_outbox (tbl, rid, gid, op, at, extra) VALUES ('${t}', OLD.rowid, OLD.gid, 'delete', ${NOW_SQL}, ${snapshot});
        END;
      `);
    }

    // أول تشغيل على جهاز عنده بيانات (اللاب): كل الصفوف الموجودة بتتبعت
    // للسحابة مرة واحدة كـ "initial" (مش بتظهر في سجل التعديلات).
    if (firstRun) {
      for (const t of topoTables()) {
        db.prepare(`INSERT INTO sync_outbox (tbl, rid, gid, op, at) SELECT '${t}', rowid, gid, 'initial', ${NOW_SQL} FROM ${t}`).run();
      }
      setState("gid_ready", "1");
    }

    // جدول جديد اتضاف في تحديث: جهاز تاني اتحدّث قبلنا ممكن يكون بعت صفوف
    // فيه والنسخة القديمة هنا عدّتها (مكانش عندها الجدول) — فبنسحب صفوف
    // الجداول الجديدة من السحابة من الأول مرة واحدة. لو الجهاز جاي من نسخة
    // مكانتش بتسجل الجداول، بنعتبر أي جدول فاضي "جديد".
    const known = getState("known_tables");
    if (firstRun) refetchTables = [];
    else if (known == null) refetchTables = tables.filter((t) => db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c === 0);
    else {
      const knownSet = new Set(JSON.parse(known));
      refetchTables = tables.filter((t) => !knownSet.has(t));
    }
    if (!refetchTables.length) setState("known_tables", JSON.stringify(tables));
  }

  async function refetchNewTables() {
    if (!refetchTables.length) return;
    let cursor = 0;
    for (let round = 0; round < 500; round++) {
      const { data, error } = await sb.from("sync_rows").select("*").in("tbl", refetchTables).gt("seq", cursor).order("seq").limit(500);
      if (error) throw error;
      if (!data.length) break;
      applyBatch(data);
      cursor = data[data.length - 1].seq;
      if (data.length < 500) break;
    }
    refetchTables = [];
    setState("known_tables", JSON.stringify(tables));
  }

  // ---------- push ----------
  function serialize(t, row) {
    const data = {};
    for (const c of cols[t]) {
      if (c === "gid" || (c === "id" && hasIdPk[t])) continue;
      const parent = fks[t][c];
      if (parent) {
        const v = row[c];
        // لو الأب اتمسح في نفس العملية (مسح معدة بمصروفاتها مثلًا) هويته
        // بتتاخد من سطر مسحه اللي لسه مستني يتبعت — عشان "تراجع" يربطهم تاني.
        data[`${c}@gid`] =
          v == null
            ? null
            : db.prepare(`SELECT gid FROM ${parent} WHERE id = ?`).get(v)?.gid ??
              db.prepare("SELECT gid FROM sync_outbox WHERE tbl = ? AND rid = ? AND op = 'delete' ORDER BY id DESC LIMIT 1").get(parent, v)?.gid ??
              null;
      } else {
        data[c] = row[c];
      }
    }
    return data;
  }

  function buildBatch(limit = 400) {
    const entries = db.prepare("SELECT * FROM sync_outbox ORDER BY id LIMIT ?").all(limit);
    if (!entries.length) return { entries, records: [] };
    const out = [];
    const upsertIndex = new Map();
    for (const e of entries) {
      if (e.op === "merge") {
        out.push({ kind: "merge", e });
        continue;
      }
      const key = `${e.tbl}|${e.rid}`;
      if (e.op === "delete") {
        const idx = upsertIndex.get(key);
        if (idx != null) out[idx] = null;
        upsertIndex.delete(key);
        out.push({ kind: "delete", e });
        continue;
      }
      const idx = upsertIndex.get(key);
      if (idx == null) {
        upsertIndex.set(key, out.length);
        out.push({ kind: "upsert", e, op: e.op, at: e.at, before: e.op === "update" ? e.extra : null });
      } else {
        const item = out[idx];
        item.at = e.at;
        if (item.op !== "insert" && e.op === "insert") item.op = "insert";
      }
    }

    const deviceId = getState("device_id");
    const deviceName = getState("device_name");
    const records = new Map();
    const pushedTimes = [];
    for (const item of out) {
      if (!item) continue;
      const { e } = item;
      if (!tables.includes(e.tbl)) continue;
      if (item.kind === "merge") {
        records.set(`${e.tbl}|${e.gid}`, {
          tbl: e.tbl,
          gid: e.gid,
          data: { __merged_into: e.extra },
          deleted: true,
          op: "merge",
          updated_at: e.at,
          device_id: deviceId,
          device_name: deviceName,
        });
      } else if (item.kind === "delete") {
        if (!e.gid) continue;
        let snapshot = {};
        try {
          snapshot = e.extra ? serialize(e.tbl, JSON.parse(e.extra)) : {};
        } catch {
          snapshot = {};
        }
        records.set(`${e.tbl}|${e.gid}`, {
          tbl: e.tbl,
          gid: e.gid,
          data: snapshot,
          deleted: true,
          op: "delete",
          updated_at: e.at,
          device_id: deviceId,
          device_name: deviceName,
        });
      } else {
        const row = db.prepare(`SELECT rowid AS __rid, * FROM ${e.tbl} WHERE rowid = ?`).get(e.rid);
        if (!row) continue;
        let gid = row.gid;
        if (!gid) {
          gid = newGid();
          setState("applying", "1");
          try {
            db.prepare(`UPDATE ${e.tbl} SET gid = ? WHERE rowid = ?`).run(gid, e.rid);
          } finally {
            setState("applying", "0");
          }
        }
        pushedTimes.push([e.tbl, e.rid, item.at]);
        const data = serialize(e.tbl, row);
        // شكل الصف قبل التعديل — بيتبعت جوه البيانات باسم __before (الأجهزة
        // بتتجاهل أي مفتاح مش عمود، فمبيأثرش على النسخ القديمة).
        if (item.op === "update" && item.before) {
          try {
            data.__before = serialize(e.tbl, JSON.parse(item.before));
          } catch {
            /* snapshot unreadable */
          }
        }
        records.set(`${e.tbl}|${gid}`, {
          tbl: e.tbl,
          gid,
          data,
          deleted: false,
          op: item.op,
          updated_at: item.at,
          device_id: deviceId,
          device_name: deviceName,
        });
      }
    }
    return { entries, records: [...records.values()], pushedTimes };
  }

  // آخر وقت اتعدّل فيه كل صف محليًا — عشان لو نفس الصف اتعدّل على جهازين،
  // التعديل الأحدث هو اللي يكسب حتى بعد ما يتبعت ويتشال من sync_outbox.
  function setRowTime(t, rid, at) {
    db.prepare(
      "INSERT INTO sync_rowtime (tbl, rid, at) VALUES (?, ?, ?) ON CONFLICT(tbl, rid) DO UPDATE SET at = excluded.at WHERE excluded.at > sync_rowtime.at"
    ).run(t, rid, at);
  }

  async function push() {
    if (!sb || needsLogin || pushing) return;
    pushing = true;
    try {
      for (let round = 0; round < 200; round++) {
        const { entries, records, pushedTimes } = buildBatch();
        if (!entries.length) break;
        for (let i = 0; i < records.length; i += 200) {
          const { error } = await sb.from("sync_rows").upsert(records.slice(i, i + 200), { onConflict: "tbl,gid" });
          if (error) throw error;
        }
        db.transaction(() => {
          db.prepare("DELETE FROM sync_outbox WHERE id <= ?").run(entries[entries.length - 1].id);
          for (const [t, rid, at] of pushedTimes) setRowTime(t, rid, at);
        })();
        online = true;
        lastError = null;
        lastSyncAt = new Date().toISOString();
      }
    } catch (err) {
      online = false;
      lastError = err?.message ?? String(err);
    } finally {
      pushing = false;
    }
  }

  // ---------- pull / apply ----------
  function localNewer(t, rid, remoteAt) {
    const pending = db
      .prepare("SELECT MAX(at) AS at FROM sync_outbox WHERE tbl = ? AND rid = ? AND op IN ('insert','update','initial')")
      .get(t, rid)?.at;
    const pushed = db.prepare("SELECT at FROM sync_rowtime WHERE tbl = ? AND rid = ?").get(t, rid)?.at;
    const localAt = Math.max(ts(pending), ts(pushed));
    return localAt > 0 && localAt > ts(remoteAt);
  }

  function mapValues(t, data) {
    const vals = {};
    for (const c of cols[t]) {
      if (c === "gid" || (c === "id" && hasIdPk[t])) continue;
      const parent = fks[t][c];
      if (parent) {
        const key = `${c}@gid`;
        if (!(key in data)) continue;
        const g = data[key];
        if (g == null) {
          vals[c] = null;
          continue;
        }
        const ref = db.prepare(`SELECT id FROM ${parent} WHERE gid = ?`).get(g);
        if (!ref) return null; // الأب لسه موصلش — نأجل الصف ده
        vals[c] = ref.id;
      } else if (c in data) {
        vals[c] = data[c] === undefined ? null : data[c];
      }
    }
    return vals;
  }

  function updateRow(t, rid, vals) {
    const keys = Object.keys(vals);
    if (!keys.length) return;
    db.prepare(`UPDATE ${t} SET ${keys.map((k) => `${k} = @${k}`).join(", ")} WHERE rowid = @__rid`).run({ ...vals, __rid: rid });
  }

  function addOutbox(t, rid, gid, op, extra = null) {
    db.prepare(`INSERT INTO sync_outbox (tbl, rid, gid, op, at, extra) VALUES (?, ?, ?, ?, ${NOW_SQL}, ?)`).run(t, rid, gid, op, extra);
  }

  // صف جديد جاي من جهاز تاني بيتعارض مع صف موجود عندنا بنفس المفتاح الطبيعي
  // (نفس المعدة ونفس اليوم في السركي مثلًا، أو نفس اسم الشريك) — بيتدمجوا في
  // صف واحد، والـ gid الأصغر هو اللي بيكسب عشان الجهازين يوصلوا لنفس النتيجة.
  function mergeConflict(t, remoteGid, vals, remoteAt) {
    let local = null;
    for (const list of uniques[t]) {
      if (!list.every((c) => c in vals)) continue;
      local = db
        .prepare(`SELECT rowid AS rid, gid FROM ${t} WHERE ${list.map((c) => `${c} IS ?`).join(" AND ")}`)
        .get(...list.map((c) => vals[c]));
      if (local) break;
    }
    if (!local) return false;
    const keepLocal = localNewer(t, local.rid, remoteAt);
    if (!keepLocal) {
      updateRow(t, local.rid, vals);
      setRowTime(t, local.rid, remoteAt);
    }
    if (remoteGid < local.gid) {
      db.prepare(`UPDATE ${t} SET gid = ? WHERE rowid = ?`).run(remoteGid, local.rid);
      addOutbox(t, null, local.gid, "merge", remoteGid);
      // البيانات المحلية أحدث — نبعتها تاني تحت الـ gid الموحّد.
      if (keepLocal) addOutbox(t, local.rid, remoteGid, "update");
    } else {
      addOutbox(t, null, remoteGid, "merge", local.gid);
      addOutbox(t, local.rid, local.gid, "update");
    }
    return true;
  }

  function rekey(t, loser, winner) {
    const l = db.prepare(`SELECT rowid AS rid, * FROM ${t} WHERE gid = ?`).get(loser);
    if (!l) return;
    const w = db.prepare(`SELECT rowid AS rid, * FROM ${t} WHERE gid = ?`).get(winner);
    if (!w) {
      db.prepare(`UPDATE ${t} SET gid = ? WHERE rowid = ?`).run(winner, l.rid);
      return;
    }
    if (hasIdPk[t]) {
      for (const child of tables) {
        for (const [c, parent] of Object.entries(fks[child])) {
          if (parent !== t) continue;
          try {
            db.prepare(`UPDATE ${child} SET ${c} = ? WHERE ${c} = ?`).run(w.id, l.id);
          } catch (err) {
            logger.warn?.(`sync: repoint ${child}.${c} failed`, err?.message);
          }
        }
      }
    }
    db.prepare(`DELETE FROM ${t} WHERE rowid = ?`).run(l.rid);
  }

  // بيرجع "applied" أو "defer" أو "skip"
  function applyRemote(r) {
    const t = r.tbl;
    if (!tables.includes(t)) return "skip";
    if (r.deleted) {
      if (r.data && r.data.__merged_into) rekey(t, r.gid, r.data.__merged_into);
      else db.prepare(`DELETE FROM ${t} WHERE gid = ?`).run(r.gid);
      return "applied";
    }
    const vals = mapValues(t, r.data ?? {});
    if (!vals) return "defer";
    const existing = db.prepare(`SELECT rowid AS rid FROM ${t} WHERE gid = ?`).get(r.gid);
    if (existing) {
      if (localNewer(t, existing.rid, r.updated_at)) return "skip";
      setRowTime(t, existing.rid, r.updated_at);
      try {
        updateRow(t, existing.rid, vals);
      } catch (err) {
        if (!String(err?.message).includes("UNIQUE")) throw err;
        logger.warn?.(`sync: update conflict on ${t}`, err.message);
      }
      return "applied";
    }
    const keys = Object.keys(vals);
    try {
      const info = db
        .prepare(`INSERT INTO ${t} (${[...keys, "gid"].join(", ")}) VALUES (${[...keys, "gid"].map((k) => `@${k}`).join(", ")})`)
        .run({ ...vals, gid: r.gid });
      setRowTime(t, Number(info.lastInsertRowid), r.updated_at);
    } catch (err) {
      if (!String(err?.message).includes("UNIQUE") || !mergeConflict(t, r.gid, vals, r.updated_at)) throw err;
    }
    return "applied";
  }

  function applyBatch(rows) {
    const myId = getState("device_id");
    const devices = new Set();
    let applied = 0;
    setState("applying", "1");
    try {
      const run = db.transaction(() => {
        for (const r of rows) {
          if (r.device_id === myId) continue;
          try {
            const result = applyRemote(r);
            if (result === "defer") db.prepare("INSERT INTO sync_deferred (payload) VALUES (?)").run(JSON.stringify(r));
            if (result === "applied") {
              applied++;
              if (r.device_name) devices.add(r.device_name);
            }
          } catch (err) {
            logger.error?.(`sync: apply failed for ${r.tbl}/${r.gid}`, err?.message ?? err);
          }
        }
        // صفوف اتأجلت عشان أبوها موصلش — نجربها تاني بعد كل دفعة.
        for (let pass = 0; pass < 3; pass++) {
          const deferred = db.prepare("SELECT * FROM sync_deferred ORDER BY id").all();
          if (!deferred.length) break;
          let progress = false;
          for (const d of deferred) {
            const r = JSON.parse(d.payload);
            let result = "defer";
            try {
              result = applyRemote(r);
            } catch (err) {
              logger.error?.(`sync: deferred apply failed for ${r.tbl}/${r.gid}`, err?.message ?? err);
              result = "skip";
            }
            if (result === "defer") {
              db.prepare("UPDATE sync_deferred SET tries = tries + 1 WHERE id = ?").run(d.id);
            } else {
              db.prepare("DELETE FROM sync_deferred WHERE id = ?").run(d.id);
              progress = true;
              if (result === "applied") {
                applied++;
                if (r.device_name) devices.add(r.device_name);
              }
            }
          }
          if (!progress) break;
        }
      });
      run();
    } finally {
      setState("applying", "0");
    }
    return { applied, devices: [...devices] };
  }

  async function pull() {
    if (!sb || needsLogin) return;
    if (pulling) {
      pullAgain = true;
      return;
    }
    pulling = true;
    let total = 0;
    const devices = new Set();
    try {
      do {
        pullAgain = false;
        for (let round = 0; round < 500; round++) {
          const last = Number(getState("last_seq", "0"));
          const { data, error } = await sb.from("sync_rows").select("*").gt("seq", last).order("seq").limit(500);
          if (error) throw error;
          if (!data.length) break;
          const { applied, devices: ds } = applyBatch(data);
          total += applied;
          ds.forEach((d) => devices.add(d));
          setState("last_seq", data[data.length - 1].seq);
          if (data.length < 500) break;
        }
        for (let round = 0; round < 200; round++) {
          const lastLog = Number(getState("last_log_id", "0"));
          const { data, error } = await sb
            .from("sync_log")
            .select("id,tbl,gid,op,data,device_id,device_name,at")
            .gt("id", lastLog)
            .order("id")
            .limit(1000);
          if (error) throw error;
          if (!data.length) break;
          const insert = db.prepare(
            "INSERT OR IGNORE INTO activity_log (id, tbl, gid, op, data, device_id, device_name, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
          );
          db.transaction(() => {
            for (const l of data) insert.run(l.id, l.tbl, l.gid, l.op, JSON.stringify(l.data ?? {}), l.device_id, l.device_name, l.at);
          })();
          setState("last_log_id", data[data.length - 1].id);
          if (data.length < 1000) break;
        }
      } while (pullAgain);
      online = true;
      lastError = null;
      lastSyncAt = new Date().toISOString();
      if (total > 0) onRemoteChanges({ count: total, devices: [...devices] });
    } catch (err) {
      online = false;
      lastError = err?.message ?? String(err);
    } finally {
      pulling = false;
    }
  }

  async function syncNow() {
    await push();
    await pull();
    await push();
    return status();
  }

  // الباسورد مش مكتوب في البرنامج: بيتكتب مرة واحدة على كل جهاز (login)،
  // والجهاز بيحفظ "جلسة الدخول" بس (مش الباسورد) في sync_state — وهي بتتجدد
  // لوحدها. لو الجلسة اتلغت (الباسورد اتغير مثلًا) البرنامج بيطلب الباسورد تاني.
  const authStorage = {
    getItem: (key) => getState(`auth:${key}`),
    setItem: (key, value) => setState(`auth:${key}`, value),
    removeItem: (key) => db.prepare("DELETE FROM sync_state WHERE key = ?").run(`auth:${key}`),
  };
  let realtimeOn = false;

  async function connect() {
    try {
      const { data, error } = await sb.auth.getSession();
      if (error) throw error;
      if (!data.session) {
        needsLogin = true;
        online = false;
        lastError = null;
        return;
      }
      needsLogin = false;
      await refetchNewTables();
      if (!realtimeOn) {
        realtimeOn = true;
        sb.channel("sync_rows_changes")
          .on("postgres_changes", { event: "*", schema: "public", table: "sync_rows" }, () => pull())
          .subscribe();
      }
      await syncNow();
    } catch (err) {
      online = false;
      lastError = err?.message ?? String(err);
      logger.error?.("sync: start failed", lastError);
    }
  }

  async function login(password) {
    if (!sb) throw new Error("المزامنة لسه مبدأتش");
    const { error } = await sb.auth.signInWithPassword({ email, password: String(password ?? "") });
    if (error) {
      const wrong = /invalid/i.test(error.message ?? "");
      throw new Error(wrong ? "باسورد المزامنة غلط" : `مقدرناش نوصل للسحابة: ${error.message}`);
    }
    needsLogin = false;
    await connect();
    return status();
  }

  // كل عميل ليه حساب مزامنة خاص بيه بييجي مع كود التفعيل (مساحته لوحده على
  // السحابة). لو الجهاز داخل بحساب تاني أو مش داخل خالص بيخرج ويدخل بالصح.
  let refreshedOnce = false;
  async function ensureLogin(creds) {
    if (!sb || !creds?.email) return status();
    const { data } = await sb.auth.getSession();
    if (data.session?.user?.email === creds.email && !needsLogin) {
      if (!refreshedOnce) {
        refreshedOnce = true;
        await sb.auth.refreshSession().catch(() => {});
      }
      return status();
    }
    if (data.session) await sb.auth.signOut({ scope: "local" }).catch(() => {});
    email = creds.email;
    refreshedOnce = true;
    return login(creds.password);
  }

  async function start() {
    setup();
    sb = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storage: authStorage, storageKey: "mk-operations-sync" },
      ...clientOptions,
    });
    // لو الجلسة اتلغت من السحابة وهو شغال، نطلب الباسورد.
    sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (!session && event !== "INITIAL_SESSION")) needsLogin = true;
    });
    await connect();
    // التعديلات المحلية بتتبعت كل ثانيتين، وسحب احتياطي كل 30 ثانية لو
    // الإشعار اللحظي فاتنا (نت فصل ورجع مثلًا).
    timers.push(
      setInterval(() => {
        if (!sb || needsLogin) return;
        const pending = db.prepare("SELECT COUNT(*) AS c FROM sync_outbox").get().c;
        if (pending > 0) push();
      }, 2000)
    );
    timers.push(
      setInterval(() => {
        if (needsLogin) return;
        if (!online) connect();
        else pull();
      }, 30000)
    );
  }

  function stop() {
    timers.forEach(clearInterval);
    timers = [];
  }

  function status() {
    return {
      deviceId: getState("device_id"),
      deviceName: getState("device_name"),
      pending: db.prepare("SELECT COUNT(*) AS c FROM sync_outbox").get().c,
      deferred: db.prepare("SELECT COUNT(*) AS c FROM sync_deferred").get().c,
      online,
      needsLogin,
      lastError,
      lastSyncAt,
    };
  }

  function setDeviceName(name) {
    const trimmed = (name ?? "").trim();
    if (trimmed) setState("device_name", trimmed);
    return status();
  }

  // سجل التعديلات: اللي اتزامن فعلًا (من السحابة، لكل الأجهزة) + اللي لسه
  // متبعتش من الجهاز ده. أسماء المعدات/الأشخاص بتتجاب من القاعدة المحلية.
  const NAME_TABLES = ["equipment", "employees", "partners", "contractors", "suppliers", "expense_categories", "hassan_workers", "creditors", "custodies"];
  function resolveRefs(t, data) {
    const refs = {};
    for (const [c, parent] of Object.entries(fks[t] ?? {})) {
      const g = data?.[`${c}@gid`];
      if (!g || !NAME_TABLES.includes(parent)) continue;
      const row = db.prepare(`SELECT ${parent === "custodies" ? "holder" : "name"} AS name FROM ${parent} WHERE gid = ?`).get(g);
      if (row) refs[c] = row.name;
    }
    return refs;
  }

  // ---------- تراجع عن تعديل من سجل التعديلات ----------
  // التراجع نفسه تعديل عادي على الجهاز ده (بيتسجل ويتبعت للجهاز التاني):
  // إضافة ← تتمسح، تعديل ← القيم القديمة ترجع، مسح ← الصف يرجع بنفس هويته
  // ومعاه أي حاجة اتمسحت معاه (أو اتمسح هو معاها) في نفس اللحظة.
  const markUndone = (id) => db.prepare("UPDATE activity_log SET undone = 1 WHERE id = ?").run(id);
  const rowByGid = (t, gid) => db.prepare(`SELECT rowid AS __rid, * FROM ${t} WHERE gid = ?`).get(gid);
  const parseData = (entry) => {
    try {
      return JSON.parse(entry.data || "{}");
    } catch {
      return {};
    }
  };
  const withinSeconds = (a, b, sec) => Math.abs(Date.parse(a) - Date.parse(b)) <= sec * 1000;

  function restoreDeleted(entry, visited) {
    if (visited.has(entry.id)) return;
    visited.add(entry.id);
    const t = entry.tbl;
    if (!tables.includes(t)) throw new Error("الجدول ده مش موجود في النسخة دي");
    if (rowByGid(t, entry.gid)) {
      markUndone(entry.id);
      return;
    }
    const data = parseData(entry);
    delete data.__before;
    if (!Object.keys(data).length) throw new Error("مفيش نسخة محفوظة من اللي اتمسح ده");
    // أي حاجة الصف ده مربوط بيها واتمسحت هي كمان (المعدة بتاعة المصروف مثلًا)
    // بترجع الأول.
    for (const [c, parent] of Object.entries(fks[t] ?? {})) {
      const g = data[`${c}@gid`];
      if (!g || db.prepare(`SELECT 1 FROM ${parent} WHERE gid = ?`).get(g)) continue;
      const parentDel = db
        .prepare("SELECT * FROM activity_log WHERE tbl = ? AND gid = ? AND op = 'delete' ORDER BY id DESC LIMIT 1")
        .get(parent, g);
      if (!parentDel) throw new Error("حاجة مربوطة بيه اتمسحت ومش لاقي نسختها");
      restoreDeleted(parentDel, visited);
    }
    const vals = mapValues(t, data);
    if (!vals) throw new Error("حاجة مربوطة بيه اتمسحت ومش لاقي نسختها");
    const keys = Object.keys(vals);
    try {
      db.prepare(`INSERT INTO ${t} (${[...keys, "gid"].join(", ")}) VALUES (${[...keys, "gid"].map((k) => `@${k}`).join(", ")})`).run({
        ...vals,
        gid: entry.gid,
      });
    } catch (err) {
      if (String(err?.message).includes("UNIQUE")) throw new Error("فيه حاجة تانية دلوقتي بنفس الاسم أو نفس اليوم — امسحها الأول");
      throw err;
    }
    markUndone(entry.id);
    // اللي اتمسح معاه في نفس اللحظة ومربوط بيه (مصروفات معدة اتمسحت مثلًا).
    const siblings = db
      .prepare("SELECT * FROM activity_log WHERE op = 'delete' AND device_id IS ? AND data LIKE ? AND id <> ?")
      .all(entry.device_id, `%${entry.gid}%`, entry.id)
      .filter((d) => withinSeconds(d.at, entry.at, 15));
    for (const child of siblings) {
      const cd = parseData(child);
      const linked = Object.entries(fks[child.tbl] ?? {}).some(([c, parent]) => parent === t && cd[`${c}@gid`] === entry.gid);
      if (linked) restoreDeleted(child, visited);
    }
  }

  function undo(id) {
    const entry = db.prepare("SELECT * FROM activity_log WHERE id = ?").get(id);
    if (!entry) throw new Error("التعديل ده مش موجود");
    if (entry.undone) throw new Error("التعديل ده اترجع قبل كده");
    const t = entry.tbl;
    if (!tables.includes(t)) throw new Error("الجدول ده مش موجود في النسخة دي");
    db.transaction(() => {
      if (entry.op === "insert") {
        const row = rowByGid(t, entry.gid);
        if (!row) throw new Error("الحاجة دي اتمسحت خلاص");
        db.prepare(`DELETE FROM ${t} WHERE rowid = ?`).run(row.__rid);
        markUndone(entry.id);
      } else if (entry.op === "update") {
        const row = rowByGid(t, entry.gid);
        if (!row) throw new Error("الحاجة دي اتمسحت بعد التعديل — رجّع المسح الأول");
        let before = parseData(entry).__before;
        if (!before) {
          const prev = db
            .prepare("SELECT data FROM activity_log WHERE tbl = ? AND gid = ? AND id < ? AND op IN ('insert', 'update') ORDER BY id DESC LIMIT 1")
            .get(t, entry.gid, entry.id);
          if (prev) before = parseData(prev);
        }
        if (!before) throw new Error("الشكل القديم للتعديل ده مش متسجل (اتعمل قبل التحديث ده)");
        delete before.__before;
        const vals = mapValues(t, before);
        if (!vals) throw new Error("حاجة مربوطة بيه اتمسحت — رجّعها الأول");
        try {
          updateRow(t, row.__rid, vals);
        } catch (err) {
          if (String(err?.message).includes("UNIQUE")) throw new Error("فيه حاجة تانية دلوقتي بنفس الاسم أو نفس اليوم");
          throw err;
        }
        markUndone(entry.id);
      } else if (entry.op === "delete") {
        restoreDeleted(entry, new Set());
      } else {
        throw new Error("التعديل ده مينفعش يترجع");
      }
    })();
    return { ok: true };
  }

  function activity({ from = null, to = null, device = null, limit = 300 } = {}) {
    const where = [];
    const params = [];
    if (from) {
      where.push("at >= ?");
      params.push(from);
    }
    if (to) {
      where.push("at < ?");
      params.push(to);
    }
    if (device) {
      where.push("device_name = ?");
      params.push(device);
    }
    const rows = db
      .prepare(
        `SELECT * FROM activity_log WHERE op NOT IN ('merge', 'initial') ${where.length ? `AND ${where.join(" AND ")}` : ""} ORDER BY at DESC, id DESC LIMIT ?`
      )
      .all(...params, limit)
      .map((r) => {
        const data = JSON.parse(r.data || "{}");
        return { ...r, data, refs: resolveRefs(r.tbl, data), pending: false, undone: !!r.undone };
      });
    // كل صف بيظهر مرة واحدة بس (إضافة صف بتسجل "إضافة" و"تعديل" ورا بعض
    // داخليًا) — العملية بتاعته هي أول عملية اتعملت عليه.
    const seen = new Map();
    for (const e of db.prepare("SELECT * FROM sync_outbox WHERE op NOT IN ('initial', 'merge') ORDER BY id").all()) {
      const key = e.op === "delete" ? `d|${e.id}` : `${e.tbl}|${e.rid}`;
      if (!seen.has(key)) seen.set(key, e);
      else if (e.op === "delete") seen.set(key, e);
    }
    const pendingRows = [...seen.values()]
      .reverse()
      .slice(0, 200)
      .map((e) => {
        const row = e.op === "delete" ? null : db.prepare(`SELECT * FROM ${e.tbl} WHERE rowid = ?`).get(e.rid);
        let data = {};
        try {
          data = row ? serialize(e.tbl, row) : e.extra ? serialize(e.tbl, JSON.parse(e.extra)) : {};
        } catch {
          data = {};
        }
        return {
          id: `p${e.id}`,
          tbl: e.tbl,
          gid: e.gid ?? row?.gid,
          op: e.op,
          data,
          refs: resolveRefs(e.tbl, data),
          device_id: getState("device_id"),
          device_name: getState("device_name"),
          at: e.at,
          pending: true,
        };
      });
    const devices = db
      .prepare("SELECT DISTINCT device_name FROM activity_log WHERE device_name IS NOT NULL ORDER BY device_name")
      .all()
      .map((r) => r.device_name);
    if (!devices.includes(getState("device_name"))) devices.push(getState("device_name"));
    return { rows, pending: pendingRows, devices };
  }

  return { setup, start, stop, login, ensureLogin, undo, push, pull, syncNow, status, setDeviceName, activity, _applyBatch: applyBatch, _buildBatch: buildBatch };
}

module.exports = { createSyncEngine };
