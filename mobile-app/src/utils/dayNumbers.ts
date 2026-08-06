// بيقرا لستة أيام مكتوبة زي "3, 7, 15" أو مدى زي "14-31" أو خليط بينهم زي
// "1-5, 7-10" — كل جزء بعد الفاصلة إما رقم لوحده أو "من-لحد" فبيتحوّل
// لمجموعة أرقام أيام. نفس الفكرة المستخدمة في برنامج الكمبيوتر.
export function parseDayNumbers(spec: string): Set<number> {
  const result = new Set<number>();
  const tokens = spec.split(/[,،]+/).map((s) => s.trim()).filter(Boolean);
  for (const token of tokens) {
    const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const from = Number(rangeMatch[1]);
      const to = Number(rangeMatch[2]);
      const lo = Math.min(from, to);
      const hi = Math.max(from, to);
      for (let n = lo; n <= hi; n++) result.add(n);
      continue;
    }
    for (const part of token.split(/\s+/).filter(Boolean)) {
      const n = Number(part);
      if (!Number.isNaN(n)) result.add(n);
    }
  }
  return result;
}
