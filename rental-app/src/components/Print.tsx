import { appApi } from "../api/client";
import Icon from "./Icon";
import { Button } from "./ui";

// Ported from the old app: PrintButton opens the in-app PDF preview,
// PrintHeader / PrintSignoff only show on paper.

export function PrintButtons({ pdfName, singlePage = true }: { pdfName: string; singlePage?: boolean }) {
  return (
    <>
      <Button onClick={() => (window.api ? appApi.printPreview(singlePage) : window.print())}>
        <Icon name="print" className="w-4 h-4" />
        طباعة
      </Button>
      <Button onClick={() => appApi.savePdf(pdfName)}>PDF</Button>
    </>
  );
}

export function PrintHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="print-only mb-4 pb-3 border-b-2 border-fg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="./logo.png" alt="" className="w-12 h-12 rounded-full" />
          <div>
            <div className="font-extrabold text-lg">شركة البنيان للمعدات الثقيلة</div>
            <div className="text-sm text-muted">{title}</div>
          </div>
        </div>
        {subtitle && <div className="text-sm text-muted">{subtitle}</div>}
      </div>
    </div>
  );
}

export function PrintSignoff({ parties = ["توقيع شركة البنيان"] }: { parties?: string[] }) {
  return (
    <div className="print-only mt-10 pt-6">
      <div className="grid gap-10 text-center font-bold text-sm" style={{ gridTemplateColumns: `repeat(${parties.length + 1}, minmax(0, 1fr))` }}>
        {parties.map((p) => (
          <div key={p} className="border-t border-fg pt-2 mt-10">
            {p}
          </div>
        ))}
        <div>
          <div className="mb-2">الختم</div>
          <div className="w-28 h-28 border-2 border-dashed border-muted rounded-full mx-auto" />
        </div>
      </div>
    </div>
  );
}
