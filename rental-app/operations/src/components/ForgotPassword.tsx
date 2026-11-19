import { useState } from "react";
import { shell } from "../shell";

// «نسيت الباسورد؟» ← طلب لـ MK-Tech بيوصلهم تنبيه على الموبايل فيه اسم الشركة
// وتليفونها، وهما بيغيّروا باسورد الشركة ويكلموك.
export default function ForgotPassword({ what = "company" }: { what?: "company" | "hassan" }) {
  const [state, setState] = useState<"idle" | "sending" | { ok: boolean; message: string }>("idle");
  if (typeof state === "object") return <div className={`text-xs font-semibold ${state.ok ? "text-primary-dark" : "text-rose-600"}`}>{state.message}</div>;
  return (
    <button
      type="button"
      disabled={state === "sending"}
      onClick={async () => {
        setState("sending");
        setState(await shell.passwordHelp(what).catch(() => ({ ok: false, message: "مفيش نت — جرّب تاني" })));
      }}
      className="text-xs font-semibold text-slate-500 hover:text-primary-dark underline disabled:opacity-50"
    >
      {state === "sending" ? "بنبعت…" : "نسيت الباسورد؟ ابعت لـ MK-Tech يغيّروه"}
    </button>
  );
}
