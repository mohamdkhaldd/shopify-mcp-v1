// صفحة تانية (الرئيسية) عايزة المساعد يفتح محادثة جديدة ويسأل حاجة: بتسيب السؤال هنا
// والمساعد بياخده أول ما يفتح (مرة واحدة).
let pending: string | null = null;
export const askAssistantLater = (text: string) => {
  pending = text;
};
export const takePendingAsk = () => {
  const t = pending;
  pending = null;
  return t;
};
