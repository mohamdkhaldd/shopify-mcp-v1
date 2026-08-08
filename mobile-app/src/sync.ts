import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { firestore } from "./firebase";

const DEVICE_ID_KEY = "al-bunyan-device-id";

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function syncKeyFor(localId: number): string {
  return `${getDeviceId()}_${localId}`;
}

// بيكتب في السحابة — لو مفيش نت دلوقتي، Firestore بيخزنها محليًا ويبعتها
// لوحده أول ما النت يرجع (من غير ما نعمل أي حاجة إضافية هنا).
export function pushToCloud(collectionName: string, localId: number, data: Record<string, unknown>) {
  const key = syncKeyFor(localId);
  setDoc(doc(collection(firestore, collectionName), key), {
    ...data,
    sync_key: key,
    updated_at: serverTimestamp(),
  }).catch(() => {});
}

export function deleteFromCloud(collectionName: string, localId: number) {
  const key = syncKeyFor(localId);
  deleteDoc(doc(collection(firestore, collectionName), key)).catch(() => {});
}

export const SYNCED_COLLECTIONS = [
  "partners",
  "contractors",
  "employees",
  "expense_categories",
  "equipment",
  "daily_logs",
  "monthly_expenses",
  "payroll_entries",
  "salary_payments",
] as const;

type RemoteDocHandler = (collectionName: string, docId: string, data: Record<string, unknown>) => void;

let started = false;

// بيسمع لأي تغيير بيحصل من أي جهاز تاني (موبايل تاني أو أي حاجة بتكتب في
// نفس القاعدة) ويطبّقه محليًا فورًا — ده اللي بيخلي الموبايلات "تسمع" بعض.
export function startCloudSync(onRemoteChange: RemoteDocHandler) {
  if (started) return;
  started = true;
  const ownDeviceId = getDeviceId();
  for (const name of SYNCED_COLLECTIONS) {
    onSnapshot(
      collection(firestore, name),
      (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === "removed") continue;
          const data = change.doc.data();
          const key = typeof data.sync_key === "string" ? data.sync_key : "";
          if (key.startsWith(`${ownDeviceId}_`)) continue; // كتابة جاية من نفس الجهاز، متطبقتش تاني
          onRemoteChange(name, change.doc.id, data);
        }
      },
      () => {
        // فشل الاتصال — هيحاول يتصل لوحده تاني أول ما النت يرجع
      }
    );
  }
}
