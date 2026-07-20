// Browser-preview fallback. The real app always talks to SQLite through
// window.api (see electron/preload.js); this only exists so the Settings UI
// can be developed and previewed with `npm run dev` in a plain browser,
// where there is no Electron main process to answer IPC calls. Same
// channel names, same shapes — the UI code never knows which one it's using.

interface MockState {
  partners: { id: number; name: string }[];
  employees: { id: number; name: string; wage_type: "daily" | "monthly"; rate: number }[];
  contractors: { id: number; name: string }[];
  expense_categories: { id: number; name: string }[];
  equipment: { id: number; name: string; shares: { partner_id: number; percentage: number }[] }[];
  nextId: number;
}

const STORAGE_KEY = "al-bunyan-mock-db";

function loadState(): MockState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);
  return {
    partners: [],
    employees: [],
    contractors: [],
    expense_categories: [],
    equipment: [],
    nextId: 1,
  };
}

function saveState(state: MockState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function mockInvoke(channel: string, payload?: any): Promise<any> {
  const state = loadState();
  const [entity, action] = channel.split(":");
  const key = { partners: "partners", employees: "employees", contractors: "contractors", expenseCategories: "expense_categories", equipment: "equipment" }[
    entity
  ] as keyof MockState;

  if (action === "list") {
    return state[key];
  }

  if (action === "create") {
    const id = state.nextId++;
    const record = { id, ...payload };
    (state[key] as any[]).push(record);
    saveState(state);
    return record;
  }

  if (action === "delete") {
    (state as any)[key] = (state[key] as any[]).filter((r) => r.id !== payload.id);
    saveState(state);
    return { ok: true };
  }

  throw new Error(`Unknown mock channel: ${channel}`);
}
