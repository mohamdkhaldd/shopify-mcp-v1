// طباعة + PDF جنب بعض في كل شيت (زي التأجير). اسم ملف الـ PDF من عنوان
// الصفحة (أو اللي يتبعت) + الشهر لو فيه.
export default function PrintButton({ pdfName }: { pdfName?: string } = {}) {
  async function handlePrint() {
    if (window.api) {
      try {
        await window.api.invoke("print:preview");
        return;
      } catch {
        // fall through to browser printing as a fallback
      }
    }
    window.print();
  }

  async function handlePdf() {
    const head = document.querySelector<HTMLElement>("[data-pdf-title]");
    const title = (pdfName ?? head?.dataset.pdfTitle ?? document.querySelector("main h1")?.textContent ?? "التشغيل").trim();
    const sub = head?.dataset.pdfSub?.trim();
    const name = `${title}${sub && !title.includes(sub) ? ` - ${sub}` : ""}`.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80);
    if (window.api) {
      try {
        await window.api.invoke("print:savePdf", { name });
        return;
      } catch {
        // fall through
      }
    }
    window.print();
  }

  const cls =
    "no-print flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold bg-white text-slate-600 hover:bg-primary-light hover:text-primary-dark shadow-card transition-colors";
  return (
    <>
      <button onClick={handlePrint} className={cls}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z" />
        </svg>
        طباعة
      </button>
      <button onClick={handlePdf} className={cls} title="احفظ الشيت ملف PDF">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 15h6M12 12v6" />
        </svg>
        PDF
      </button>
    </>
  );
}
