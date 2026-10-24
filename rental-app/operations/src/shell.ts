// MK-Tech's shell (one app, two programs): locking, signing out and the
// company password. The rental screens have the same calls (src/api/client.ts).
export type ShellInfo = { product: string | null; products: string[]; locked?: boolean; hasPassword?: boolean };
type ShellResult = { ok: true } | { ok: false; message?: string };

export const shell = {
  info: (): Promise<ShellInfo | null> => window.api?.invoke("shell:info") ?? Promise.resolve(null),
  /** "قفل": the lock screen until the company password is typed */
  lock: () => window.api?.invoke("shell:lock"),
  setPassword: (current: string, next: string): Promise<ShellResult> => window.api!.invoke("shell:setPassword", { current, next }),
  signOut: (force = false): Promise<ShellResult | { ok: false; pending: number }> => window.api!.invoke("shell:signOut", { force }),
};

/**
 * "خروج": this device leaves the code and starts over on the activation page.
 * Asks first, and again if some changes haven't reached the cloud yet.
 */
export async function signOutOfDevice() {
  if (!window.confirm("تخرج من الجهاز ده؟\n\nهتحتاج كود التفعيل عشان تدخل تاني، ومكان الجهاز ده على الكود هيفضى.")) return;
  let r = await shell.signOut();
  if (!r.ok && "pending" in r) {
    const ok = window.confirm(
      `فيه ${r.pending} تعديل لسه ماتبعتش للسحابة — لو خرجت دلوقتي هيضيعوا.\nاتأكد إن النت شغال واستنى المزامنة.\n\nتخرج برضه؟`,
    );
    if (!ok) return;
    r = await shell.signOut(true);
  }
  if (!r.ok && "message" in r && r.message) window.alert(r.message);
}
