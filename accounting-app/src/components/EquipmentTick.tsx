// بيقسم اسم المعدة على سطرين بالكتير (بالكلمات) عشان الأسماء الطويلة زي
// "ونش 5 طن دبوسة" تبان كاملة جنب العمود بدل ما تتقص.
function splitLabel(name: string, maxChars = 14): string[] {
  const words = name.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  if (lines.length > 2) return [lines[0], `${lines.slice(1).join(" ").slice(0, maxChars - 1)}…`];
  return lines;
}

// اسم المعدة على محور الأعمدة: direction="ltr" هنا مقصودة — مع RTL المتصفح
// بيعكس معنى textAnchor="end" فالاسم كان بيترسم فوق الأعمدة نفسها ويستخبى.
// الحروف العربي نفسها بتتكتب صح عادي جوه السطر.
export default function EquipmentTick({ x, y, payload, fill }: { x?: number; y?: number; payload?: { value: string }; fill: string }) {
  const name = payload?.value ?? "";
  const lines = splitLabel(name);
  const lineHeight = 13;
  const startY = (y ?? 0) - ((lines.length - 1) * lineHeight) / 2;
  return (
    <text x={(x ?? 0) - 6} y={startY} textAnchor="end" direction="ltr" fill={fill} fontSize={11} fontFamily="Cairo">
      <title>{name}</title>
      {lines.map((line, i) => (
        <tspan key={i} x={(x ?? 0) - 6} dy={i === 0 ? 4 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}
