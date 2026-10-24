const { createClient } = require("@supabase/supabase-js");
const WebSocket = require("ws");
const { createSyncEngine } = require("./syncEngine");
const cloud = require("./cloudConfig");

// المزامنة بين أجهزة العميل لبرنامج التشغيل: نفس المحرك بتاع البرنامج القديم،
// والدخول بحساب مساحة العميل اللي جاي مع كود التفعيل (getCredentials).
let engine = null;

function startDeviceSync(db, { onRemoteChanges, getCredentials } = {}) {
  engine = createSyncEngine({
    db,
    createClient,
    ...cloud,
    clientOptions: { realtime: { transport: WebSocket } },
    defaultDeviceName: "اللاب",
    onRemoteChanges,
  });
  // التريجرات لازم تبقى جاهزة قبل أي تعديل من الشاشة.
  engine.setup();
  engine
    .start()
    .then(() => {
      const c = getCredentials?.();
      return c ? engine.ensureLogin(c) : undefined;
    })
    .catch((e) => console.error("sync start failed", e));
  return engine;
}

// كانت بتبعت كل صف لوحده للسحابة — دلوقتي التريجرات بتعمل ده لكل الجداول
// تلقائيًا، فبقت مالهاش لازمة (لسه موجودة عشان ipc.js بينادي عليها).
function pushToCloud() {}

module.exports = { startDeviceSync, pushToCloud, getSyncEngine: () => engine };
