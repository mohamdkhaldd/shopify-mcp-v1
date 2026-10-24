// A fake Supabase with the same sync_rows rules as the real project — shared by
// the rental and operations sync tests.
// A fake Supabase with the same sync_rows rules as the real project
// (older edits never overwrite newer ones, every write gets the next seq).
export function fakeCloud() {
  const rows = new Map<string, any>();
  let seq = 0;
  const log: any[] = [];
  const query = (table: string) => {
    const filters: ((r: any) => boolean)[] = [];
    let lim = 1e9;
    const q: any = {
      select: () => q,
      in: (c: string, vals: any[]) => (filters.push((r) => vals.includes(r[c])), q),
      gt: (c: string, v: any) => (filters.push((r) => r[c] > v), q),
      order: () => q,
      limit: (n: number) => ((lim = n), q),
      then: (res: any) => {
        const src = table === "sync_rows" ? [...rows.values()].sort((a, b) => a.seq - b.seq) : log;
        res({ data: src.filter((r) => filters.every((f) => f(r))).slice(0, lim).map((r) => structuredClone(r)), error: null });
      },
      upsert: async (records: any[]) => {
        for (const rec of records) {
          const key = `${rec.tbl}|${rec.gid}`;
          const old = rows.get(key);
          if (old && Date.parse(rec.updated_at) < Date.parse(old.updated_at)) continue;
          rows.set(key, { ...structuredClone(rec), seq: ++seq });
        }
        return { error: null };
      },
    };
    return q;
  };
  const signedIn: { email?: string; logins: string[] } = { email: "rental@elbonyan.app", logins: [] };
  return {
    rows,
    signedIn,
    createClient: () => ({
      auth: {
        getSession: async () => ({ data: { session: { user: { email: signedIn.email } } }, error: null }),
        signInWithPassword: async ({ email }: { email: string }) => ((signedIn.email = email), signedIn.logins.push(email), { error: null }),
        signOut: async () => ((signedIn.email = undefined), { error: null }),
        refreshSession: async () => ({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
      from: (t: string) => query(t),
      channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    }),
  };
}

