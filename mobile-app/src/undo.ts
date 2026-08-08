interface UndoEntry {
  message: string;
  run: () => void;
}

let current: UndoEntry | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(entry: UndoEntry | null) => void>();

function notify() {
  listeners.forEach((fn) => fn(current));
}

export function pushUndo(message: string, run: () => void) {
  current = { message, run };
  notify();
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    current = null;
    notify();
  }, 6000);
}

export function consumeUndo() {
  if (!current) return;
  current.run();
  current = null;
  if (timer) clearTimeout(timer);
  notify();
}

export function subscribeUndo(fn: (entry: UndoEntry | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
