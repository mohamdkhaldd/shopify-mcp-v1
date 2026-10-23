import { useEffect, useState } from "react";
import { REFRESH_EVENT, syncApi, SyncStatus } from "../api/client";
import { Button } from "./ui";

/** Polls the sync status; every sync widget shares the same shape. */
export function useSyncStatus(everyMs = 5000) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = () => syncApi.status().then((s) => alive && setStatus(s));
    tick();
    const t = setInterval(tick, everyMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [everyMs]);
  return [status, setStatus] as const;
}

const time = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function syncLine(s: SyncStatus | null): { text: string; tone: "ok" | "warn" | "off" } {
  if (!s || s.disabled) return { text: "المزامنة مقفولة", tone: "off" };
  if (s.needsLogin) return { text: "المزامنة مستنية الباسورد", tone: "warn" };
  if (!s.online) return { text: s.lastError ? "مفيش نت — التعديلات محفوظة وهتتبعت لما النت يرجع" : "بيوصل للسحابة...", tone: "warn" };
  if (s.pending > 0) return { text: `بيبعت ${s.pending} تعديل...`, tone: "ok" };
  return { text: s.lastSyncAt ? `متزامن — آخر مزامنة ${time(s.lastSyncAt)}` : "متزامن", tone: "ok" };
}

/** Top-of-page bars: the one-time password on a new device, and "the tablet changed things". */
export function SyncBars() {
  const [status, setStatus] = useSyncStatus();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remote, setRemote] = useState<{ count: number; devices: string[] } | null>(null);

  useEffect(
    () =>
      syncApi.onRemoteChanges((info) =>
        setRemote((r) => ({ count: (r?.count ?? 0) + info.count, devices: [...new Set([...(r?.devices ?? []), ...info.devices])] })),
      ),
    [],
  );

  const login = async () => {
    setBusy(true);
    setError(null);
    const r = await syncApi.login(password);
    setBusy(false);
    if (r.ok && r.status) {
      setStatus(r.status);
      setPassword("");
    } else setError(r.message ?? "حصلت مشكلة");
  };

  return (
    <div className="no-print grid gap-2 mb-4 empty:hidden">
      {status?.needsLogin && (
        <div className="rounded-card border border-amber bg-amber-soft px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="font-semibold text-sm">
            اكتب باسورد المزامنة مرة واحدة على الجهاز ده — بعدها اللاب والتابلت هيبقوا شايفين نفس البيانات.
          </div>
          <input
            type="password"
            aria-label="باسورد المزامنة"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && password && login()}
            className="font-[inherit] text-[13px] border border-line bg-surface text-fg rounded-md px-2 py-1 w-[200px]"
          />
          <Button primary disabled={!password || busy} onClick={login}>
            {busy ? "بيدخل..." : "دخول"}
          </Button>
          {error && <span className="text-out font-semibold text-sm">{error}</span>}
        </div>
      )}
      {remote && (
        <div className="rounded-card border border-in bg-in-soft px-4 py-2.5 flex flex-wrap items-center gap-3">
          <div className="font-semibold text-sm">
            {remote.devices.length ? remote.devices.join(" و") : "جهاز تاني"} عدّل {remote.count} حاجة — حدّث الصفحة عشان تشوفها
          </div>
          <Button
            primary
            onClick={() => {
              setRemote(null);
              window.dispatchEvent(new CustomEvent(REFRESH_EVENT));
            }}
          >
            حدّث
          </Button>
        </div>
      )}
    </div>
  );
}
