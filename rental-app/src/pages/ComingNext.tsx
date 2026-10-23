import { navItems, footerItems, SectionId } from "../nav";
import { PageHeader, Panel } from "../components/ui";

// Placeholder for pages that come in the next steps of phase 3 (built and approved one by one).
export default function ComingNext({ id }: { id: SectionId }) {
  const item = [...navItems, ...footerItems].find((n) => n.id === id);
  return (
    <div className="grid gap-5">
      <PageHeader title={item?.label ?? ""} />
      <Panel>
        <div className="px-4 py-12 text-center text-muted">الصفحة دي جاية في الخطوة الجاية — بنبني الصفحات واحدة واحدة بعد موافقتك.</div>
      </Panel>
    </div>
  );
}
