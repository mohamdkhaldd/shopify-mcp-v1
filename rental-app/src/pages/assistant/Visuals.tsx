import type { AssistantCard, AssistantChart } from "../../../core/license/manager";

// مربعات الأرقام والرسم اللي المساعد بيرجّعهم مع الرد (من غير مكتبات: SVG بسيط).

const TONE: Record<AssistantCard["tone"], string> = {
  in: "text-in bg-in-soft",
  out: "text-out bg-out-soft",
  tax: "text-tax bg-surface",
  plain: "text-fg bg-surface",
};
const COLORS = ["rgb(var(--amber))", "rgb(var(--in))", "rgb(var(--out))", "rgb(var(--tax))"];
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
/** الذكاء الاصطناعي أحياناً بيكتب رقم بلغة تانية (تايلاندي مثلاً) — كله يبقى عربي */
const digits = (s: string) => s.replace(/[๐-๙]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d.charCodeAt(0) - 0x0e50]).replace(/[०-९]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d.charCodeAt(0) - 0x0966]);

export function Cards({ cards }: { cards: AssistantCard[] }) {
  if (!cards.length) return null;
  return (
    <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(130px,1fr))]">
      {cards.map((c, i) => (
        <div key={i} className={`rounded-xl border border-line px-3 py-2.5 ${TONE[c.tone] ?? TONE.plain}`}>
          <div className="text-xs text-muted">{c.label}</div>
          <div className="font-extrabold text-[17px] num">{digits(c.value)}</div>
        </div>
      ))}
    </div>
  );
}

export function Chart({ chart }: { chart: AssistantChart }) {
  const { labels, series } = chart;
  const legend = series.length > 1 && (
    <div className="flex flex-wrap gap-3 text-xs">
      {series.map((s, i) => (
        <span key={i} className="flex items-center gap-1">
          <i className="inline-block w-3 h-3 rounded-sm" style={{ background: COLORS[i % 4] }} />
          {s.name}
        </span>
      ))}
    </div>
  );

  if (chart.kind === "pie") {
    const values = series[0]?.values ?? [];
    const total = values.reduce((a, v) => a + Math.max(v, 0), 0) || 1;
    let at = 0;
    const stops = values.map((v, i) => {
      const from = at;
      at += (Math.max(v, 0) / total) * 100;
      return `${COLORS[i % 4]} ${from}% ${at}%`;
    });
    return (
      <figure className="rounded-xl border border-line bg-surface p-3 grid gap-2 m-0">
        {chart.title && <figcaption className="font-bold text-sm">{chart.title}</figcaption>}
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-32 h-32 rounded-full shrink-0" style={{ background: `conic-gradient(${stops.join(", ")})` }} />
          <div className="grid gap-1 text-sm">
            {labels.map((l, i) => (
              <span key={i} className="flex items-center gap-2">
                <i className="inline-block w-3 h-3 rounded-sm" style={{ background: COLORS[i % 4] }} />
                {l}: <b className="num">{fmt(values[i] ?? 0)}</b> ({Math.round(((values[i] ?? 0) / total) * 100)}٪)
              </span>
            ))}
          </div>
        </div>
      </figure>
    );
  }

  const all = series.flatMap((s) => s.values);
  const max = Math.max(0, ...all);
  const min = Math.min(0, ...all);
  const span = max - min || 1;
  const W = Math.max(280, labels.length * 56);
  const H = 170;
  const top = 14;
  const bottom = 32;
  const y = (v: number) => top + ((max - v) / span) * (H - top - bottom);
  const step = W / labels.length;

  return (
    <figure className="rounded-xl border border-line bg-surface p-3 grid gap-2 m-0">
      {chart.title && <figcaption className="font-bold text-sm">{chart.title}</figcaption>}
      {legend}
      <div className="overflow-x-auto" dir="ltr">
        <svg width={W} height={H} role="img" aria-label={chart.title} className="block">
          <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="rgb(var(--line, 220 220 220))" />
          {chart.kind === "line"
            ? series.map((s, si) => (
                <g key={si}>
                  <polyline fill="none" stroke={COLORS[si % 4]} strokeWidth={2.5} points={s.values.map((v, i) => `${step * i + step / 2},${y(v)}`).join(" ")} />
                  {s.values.map((v, i) => (
                    <circle key={i} cx={step * i + step / 2} cy={y(v)} r={3.5} fill={COLORS[si % 4]}>
                      <title>{`${labels[i]}: ${fmt(v)}`}</title>
                    </circle>
                  ))}
                </g>
              ))
            : labels.map((_, i) => {
                const bw = Math.min(34, (step - 10) / series.length);
                const x0 = step * i + (step - bw * series.length) / 2;
                return series.map((s, si) => {
                  const v = s.values[i] ?? 0;
                  return (
                    <rect key={`${i}-${si}`} x={x0 + si * bw} width={bw - 2} y={Math.min(y(v), y(0))} height={Math.max(1, Math.abs(y(v) - y(0)))} rx={3} fill={COLORS[si % 4]}>
                      <title>{`${labels[i]} — ${s.name}: ${fmt(v)}`}</title>
                    </rect>
                  );
                });
              })}
          {labels.map((l, i) => (
            <text key={i} x={step * i + step / 2} y={H - 10} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.7}>
              {l.length > 9 ? `${l.slice(0, 9)}…` : l}
            </text>
          ))}
          {series.length === 1 &&
            chart.kind === "bar" &&
            series[0].values.map((v, i) => (
              <text key={i} x={step * i + step / 2} y={Math.min(y(v), y(0)) - 3} textAnchor="middle" fontSize={10} fill="currentColor">
                {fmt(v)}
              </text>
            ))}
        </svg>
      </div>
    </figure>
  );
}
