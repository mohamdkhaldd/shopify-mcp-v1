import { useEffect, useState } from "react";
import { api, DeletePreview, Deletable } from "../api/client";
import Modal from "./Modal";
import { Button, ErrorBox } from "./ui";
import Icon from "./Icon";

// "هتحذف كذا وكذا — موافق؟" — lists exactly what goes before anything is deleted.
export default function ConfirmDelete({ entity, id, onClose, onDeleted }: { entity: Deletable; id: number; onClose: () => void; onDeleted: () => void }) {
  const [preview, setPreview] = useState<DeletePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.deletePreview(entity, id).then(setPreview, (e) => setError(e.message));
  }, [entity, id]);

  async function confirm() {
    setBusy(true);
    try {
      await api.delete(entity, id); // the undo bar ("اتحفظ: حذف …") comes from the save event
      onDeleted();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="تأكيد الحذف"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>لأ، رجوع</Button>
          <Button danger onClick={confirm} disabled={busy || !preview || !!preview.blocked}>
            <Icon name="trash" className="w-4 h-4" />
            موافق، احذف
          </Button>
        </>
      }
    >
      {error && <ErrorBox message={error} />}
      {preview && (
        <div className="grid gap-3">
          <div className="font-bold">هتحذف:</div>
          <ul className="m-0 ps-5 grid gap-1">
            {preview.items.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
          {preview.blocked ? (
            <ErrorBox message={preview.blocked} />
          ) : (
            <div className="text-xs text-muted">هيختفي من كل الشاشات والحسابات. لو غلطت، دوس "تراجع" أو رجّعه من سجل التعديلات.</div>
          )}
        </div>
      )}
    </Modal>
  );
}
