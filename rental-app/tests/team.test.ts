import { describe, expect, it } from "vitest";
import { freshDb, egp } from "./helpers";
import { callCore, makeRegistry } from "../electron/ipc";
import { assistantContext } from "../core/ai/assistant";

describe("الشركاء", () => {
  it("كل تعديل بيتسجل باسم الشريك اللي على الجهاز، والتراجع كمان", () => {
    const db = freshDb({ withholding: true });
    const reg = makeRegistry(db);
    expect(callCore(db, reg, "me", {})).toMatchObject({ ok: true, value: null });
    callCore(db, reg, "setMe", { name: "  أحمد   خالد " });
    expect(assistantContext(db).me).toBe("أحمد خالد");
    const r = callCore(db, reg, "createSupplier", { name: "محمد" }) as { actionId: string };
    callCore(db, reg, "setMe", { name: "محمود" });
    callCore(db, reg, "undo", { actionId: r.actionId });
    const log = (callCore(db, reg, "teamLog", {}) as { value: { who: string; label: string }[] }).value;
    expect(log.map((l) => [l.who, l.label])).toEqual([
      ["محمود", "تراجع: صاحب معدة جديد: محمد"],
      ["أحمد خالد", "صاحب معدة جديد: محمد"],
    ]);
    const act = (callCore(db, reg, "activity", {}) as { value: { who: string | null }[] }).value;
    expect(act.map((a) => a.who)).toEqual(["محمود", "أحمد خالد"]);
    expect((callCore(db, reg, "teamNames", {}) as { value: string[] }).value).toEqual(["أحمد خالد", "محمود"]);
  });

  it("المحادثة واحدة للكل وعليها اسم اللي كتب، والتحديث بيتحفظ", () => {
    const db = freshDb({ withholding: true });
    const reg = makeRegistry(db);
    callCore(db, reg, "setMe", { name: "أحمد" });
    const u = (callCore(db, reg, "chatAdd", { role: "user", text: "صرفت ٥٠٠ سولار من جيبي" }) as { value: number }).value;
    const a = (callCore(db, reg, "chatAdd", { role: "assistant", text: "هسجل مصروف", extra: { state: "pending", lines: ["مصروف 500 ج"] } }) as { value: number }).value;
    callCore(db, reg, "chatUpdate", { id: a, extra: { state: "saved", lines: ["مصروف 500 ج"] } });
    const list = (callCore(db, reg, "chatList", {}) as { value: { id: number; who: string; role: string; extra: unknown }[] }).value;
    expect(list.map((m) => [m.id, m.who, m.role])).toEqual([
      [u, "أحمد", "user"],
      [a, "أحمد", "assistant"],
    ]);
    expect(list[1].extra).toEqual({ state: "saved", lines: ["مصروف 500 ج"] });
    // الجداول دي مش بيانات شغل: مفيش حماية ولا سجل تعديلات عليها
    expect(db.prepare("SELECT COUNT(*) n FROM audit_log WHERE tbl LIKE 'team_%'").get()).toEqual({ n: 0 });
    void egp;
  });

  it("المحادثات: كل واحدة لوحدها، والقايمة بعنوان أول رسالة", () => {
    const db = freshDb({ withholding: true });
    const reg = makeRegistry(db);
    callCore(db, reg, "setMe", { name: "محمد خالد" });
    callCore(db, reg, "chatAdd", { role: "user", text: "اعمل عقد لودر", conv: "a" });
    callCore(db, reg, "chatAdd", { role: "assistant", text: "تمام", conv: "a" });
    callCore(db, reg, "chatAdd", { role: "user", text: "الخزنة فيها كام؟", conv: "b" });
    expect((callCore(db, reg, "chatList", { conv: "a" }) as { value: unknown[] }).value).toHaveLength(2);
    const list = (callCore(db, reg, "chatConversations", {}) as { value: { conv: string; title: string; count: number; who: string }[] }).value;
    expect(list.map((c) => [c.conv, c.title, c.count, c.who]).sort()).toEqual([
      ["a", "اعمل عقد لودر", 2, "محمد خالد"],
      ["b", "الخزنة فيها كام؟", 1, "محمد خالد"],
    ]);
  });

  it("الدروس: المساعد بيحفظ التصحيح ويبعته مع كل سؤال، وبيتمسح", () => {
    const db = freshDb({ withholding: true });
    const reg = makeRegistry(db);
    callCore(db, reg, "setMe", { name: "محمد خالد" });
    const actions = [{ type: "call", fn: "lessonAdd", args: { text: "«الكبير» يعني لودر 950 بتاع محمد علي" } }];
    const p = callCore(db, reg, "assistantPreview", { actions }) as { value: { lines: string[] } };
    expect(p.value.lines[0]).toBe("المساعد اتعلم: «الكبير» يعني لودر 950 بتاع محمد علي");
    expect(assistantContext(db).lessons).toEqual([]);
    callCore(db, reg, "assistantApply", { actions, summary: "درس" });
    callCore(db, reg, "assistantApply", { actions, summary: "درس" });
    expect(assistantContext(db).lessons).toEqual(["«الكبير» يعني لودر 950 بتاع محمد علي"]);
    const id = (callCore(db, reg, "lessons", {}) as { value: { id: number; who: string }[] }).value[0];
    expect(id.who).toBe("محمد خالد");
    callCore(db, reg, "lessonDelete", { id: id.id });
    expect(assistantContext(db).lessons).toEqual([]);
  });
});
