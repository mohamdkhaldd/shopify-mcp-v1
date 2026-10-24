// MK-Tech's shell (one app, two programs): leaving to the start page and the
// device password. The rental screens have the same calls (src/api/client.ts).
export type ShellInfo = { product: string | null; products: string[]; locked?: boolean; hasPassword?: boolean };
type ShellResult = { ok: true } | { ok: false; message?: string };

export const shell = {
  info: (): Promise<ShellInfo | null> => window.api?.invoke("shell:info") ?? Promise.resolve(null),
  /** back to the start: the password page (if one is set) or the chooser */
  logout: () => window.api?.invoke("shell:logout"),
  setPassword: (current: string, next: string): Promise<ShellResult> => window.api!.invoke("shell:setPassword", { current, next }),
};
