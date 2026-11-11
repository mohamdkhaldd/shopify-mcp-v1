// رابط واتساب لرسالة جاهزة (رقم مصري 01xxxxxxxxx ← 201xxxxxxxxx). البرنامج مبيفتحش أي رابط غير ده.

export function whatsappUrl(phone: string | null | undefined, text: string) {
  let p = String(phone ?? "").replace(/[^\d]/g, "");
  if (/^01\d{9}$/.test(p)) p = `2${p}`;
  else if (/^1\d{9}$/.test(p)) p = `20${p}`;
  return `https://wa.me/${/^\d{8,15}$/.test(p) ? p : ""}?text=${encodeURIComponent(text.slice(0, 3500))}`;
}

export const isWhatsappUrl = (url: unknown): url is string => typeof url === "string" && /^https:\/\/wa\.me\/\d{0,15}\?text=[^\s]*$/.test(url);
