import { useSyncExternalStore } from "react";

// The person who takes the commission (the page Al Bunyan calls "حسن"): each
// company types its own name in Settings, and it syncs to all its devices.
export const DEFAULT_PERSON = "المسؤول";

let name = "";
const subs = new Set<() => void>();
const set = (n: string) => {
  name = n.trim();
  subs.forEach((f) => f());
};

export const person = () => name || DEFAULT_PERSON;
export const personIsSet = () => !!name;
/** Re-renders when the name changes (on this device or from another one). */
export const usePerson = () =>
  useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    person,
  );

export const loadPerson = () => window.api?.invoke("commission:getName").then((n) => set(String(n ?? "")), () => {});
export async function savePerson(n: string) {
  await window.api?.invoke("commission:setName", { name: n });
  set(n);
}
