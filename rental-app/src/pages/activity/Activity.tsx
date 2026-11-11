import { useCallback, useEffect, useState } from "react";
import { ActivityView, api } from "../../api/client";
import {
  Button,
  ErrorBox,
  Loading,
  Note,
  PageHeader,
  Panel,
  Pill,
} from "../../components/ui";
import { Labeled, TextInput } from "../../components/Field";

const when = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} — ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** سجل التعديلات: every save, with "تراجع" for the ones that can go back. */
export default function Activity() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<ActivityView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // «كل الشركاء»: اللي اتعمل من كل الأجهزة باسم اللي عمله (بيتزامن)
  const [view, setView] = useState<"all" | "here">("all");
  const [team, setTeam] = useState<
    { id: number; at: string; who: string | null; label: string }[]
  >([]);
  const [who, setWho] = useState("");

  const load = useCallback(() => {
    api
      .activity({ from: from || undefined, to: to || undefined })
      .then(setRows, (e) => setError(e.message));
    api.teamLog(from || undefined, to || undefined).then(setTeam, () => {});
  }, [from, to]);
  useEffect(load, [load]);
  const people = [...new Set(team.map((t) => t.who ?? "من غير اسم"))];
  const shown = team.filter((t) => !who || (t.who ?? "من غير اسم") === who);

  if (!rows) return error ? <ErrorBox message={error} /> : <Loading />;
  return (
    <div className="grid gap-5">
      <PageHeader
        title="سجل التعديلات"
        subtitle="كل حاجة اتسجلت أو اتعدلت أو اتحذفت — ومعاها تراجع"
      />
      {error && <ErrorBox message={error} />}
      <Panel>
        <div className="flex gap-1 border-b border-line px-3 overflow-x-auto">
          {(
            [
              ["all", "كل الشركاء"],
              ["here", "الجهاز ده (وفيه التراجع)"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`px-3 py-2.5 font-bold border-b-[3px] whitespace-nowrap ${view === id ? "border-amber text-fg" : "border-transparent text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2.5 px-4 py-3 border-b border-line">
          <Labeled label="من يوم">
            <TextInput
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-36"
            />
          </Labeled>
          <Labeled label="لحد يوم">
            <TextInput
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-36"
            />
          </Labeled>
          {(from || to) && (
            <Button
              onClick={() => {
                setFrom("");
                setTo("");
              }}
            >
              مسح
            </Button>
          )}
          {view === "all" && people.length > 1 && (
            <Labeled label="الشريك">
              <select
                value={who}
                onChange={(e) => setWho(e.target.value)}
                className="rounded-lg border border-line bg-surface px-2 py-1.5"
              >
                <option value="">الكل</option>
                {people.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Labeled>
          )}
        </div>
        {view === "all" ? (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>الوقت</th>
                  <th>مين</th>
                  <th>اللي عمله</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-muted py-8">
                      لسه مفيش تعديلات.
                    </td>
                  </tr>
                )}
                {shown.map((t) => (
                  <tr key={t.id}>
                    <td className="num">{when(t.at)}</td>
                    <td className="font-bold">
                      {t.who ?? (
                        <span className="text-muted font-normal">
                          من غير اسم
                        </span>
                      )}
                    </td>
                    <td>{t.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>الوقت</th>
                  <th>مين</th>
                  <th>اللي حصل</th>
                  <th className="n">تغييرات</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-8">
                      لسه مفيش تعديلات.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className={r.undone ? "text-muted" : ""}>
                    <td className="num">{when(r.at)}</td>
                    <td className="font-bold">{r.who ?? ""}</td>
                    <td
                      className={
                        r.undone
                          ? "line-through"
                          : r.undo_of
                            ? "text-amber-deep font-semibold"
                            : ""
                      }
                    >
                      {r.label}
                    </td>
                    <td className="n">{r.changes}</td>
                    <td className="text-end">
                      {r.undone ? (
                        <Pill>اترجع</Pill>
                      ) : r.canUndo ? (
                        <Button
                          disabled={busy === r.id}
                          onClick={async () => {
                            setBusy(r.id);
                            setError(null);
                            try {
                              await api.undo(r.id);
                            } catch (e) {
                              setError((e as Error).message);
                              setBusy(null);
                            }
                          }}
                        >
                          تراجع
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Note>
          التراجع مبيمسحش حاجة: اللي اتضاف بيستخبى، واللي اتعدل بيرجع لقيمته
          القديمة. قفل الشهر والتسويات وتغيير النسب مبيترجعوش، وأي حاجة في شهر
          مقفول بتفضل مقفولة.
        </Note>
      </Panel>
    </div>
  );
}
