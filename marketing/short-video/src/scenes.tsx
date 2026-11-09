import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, random } from "remotion";
import { Bg, C, CountUp, Header, Logo, Phone, Pill, clamp, usePop, fmt } from "./ui";
import { Burst, Flash, Shine } from "./fx";

// ───────────────────────── 1. hook: a wrong day in the sarki = money flying out
export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const sheet = usePop(0, 13);
  const strike = interpolate(f, [16, 26], [0, 1], clamp);
  const wrong = usePop(28, 9);
  const shake = f > 28 && f < 44 ? Math.sin(f * 2.2) * 10 : 0;
  return (
    <Bg tint={C.red}>
      <div style={{ position: "absolute", top: 150, width: "100%", textAlign: "center" }}>
        <Pill delay={2}>لشركات تأجير المعدات</Pill>
      </div>
      {/* paper sarki */}
      <div
        style={{
          position: "absolute",
          top: 430,
          left: 150,
          width: 780,
          height: 900,
          background: C.paper,
          borderRadius: 26,
          transform: `rotate(${-3 + shake / 5}deg) scale(${sheet}) translateX(${shake}px)`,
          boxShadow: "0 50px 100px rgba(0,0,0,.5)",
          color: C.ink,
          padding: "50px 60px",
          backgroundImage: "repeating-linear-gradient(180deg, transparent 0 88px, #CBD5E1 88px 90px)",
        }}
      >
        <div style={{ fontSize: 58, fontWeight: 900, marginBottom: 20 }}>سركي — مان لفت ٣٦</div>
        {["السبت", "الأحد", "الاتنين", "التلات", "الأربع", "الخميس"].map((d, i) => (
          <div key={d} style={{ display: "flex", justifyContent: "space-between", fontSize: 48, fontWeight: 700, height: 90, alignItems: "center", position: "relative" }}>
            <span>{d}</span>
            <span style={{ color: "#334155" }}>{i === 3 ? "" : "✓"}</span>
            {i === 3 && (
              <>
                <span style={{ position: "absolute", left: 0, color: "#334155" }}>✓</span>
                <div style={{ position: "absolute", left: -10, top: 44, height: 8, width: `${strike * 110}px`, background: C.red, borderRadius: 4 }} />
                <span style={{ position: "absolute", left: 100, color: C.red, fontSize: 56, fontWeight: 900, transform: `scale(${wrong}) rotate(-8deg)` }}>✓✓</span>
              </>
            )}
          </div>
        ))}
      </div>
      <Bills start={44} />
      <Burst at={44} x={540} y={800} glyphs={["💸","💵","💸"]} count={10} spread={600} size={40} seed="h" />
      <Flash at={28} strength={0.25} />
    </Bg>
  );
};

const Bills: React.FC<{ start: number }> = ({ start }) => {
  const f = useCurrentFrame();
  return (
    <>
      {new Array(9).fill(0).map((_, i) => {
        const t = f - start - i * 3;
        if (t < 0) return null;
        const vx = (random(`x${i}`) - 0.5) * 30;
        const vy = -18 - random(`y${i}`) * 14;
        const x = 540 + vx * t;
        const y = 820 + vy * t + 0.55 * t * t;
        const r = random(`r${i}`) * 360 + t * (random(`s${i}`) * 12 - 6);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - 95,
              top: y - 45,
              width: 190,
              height: 90,
              borderRadius: 12,
              background: "linear-gradient(135deg,#16A34A,#15803D)",
              border: "4px solid #BBF7D0",
              transform: `rotate(${r}deg)`,
              color: "#DCFCE7",
              fontSize: 44,
              fontWeight: 900,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ج
          </div>
        );
      })}
    </>
  );
};

// ───────────────────────── 2. question: ليك كام؟ عليك كام؟
export const Question: React.FC = () => {
  const f = useCurrentFrame();
  const a = usePop(42, 10);
  const b = usePop(76, 10);
  const c = usePop(119, 9);
  return (
    <Bg tint={C.purple}>
      <Marks />
      {/* opening beat while "طب لو سألتك دلوقتي" is said */}
      <div
        style={{
          position: "absolute",
          top: 560,
          width: "100%",
          textAlign: "center",
          fontSize: 520,
          fontWeight: 900,
          color: C.amber,
          lineHeight: 1,
          textShadow: "0 20px 90px #F59E0B88",
          opacity: interpolate(f, [0, 6, 34, 44], [0, 1, 1, 0], clamp),
          transform: `scale(${interpolate(f, [0, 8, 34, 44], [0.3, 1, 1.08 + Math.sin(f / 3) * 0.04, 2.2], clamp)}) rotate(${Math.sin(f / 5) * 6}deg)`,
        }}
      >
        ؟
      </div>
      <div style={{ position: "absolute", top: 330, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 150, fontWeight: 900, color: C.green, transform: `scale(${a})`, textShadow: "0 10px 60px #22C55E66" }}>ليك كام؟</div>
        <div style={{ fontSize: 46, fontWeight: 700, opacity: a, marginTop: -10, color: "#CBD5E1" }}>عند الشركات</div>
        <div style={{ height: 70 }} />
        <div style={{ fontSize: 150, fontWeight: 900, color: C.red, transform: `scale(${b})`, textShadow: "0 10px 60px #EF444466" }}>عليك كام؟</div>
        <div style={{ fontSize: 46, fontWeight: 700, opacity: b, marginTop: -10, color: "#CBD5E1" }}>لأصحاب المعدات</div>
        <div style={{ height: 90 }} />
        <div style={{ transform: `scale(${c}) rotate(${Math.sin(f / 6) * 2}deg)` }}>
          <Pill bg={C.white} size={64}>تعرف ترد؟</Pill>
        </div>
      </div>
      <Burst at={42} x={540} y={430} colors={["#22C55E","#BBF7D0","#FFFFFF"]} seed="q1" />
      <Burst at={76} x={540} y={720} colors={["#EF4444","#FECACA","#FFFFFF"]} seed="q2" />
      <Burst at={119} x={540} y={990} count={24} seed="q3" />
    </Bg>
  );
};

const Marks: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <>
      {new Array(16).fill(0).map((_, i) => {
        const x = random(`mx${i}`) * 1000 + 40;
        const speed = 6 + random(`ms${i}`) * 8;
        const y = ((f * speed + random(`my${i}`) * 2200) % 2200) - 200;
        const s = 60 + random(`mz${i}`) * 90;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, fontSize: s, fontWeight: 900, color: C.white, opacity: 0.08 + random(`mo${i}`) * 0.12, transform: `rotate(${random(`mr${i}`) * 40 - 20}deg)` }}>
            ؟
          </div>
        );
      })}
    </>
  );
};

// ───────────────────────── 3. pain: notebook, calculator, papers → loss counter
export const Pain: React.FC = () => {
  const f = useCurrentFrame();
  const items = [
    { icon: "📒", label: "السركي في كشكول", d: 4 },
    { icon: "🧮", label: "الحساب على الآلة الحاسبة", d: 30 },
    { icon: "📄", label: "الدفعات في ورق", d: 62 },
  ];
  const loss = usePop(96, 12);
  return (
    <Bg tint={C.red}>
      <Header color="#FECACA" delay={2}>الغلطة بتتدفع من جيبك</Header>
      <div style={{ position: "absolute", top: 430, left: 70, right: 70, display: "flex", flexDirection: "column", gap: 34 }}>
        {items.map((it) => {
          const p = usePop(it.d, 12);
          const jitter = f > it.d + 10 ? Math.sin((f + it.d) / 3) * 3 : 0;
          return (
            <div
              key={it.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 26,
                background: "rgba(255,255,255,.07)",
                border: "3px solid rgba(255,255,255,.12)",
                borderRadius: 34,
                padding: "28px 36px",
                transform: `translateX(${(1 - p) * -900}px) rotate(${jitter / 3}deg)`,
                opacity: p,
              }}
            >
              <span style={{ fontSize: 84 }}>{it.icon}</span>
              <span style={{ fontSize: 50, fontWeight: 900, whiteSpace: "nowrap" }}>{it.label}</span>
              <span style={{ marginRight: "auto", fontSize: 70, color: C.red, fontWeight: 900 }}>✗</span>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", top: 1230, width: "100%", textAlign: "center", transform: `scale(${loss})` }}>
        <div style={{ fontSize: 48, fontWeight: 700, marginBottom: -20, color: "#FCA5A5" }}>خسارة من غير ما تحس</div>
        <div style={{ fontSize: 150, fontWeight: 900, color: C.red, textShadow: "0 10px 70px #EF444488" }}>
          <CountUp from={0} to={-18500} start={100} dur={36} suffix=" ج" />
        </div>
      </div>
      <Burst at={100} x={540} y={1380} glyphs={["💸","🔻","💸"]} count={9} spread={480} size={36} seed="p" />
      <Flash at={96} strength={0.3} />
    </Bg>
  );
};

// ───────────────────────── 4. month end: the calendar runs to the 30th
export const MonthEnd: React.FC = () => {
  const f = useCurrentFrame();
  const day = Math.round(interpolate(f, [10, 56], [1, 30], { ...clamp, easing: Easing.in(Easing.quad) }));
  const flip = (f % 3) / 3;
  const end = usePop(60, 9);
  return (
    <Bg tint={C.amber}>
      <Header delay={2}>مستني آخر الشهر؟</Header>
      <div style={{ position: "absolute", top: 540, left: 290, width: 500, height: 560, borderRadius: 40, background: C.white, color: C.ink, boxShadow: "0 50px 100px rgba(0,0,0,.5)", overflow: "hidden", transform: `scale(${1 + end * 0.08})` }}>
        <div style={{ background: C.red, color: C.white, fontSize: 56, fontWeight: 900, textAlign: "center", padding: "22px 0" }}>الشهر</div>
        <div style={{ fontSize: 290, fontWeight: 900, textAlign: "center", lineHeight: "400px", transform: day < 30 ? `translateY(${flip * -14}px)` : undefined, color: day === 30 ? C.red : C.ink }}>
          <span style={{ direction: "ltr", unicodeBidi: "isolate" }}>{day}</span>
        </div>
      </div>
      <div style={{ position: "absolute", top: 1190, width: "100%", textAlign: "center", opacity: end, transform: `translateY(${(1 - end) * 40}px)` }}>
        <div style={{ fontSize: 64, fontWeight: 900 }}>تجمّع… وتطرح… وتعيد 😩</div>
        <div style={{ fontSize: 52, fontWeight: 700, color: "#FCD34D", marginTop: 16 }}>عشان تعرف كسبت ولا لأ</div>
      </div>
      <Burst at={60} x={540} y={820} colors={["#EF4444","#FCD34D","#FFFFFF"]} count={22} seed="m" />
    </Bg>
  );
};

// ───────────────────────── 5. reveal: MK-Tech
export const Reveal: React.FC = () => {
  const f = useCurrentFrame();
  const flash = interpolate(f, [0, 4, 14], [0, 1, 0], clamp);
  const logo = usePop(6, 8);
  const name = usePop(30, 12);
  const tag = usePop(50, 12);
  const ring = interpolate(f, [6, 40], [0, 1], clamp);
  return (
    <Bg tint={C.blue}>
      <div style={{ position: "absolute", top: 760, left: 540, width: 10, height: 10 }}>
        <div style={{ position: "absolute", left: -500 * ring, top: -500 * ring, width: 1000 * ring, height: 1000 * ring, borderRadius: "50%", border: `6px solid ${C.blue}`, opacity: 1 - ring }} />
      </div>
      <div style={{ position: "absolute", top: 520, width: "100%", display: "flex", justifyContent: "center" }}>
        <Logo size={420} style={{ transform: `scale(${logo}) rotate(${(1 - logo) * -25}deg)` }} />
      </div>
      <div style={{ position: "absolute", top: 1010, width: "100%", textAlign: "center", fontSize: 150, fontWeight: 900, letterSpacing: 2, transform: `scale(${name})`, opacity: name, direction: "ltr" }}>
        MK-Tech
      </div>
      <div style={{ position: "absolute", top: 1230, width: "100%", textAlign: "center", opacity: tag, transform: `translateY(${(1 - tag) * 40}px)` }}>
        <Pill bg={C.blue} color={C.white} size={52}>سيستم بيحسبلك كل ده لوحده</Pill>
        <div style={{ marginTop: 34, fontSize: 44, fontWeight: 700, color: "#BFDBFE" }}>لابتوب · تابلت · موبايل</div>
      </div>
      <AbsoluteFill style={{ background: C.white, opacity: flash }} />
      <Burst at={8} x={540} y={730} count={36} spread={760} size={26} colors={["#0B5FFF","#38BDF8","#FFFFFF"]} seed="r1" />
      <Burst at={50} x={540} y={1290} count={16} seed="r2" />
    </Bg>
  );
};

// ───────────────────────── 6. sarki → invoice builds itself
export const Sarki: React.FC = () => {
  const f = useCurrentFrame();
  const phoneIn = usePop(0, 14);
  const scroll = interpolate(f, [12, 48], [0, 470], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const card = usePop(52, 13);
  const rows = [
    { k: "٧ أيام × 4,500", v: 31500, d: 62 },
    { k: "+ قيمة مضافة ١٤٪", v: 4410, d: 76 },
  ];
  const total = usePop(90, 10);
  return (
    <Bg tint={C.blue}>
      <Header delay={2}>صفر أخطاء في الحساب</Header>
      <div style={{ position: "absolute", top: 420, left: 160, transform: `translateY(${(1 - phoneIn) * 800}px) scale(${1 - card * 0.2})`, transformOrigin: "50% 0%" }}>
        <Phone src="shots/21-sarki-c1-full.png" scroll={scroll} />
      </div>
      <div
        style={{
          position: "absolute",
          top: 880,
          left: 90,
          right: 90,
          background: C.white,
          color: C.ink,
          borderRadius: 40,
          padding: "40px 50px",
          boxShadow: "0 50px 120px rgba(0,0,0,.55)",
          transform: `translateY(${(1 - card) * 900}px)`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontSize: 54, fontWeight: 900 }}>فاتورة شركة البناء</span>
          <span style={{ fontSize: 34, fontWeight: 700, color: "#64748B" }}>مان لفت ٣٦</span>
        </div>
        {rows.map((r) => {
          const p = usePop(r.d, 13);
          return (
            <div key={r.k} style={{ display: "flex", justifyContent: "space-between", fontSize: 46, fontWeight: 700, padding: "14px 0", borderBottom: "3px dashed #E2E8F0", opacity: p, transform: `translateX(${(1 - p) * -80}px)` }}>
              <span>{r.k}</span>
              <span style={{ direction: "ltr" }}>{fmt(r.v)}</span>
            </div>
          );
        })}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22, opacity: total, transform: `scale(${0.85 + total * 0.15})` }}>
          <span style={{ fontSize: 54, fontWeight: 900 }}>الإجمالي</span>
          <span style={{ fontSize: 84, fontWeight: 900, color: C.blue }}>
            <CountUp to={35910} start={90} dur={22} suffix=" ج" />
          </span>
        </div>
        <div style={{ textAlign: "center", marginTop: 14, opacity: total }}>
          <Pill bg="#DCFCE7" color="#166534" size={38} delay={106}>
            ✓ اتحسبت لوحدها بالقرش
          </Pill>
        </div>
        <Shine at={104} />
      </div>
      <Burst at={100} x={540} y={1210} colors={["#22C55E","#BBF7D0","#FACC15"]} count={26} seed="s" />
    </Bg>
  );
};

// ───────────────────────── 7. home: the three numbers, any day
export const Home: React.FC = () => {
  const f = useCurrentFrame();
  const phone = usePop(0, 14);
  const dim = interpolate(f, [68, 84], [0, 1], clamp);
  const cards = [
    { label: "كسبت كام", sub: "ربح الشهر", v: 23275, color: C.green, d: 83 },
    { label: "ليك كام", sub: "عند الشركات", v: 519044, color: C.sky, d: 105 },
    { label: "عليك كام", sub: "لأصحاب المعدات", v: 393600, color: C.amber, d: 140 },
  ];
  return (
    <Bg tint={C.green}>
      <Header delay={2}>
        كل يوم… <span style={{ color: C.green }}>مش آخر الشهر</span>
      </Header>
      <div style={{ position: "absolute", top: 430, left: 160, transform: `translateY(${(1 - phone) * 800}px)`, opacity: 1 - dim * 0.65, filter: `blur(${dim * 6}px)` }}>
        <Phone src="shots/10-home-full.png" scroll={interpolate(f, [8, 70], [0, 160], clamp)} />
      </div>
      <div style={{ position: "absolute", top: 400, left: 80, right: 80, display: "flex", flexDirection: "column", gap: 30 }}>
        {cards.map((c) => {
          const p = usePop(c.d, 12);
          return (
            <div
              key={c.label}
              style={{
                background: C.white,
                color: C.ink,
                borderRadius: 40,
                padding: "24px 46px",
                borderRight: `22px solid ${c.color}`,
                position: "relative",
                overflow: "hidden",
                boxShadow: "0 40px 90px rgba(0,0,0,.5)",
                transform: `translateX(${(1 - p) * 1100}px)`,
                opacity: p,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 64, fontWeight: 900 }}>{c.label}</span>
                <span style={{ fontSize: 38, fontWeight: 700, color: "#64748B" }}>{c.sub}</span>
              </div>
              <div style={{ fontSize: 92, lineHeight: 1.2, fontWeight: 900, color: c.color === C.amber ? "#B45309" : c.color === C.sky ? "#0369A1" : "#15803D", marginTop: 4 }}>
                <CountUp to={c.v} start={c.d + 4} dur={28} suffix=" ج" />
              </div>
              <Shine at={c.d + 12} />
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", top: 1330, width: "100%", textAlign: "center" }}>
        <Pill bg={C.green} color={C.white} size={44} delay={164}>
          من غير ما تقفل الشهر
        </Pill>
      </div>
      <Burst at={89} x={540} y={520} colors={["#22C55E","#BBF7D0","#FFFFFF"]} seed="h1" />
      <Burst at={111} x={540} y={800} colors={["#38BDF8","#BAE6FD","#FFFFFF"]} seed="h2" />
      <Burst at={146} x={540} y={1080} colors={["#F59E0B","#FDE68A","#FFFFFF"]} seed="h3" />
    </Bg>
  );
};

// ───────────────────────── 8. tax: calculated and held aside
export const Tax: React.FC = () => {
  const f = useCurrentFrame();
  const card = usePop(6, 12);
  const lock = usePop(50, 8);
  const chip1 = usePop(16, 12);
  const chip2 = usePop(30, 12);
  return (
    <Bg tint={C.purple}>
      <Header delay={2}>الضريبة محسوبة لوحدها</Header>
      <div style={{ position: "absolute", top: 450, width: "100%", display: "flex", justifyContent: "center", gap: 30 }}>
        <div style={{ transform: `scale(${chip1})` }}>
          <Pill bg="#EDE9FE" color={C.purple} size={48}>١٤٪ قيمة مضافة</Pill>
        </div>
        <div style={{ transform: `scale(${chip2})` }}>
          <Pill bg="#EDE9FE" color={C.purple} size={48}>+ ضريبة الهامش</Pill>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 650,
          left: 110,
          right: 110,
          background: C.white,
          color: C.ink,
          borderRadius: 48,
          padding: "60px 60px 70px",
          boxShadow: `0 50px 120px rgba(0,0,0,.55), 0 0 0 ${lock * 10}px ${C.purple}`,
          transform: `scale(${card})`,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 54, fontWeight: 900 }}>فلوس ضرايب في الخزنة</div>
        <div style={{ fontSize: 130, fontWeight: 900, color: C.purple, margin: "16px 0" }}>
          <CountUp to={37051.77} start={14} dur={40} dec={2} suffix=" ج" />
        </div>
        <div style={{ fontSize: 44, fontWeight: 700, color: "#64748B" }}>مش بتاعتنا — ممنوع تتصرف</div>
        <Shine at={34} />
        <div
          style={{
            position: "absolute",
            top: -70,
            left: -40,
            width: 150,
            height: 150,
            borderRadius: "50%",
            background: C.purple,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 80,
            transform: `scale(${lock}) rotate(${(1 - lock) * 90}deg)`,
            boxShadow: "0 20px 50px rgba(0,0,0,.4)",
          }}
        >
          🔒
        </div>
      </div>
      <div style={{ position: "absolute", top: 1290, width: "100%", textAlign: "center", opacity: interpolate(f, [78, 92], [0, 1], clamp) }}>
        <div style={{ fontSize: 56, fontWeight: 900 }}>محجوزة لوحدها في الخزنة</div>
        <div style={{ fontSize: 46, fontWeight: 700, color: "#DDD6FE", marginTop: 10 }}>عشان متصرفهاش وتتفاجئ</div>
      </div>
      <Burst at={52} x={190} y={620} colors={["#7C3AED","#DDD6FE","#FFFFFF"]} count={22} seed="t" />
    </Bg>
  );
};

// ───────────────────────── 9. security: company password + hide numbers
export const Secure: React.FC = () => {
  const f = useCurrentFrame();
  const phone = usePop(0, 14);
  const unlocked = f > 62;
  const glow = usePop(64, 10);
  return (
    <Bg tint={C.sky}>
      <Header delay={2}>أرقامك ليك انت بس</Header>
      <div style={{ position: "absolute", top: 420, left: 160, transform: `translateY(${(1 - phone) * 800}px)` }}>
        <Phone src={unlocked ? "shots/03-home-hidden.png" : f > 34 ? "shots/02-lock-typed.png" : "shots/01-lock.png"} />
      </div>
      <div style={{ position: "absolute", top: 1420, width: "100%", textAlign: "center", transform: `scale(${glow})` }}>
        <Pill bg={C.white} color={C.ink} size={46}>🔐 باسورد لصاحب الشركة · ومحدش غيرك يشوف</Pill>
      </div>
      <Burst at={64} x={540} y={980} colors={["#38BDF8","#FFFFFF","#22C55E"]} count={26} seed="sc" />
      <Flash at={62} strength={0.35} />
    </Bg>
  );
};

// ───────────────────────── 10. CTA
export const Cta: React.FC = () => {
  const f = useCurrentFrame();
  const logo = usePop(0, 10);
  const t1 = usePop(14, 12);
  const btn = usePop(34, 9);
  const pulse = 1 + Math.sin(f / 5) * 0.03;
  return (
    <Bg tint={C.blue}>
      <div style={{ position: "absolute", top: 300, width: "100%", display: "flex", justifyContent: "center" }}>
        <Logo size={260} style={{ transform: `scale(${logo})` }} />
      </div>
      <div style={{ position: "absolute", top: 640, left: 60, right: 60, textAlign: "center", opacity: t1, transform: `translateY(${(1 - t1) * 50}px)` }}>
        <div style={{ fontSize: 70, fontWeight: 900, lineHeight: 1.35 }}>متستناش آخر الشهر</div>
        <div style={{ fontSize: 70, fontWeight: 900, lineHeight: 1.35, color: C.sky }}>عشان تعرف كسبت كام</div>
      </div>
      <div style={{ position: "absolute", top: 960, width: "100%", display: "flex", justifyContent: "center" }}>
        <div
          style={{
            background: `linear-gradient(135deg, ${C.green}, #16A34A)`,
            borderRadius: 50,
            padding: "36px 70px",
            fontSize: 74,
            fontWeight: 900,
            transform: `scale(${btn * pulse})`,
            boxShadow: "0 30px 80px #22C55E66",
            position: "relative",
            overflow: "hidden",
          }}
        >
          اطلب كود التجربة
          <Shine at={50} />
          <Shine at={110} />
        </div>
      </div>
      <div style={{ position: "absolute", top: 1180, width: "100%", textAlign: "center", opacity: btn }}>
        <div style={{ fontSize: 44, fontWeight: 700, color: "#BBF7D0" }}>واتساب</div>
        <div style={{ fontSize: 92, fontWeight: 900, direction: "ltr", letterSpacing: 2 }}>+20 100 227 8559</div>
        <div style={{ fontSize: 50, fontWeight: 900, marginTop: 20, direction: "ltr", color: "#BFDBFE" }}>MK-Tech</div>
      </div>
      <Burst at={36} x={540} y={1060} count={44} spread={700} colors={["#22C55E","#FACC15","#38BDF8","#FFFFFF","#EF4444"]} seed="c" />
    </Bg>
  );
};
