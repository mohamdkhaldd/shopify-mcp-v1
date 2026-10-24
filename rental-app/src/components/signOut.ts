import { shellApi } from "../api/client";

/**
 * "خروج": this device leaves the code and starts over on the activation page.
 * Asks first, and again if some changes haven't reached the cloud yet.
 */
export async function signOutOfDevice() {
  if (!window.confirm("تخرج من الجهاز ده؟\n\nهتحتاج كود التفعيل عشان تدخل تاني، ومكان الجهاز ده على الكود هيفضى.")) return;
  let r = await shellApi.signOut();
  if (!r.ok && "pending" in r) {
    const ok = window.confirm(
      `فيه ${r.pending} تعديل لسه ماتبعتش للسحابة — لو خرجت دلوقتي هيضيعوا.\nاتأكد إن النت شغال واستنى المزامنة.\n\nتخرج برضه؟`,
    );
    if (!ok) return;
    r = await shellApi.signOut(true);
  }
  if (!r.ok && "message" in r && r.message) window.alert(r.message);
}
