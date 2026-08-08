import { initializeApp } from "firebase/app";
import { enableIndexedDbPersistence, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAYtgH5ZwqWPMTLFIgUT2_w5lH9iUbohYk",
  authDomain: "bonyan-9d419.firebaseapp.com",
  projectId: "bonyan-9d419",
  storageBucket: "bonyan-9d419.firebasestorage.app",
  messagingSenderId: "590186239301",
  appId: "1:590186239301:web:2f8510fbbf98a330455a2c",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firestore = getFirestore(firebaseApp);

// بيخزّن أي كتابة أو قراءة محليًا (IndexedDB) لما مفيش نت، وبيبعتها لوحدها
// أول ما النت يرجع — ده اللي بيخلي "تدخل بيانات أوفلاين، وتتبعت لوحدها بعدين" ممكنة.
enableIndexedDbPersistence(firestore).catch(() => {
  // المتصفح مش بيدعمها أو فاتح في أكتر من تاب في نفس الوقت — التطبيق يفضل شغال عادي.
});
