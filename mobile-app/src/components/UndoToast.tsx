import { useEffect, useState } from "react";
import { consumeUndo, subscribeUndo } from "../undo";

export default function UndoToast() {
  const [entry, setEntry] = useState<{ message: string } | null>(null);

  useEffect(() => subscribeUndo(setEntry), []);

  if (!entry) return null;
  return (
    <div className="fixed bottom-20 inset-x-0 max-w-md mx-auto px-4 z-50">
      <div className="bg-slate-800 text-white rounded-xl px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
        <div className="text-xs">{entry.message}</div>
        <button onClick={() => consumeUndo()} className="text-xs font-extrabold text-primary-light shrink-0">
          تراجع
        </button>
      </div>
    </div>
  );
}
